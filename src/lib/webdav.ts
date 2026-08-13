/**
 * WebDAV 协议层（纯 fetch 实现，浏览器 / 桌面 WebView 通用）
 *
 * 支持的方法：PROPFIND（探测存在 + 取 etag）、GET、PUT（If-Match 乐观并发）、
 * MKCOL（建目录）、OPTIONS（测连通）。使用 Basic Auth（UTF-8 安全 base64）。
 *
 * ⚠️ CORS 注意：浏览器从 WebUI 直连 WebDAV 时，远端必须返回正确的 CORS 头，
 *    允许来源、方法（GET/PUT/PROPFIND/MKCOL/OPTIONS）与 Authorization 头。
 *    若你的服务不支持 CORS，可在同域前置一个反向代理来放开跨域。
 */

import type { RemoteData, VersionEntry } from '../types';

export interface WebDavAuth {
  url: string;
  username: string;
  password: string;
  remotePath: string;
}

export interface RemoteFile {
  /** 解析后的完整文件 URL */
  url: string;
  /** 远端文件内容；不存在时为 null */
  data: RemoteData | null;
  /** 远端 etag；不存在时为 null */
  etag: string | null;
}

export interface PushResult {
  ok: boolean;
  /** 412 表示 etag 冲突（远端已被别人改动） */
  conflict: boolean;
  status: number;
  etag: string | null;
  message: string;
}

export interface ConnResult {
  ok: boolean;
  message: string;
}

function b64encodeUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function authHeader(a: WebDavAuth): string {
  return 'Basic ' + b64encodeUtf8(`${a.username}:${a.password}`);
}

/** 规范化：根地址去尾斜杠，远程路径保证首斜杠 */
export function resolveFileUrl(a: WebDavAuth): string {
  const base = a.url.replace(/\/+$/, '');
  const path = a.remotePath.startsWith('/') ? a.remotePath : '/' + a.remotePath;
  return base + path;
}

/** 文件所在目录 URL（末尾带斜杠） */
function resolveDirUrl(a: WebDavAuth): string {
  const file = resolveFileUrl(a);
  const idx = file.lastIndexOf('/');
  return file.slice(0, idx + 1);
}

function stripEtag(raw: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/^["']|["']$/g, '').trim() || null;
}

async function davFetch(url: string, a: WebDavAuth, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: authHeader(a),
    },
  });
}

function extractEtag(xml: string): string | null {
  const m = xml.match(/<[^>]*getetag[^>]*>\s*([^<]+?)\s*<\/[^>]*getetag[^>]*>/i);
  return m ? stripEtag(m[1]) : null;
}

/** 探测远端文件是否存在并取 etag（PROPFIND Depth:0） */
async function propfind(a: WebDavAuth, url: string): Promise<{ exists: boolean; etag: string | null }> {
  try {
    const res = await davFetch(url, a, {
      method: 'PROPFIND',
      headers: {
        Depth: '0',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body:
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>',
    });
    if (res.status === 404 || res.status === 410) return { exists: false, etag: null };
    if (res.status === 207 || res.ok) {
      const text = await res.text().catch(() => '');
      return { exists: true, etag: extractEtag(text) };
    }
    return { exists: false, etag: null };
  } catch {
    return { exists: false, etag: null };
  }
}

/** 确保父目录存在：逐级 MKCOL */
async function ensureParentDirs(a: WebDavAuth): Promise<void> {
  const dir = resolveDirUrl(a);
  const base = a.url.replace(/\/+$/, '') + '/';
  if (!dir.startsWith(base)) return; // 路径异常保护
  const rel = dir.slice(base.length).replace(/\/+$/, '');
  if (!rel) return;
  const segments = rel.split('/');
  let acc = base;
  for (const seg of segments) {
    if (!seg) continue;
    acc += seg + '/';
    try {
      const res = await davFetch(acc, a, { method: 'MKCOL' });
      // 201 新建；405/409 已存在或中间态，均视为可接受
      if (res.status !== 201 && res.status !== 405 && res.status !== 409) {
        // 其它错误仅记录，不阻断（可能是无 MKCOL 权限的扁平服务）
        console.warn('[webdav] MKCOL 返回', res.status, acc);
      }
    } catch (err) {
      console.warn('[webdav] MKCOL 失败', acc, err);
    }
  }
}

/** 读取远端文件；不存在返回 { data:null, etag:null } */
export async function fetchRemote(a: WebDavAuth): Promise<RemoteFile> {
  return fetchByUrl(a, resolveFileUrl(a));
}

/** 按任意 URL 读取远端文件（版本恢复时复用） */
export async function fetchVersion(a: WebDavAuth, versionUrl: string): Promise<RemoteFile> {
  return fetchByUrl(a, versionUrl);
}

async function fetchByUrl(a: WebDavAuth, url: string): Promise<RemoteFile> {
  // 直接 GET（不再预先 PROPFIND 探测，避免部分服务对 PROPFIND 的 CORS/预检限制）
  const res = await davFetch(url, a, { method: 'GET' });
  if (res.status === 404) return { url, data: null, etag: null };
  if (!res.ok) {
    throw new Error(`读取远端失败（HTTP ${res.status}）`);
  }
  const text = await res.text();
  const etag = stripEtag(res.headers.get('etag'));
  try {
    const data = JSON.parse(text) as RemoteData;
    return { url, data, etag };
  } catch {
    throw new Error('远端文件不是合法的 JSON');
  }
}

/** 上传文件；etag 存在时附带 If-Match 做乐观并发 */
export async function pushRemote(
  a: WebDavAuth,
  data: RemoteData,
  etag?: string | null,
): Promise<PushResult> {
  await ensureParentDirs(a);
  const url = resolveFileUrl(a);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (etag) headers['If-Match'] = etag;

  const res = await davFetch(url, a, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data, null, 2),
  });

  if (res.status === 412) {
    return { ok: false, conflict: true, status: 412, etag: null, message: '远端已被改动（etag 冲突）' };
  }
  if (res.status === 409) {
    // 父目录不存在：再建一次后重试一次
    await ensureParentDirs(a);
    const retry = await davFetch(url, a, { method: 'PUT', headers, body: JSON.stringify(data, null, 2) });
    if (retry.status === 412) {
      return { ok: false, conflict: true, status: 412, etag: null, message: '远端已被改动（etag 冲突）' };
    }
    if (!retry.ok) {
      return { ok: false, conflict: false, status: retry.status, etag: null, message: `上传失败（HTTP ${retry.status}）` };
    }
    return { ok: true, conflict: false, status: retry.status, etag: stripEtag(retry.headers.get('etag')), message: '已上传' };
  }
  if (!res.ok) {
    return { ok: false, conflict: false, status: res.status, etag: null, message: `上传失败（HTTP ${res.status}）` };
  }
  return { ok: true, conflict: false, status: res.status, etag: stripEtag(res.headers.get('etag')), message: '已上传' };
}

/** 测试连通性：OPTIONS 探活 + 基础鉴权信息完整性检查 */
export async function testConnection(a: WebDavAuth): Promise<ConnResult> {
  if (!a.url.trim()) return { ok: false, message: '请先填写 WebDAV 地址' };
  if (!/^https?:\/\//i.test(a.url.trim())) return { ok: false, message: '地址需以 http(s):// 开头' };

  const url = resolveFileUrl(a);
  try {
    const res = await davFetch(url, a, { method: 'OPTIONS' });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: '鉴权失败（401/403），请检查账号或密码' };
    }
    if (res.status === 404 || res.status === 405 || res.status === 200 || res.status === 204) {
      return { ok: true, message: '连接成功，已可访问该地址' };
    }
    return { ok: true, message: `连接可达（HTTP ${res.status}）` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Failed to fetch|NetworkError|CORS|跨域/i.test(msg)) {
      return { ok: false, message: '连接被拒绝或跨域(CORS)受限，请确认服务可达且已放开跨域' };
    }
    return { ok: false, message: `连接失败：${msg}` };
  }
}

/* ==========================================================================
   历史版本（自维护 versions 子目录，最多保留 N 个，满了删最早的）
   ========================================================================== */

/** 版本目录 = 主文件所在目录下的 versions/ */
export function resolveVersionsDir(a: WebDavAuth): string {
  const dir = resolveDirUrl(a); // 末尾带斜杠
  return dir.replace(/\/$/, '') + '/versions/';
}

/** 确保目录存在（MKCOL，幂等） */
export async function ensureDir(a: WebDavAuth, dirUrl: string): Promise<void> {
  try {
    const res = await davFetch(dirUrl, a, { method: 'MKCOL' });
    // 201 新建；405/409 已存在，可接受
    if (res.status !== 201 && res.status !== 405 && res.status !== 409) {
      console.warn('[webdav] MKCOL 返回', res.status, dirUrl);
    }
  } catch (err) {
    console.warn('[webdav] MKCOL 失败', dirUrl, err);
  }
}

interface PropItem {
  href: string;
  modified: number | null;
  isDir: boolean;
  size: number | null;
}

/** 从文件名兜底解析时间戳：promptbox-<毫秒>.json */
function tsFromName(name: string): number | null {
  const m = name.match(/(\d{10,})/);
  if (!m) return null;
  const n = Number(m[1]);
  // 13 位为毫秒时间戳，10 位为秒时间戳
  const ms = m[1].length >= 13 ? n : n * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** 解析 PROPFIND 多响应（不依赖具体命名空间前缀） */
function parsePropfind(xml: string): PropItem[] {
  const blocks = xml.match(/<[^>]*response[\s\S]*?<\/[^>]*response>/gi) || [];
  const items: PropItem[] = [];
  for (const b of blocks) {
    const hrefM = b.match(/<[^>]*href[^>]*>\s*([^<]+?)\s*<\/[^>]*href[^>]*>/i);
    const modM = b.match(/<[^>]*getlastmodified[^>]*>\s*([^<]+?)\s*<\/[^>]*getlastmodified[^>]*>/i);
    const sizeM = b.match(/<[^>]*getcontentlength[^>]*>\s*(\d+)\s*<\/[^>]*getcontentlength[^>]*>/i);
    const href = hrefM ? decodeURIComponent(hrefM[1].trim()) : '';
    if (!href) continue;
    // 目录判定：必须是 <resourcetype> 内显式的 <collection> 元素，或 href 以斜杠结尾。
    // 注意：部分服务（如 CSTCloud）会给「文件」也返回 <iscollection>0</iscollection>，
    // 其含 "collection" 子串，若用 /collection/ 误判会把所有文件当目录而漏掉（历史版本失效）。
    const isDir =
      /<[^>]*resourcetype[^>]*>\s*<[^>]*collection[^>]*>/i.test(b) || /\/$/.test(href);
    let modified: number | null = null;
    if (modM) {
      const d = new Date(modM[1].trim());
      if (!isNaN(d.getTime())) modified = d.getTime();
    }
    // getlastmodified 缺失时，用文件名里的时间戳兜底
    if (modified === null) modified = tsFromName(href.split('/').pop() || href);
    items.push({ href, modified, isDir, size: sizeM ? parseInt(sizeM[1], 10) : null });
  }
  return items;
}

/** 列出版本目录中的历史版本（按修改时间倒序，最新在前） */
export async function listVersions(a: WebDavAuth): Promise<VersionEntry[]> {
  const dir = resolveVersionsDir(a);
  console.info('[webdav] 列出版本目录请求地址：', dir, '（远端文件根：', resolveFileUrl(a), '）');
  const res = await davFetch(dir, a, {
    method: 'PROPFIND',
    headers: {
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body:
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<d:propfind xmlns:d="DAV:"><d:prop>' +
      '<d:getlastmodified/><d:getcontentlength/><d:resourcetype/>' +
      '</d:prop></d:propfind>',
  });
  // 目录尚不存在 → 确实没有版本
  if (res.status === 404 || res.status === 405) return [];
  if (!res.ok) {
    // 把真实错误抛出，由上层显示，而不是静默返回空列表
    const text = await res.text().catch(() => '');
    console.warn('[webdav] 列出版本失败', res.status, text);
    throw new Error(`列出版本失败（HTTP ${res.status}），请确认服务已放开 PROPFIND 与跨域(CORS)`);
  }
  const text = await res.text();
  const parsed = parsePropfind(text);
  const entries = parsed
    .filter((p) => !p.isDir && /\.json$/i.test(p.href))
    .map((p) => {
      let path = p.href;
      try {
        // href 可能是绝对路径或完整 URL，统一基于远端根地址拼出可访问 URL
        const base = a.url.replace(/\/+$/, '') + '/';
        path = new URL(p.href, base).toString();
      } catch {
        try {
          path = new URL(p.href, dir).toString();
        } catch {
          /* 保留原始 href */
        }
      }
      const rawName = p.href.split('/').pop() || p.href;
      const name = rawName.replace(/\.json$/i, '');
      return { name, path, modified: p.modified ?? 0, size: p.size ?? undefined };
    })
    .sort((x, y) => y.modified - x.modified);
  if (parsed.length > 0 && entries.length === 0) {
    console.warn('[webdav] 版本目录已读取，但无可识别的 .json 文件，原始响应：', text);
  }
  return entries;
}

/** 写入一个版本文件（先确保目录，再 PUT） */
export async function pushVersion(
  a: WebDavAuth,
  data: RemoteData,
  versionName: string,
): Promise<PushResult> {
  const dir = resolveVersionsDir(a);
  await ensureDir(a, dir);
  const url = dir.replace(/\/$/, '') + '/' + versionName;
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  const body = JSON.stringify(data, null, 2);

  const res = await davFetch(url, a, { method: 'PUT', headers, body });
  if (res.status === 409) {
    await ensureDir(a, dir);
    const retry = await davFetch(url, a, { method: 'PUT', headers, body });
    if (!retry.ok) {
      return { ok: false, conflict: false, status: retry.status, etag: null, message: `版本写入失败（HTTP ${retry.status}）` };
    }
    return { ok: true, conflict: false, status: retry.status, etag: stripEtag(retry.headers.get('etag')), message: '已写入版本' };
  }
  if (!res.ok) {
    return { ok: false, conflict: false, status: res.status, etag: null, message: `版本写入失败（HTTP ${res.status}）` };
  }
  return { ok: true, conflict: false, status: res.status, etag: stripEtag(res.headers.get('etag')), message: '已写入版本' };
}

/** 删除远端文件（用于清理超额版本） */
export async function deleteRemote(a: WebDavAuth, url: string): Promise<void> {
  try {
    const res = await davFetch(url, a, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      console.warn('[webdav] DELETE 返回', res.status, url);
    }
  } catch (err) {
    console.warn('[webdav] DELETE 失败', url, err);
  }
}

