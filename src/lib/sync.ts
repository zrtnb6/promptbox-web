/**
 * 同步引擎：在本地数据与 WebDAV 远端之间做双向合并。
 *
 * v1 策略：
 *  - 新增 / 编辑：两端取并集，按 updatedAt 取较新者（last-write-wins）。
 *  - 删除：暂不跨端传播（避免无 tombstone 时的静默复活），需在各端分别删除。
 *  - 并发：PUT 时携带远端 etag（If-Match），冲突（412）自动重新拉取合并一次。
 *
 * settings（主题 / 强调色 / 同步配置本身）视为设备私有，不入远端文件。
 */

import type {
  Category,
  PromptTemplate,
  RemoteData,
  SyncConfig,
  SyncStatus,
  VersionEntry,
} from '../types';
import {
  deleteRemote,
  fetchRemote,
  fetchVersion,
  listVersions as listRemoteVersions,
  pushRemote,
  pushVersion,
  testConnection,
  type WebDavAuth,
} from './webdav';

export const SYNC_SCHEMA_VERSION = 1;
/** 历史版本最多保留数，超出删除最早的 */
export const VERSION_KEEP = 10;

export interface LocalSnapshot {
  categories: Category[];
  templates: PromptTemplate[];
}

export interface SyncOutcome {
  ok: boolean;
  status: SyncStatus; // 'success' | 'error' | 'conflict'
  message: string;
  /** 合并后的本地数据（成功后由 store 落库） */
  merged?: LocalSnapshot;
  /** 同步后的远端 etag，用于下次乐观并发 */
  etag: string | null;
}

function toAuth(config: SyncConfig): WebDavAuth {
  return {
    url: config.url,
    username: config.username,
    password: config.password,
    remotePath: config.remotePath,
  };
}

/** 并集 + 按 updatedAt 取新 */
function mergeEntities<T extends { id: string; updatedAt: number }>(
  local: T[],
  remote: T[],
): T[] {
  const map = new Map<string, T>();
  for (const r of remote) map.set(r.id, r);
  for (const l of local) {
    const r = map.get(l.id);
    if (r) map.set(l.id, l.updatedAt >= r.updatedAt ? l : r);
    else map.set(l.id, l);
  }
  return [...map.values()];
}

function buildRemoteData(snap: LocalSnapshot): RemoteData {
  return {
    app: 'PromptBox',
    schemaVersion: SYNC_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    categories: snap.categories,
    templates: snap.templates,
  };
}

async function doPush(
  auth: WebDavAuth,
  snap: LocalSnapshot,
  etag: string | null,
): Promise<{ ok: boolean; conflict: boolean; etag: string | null; message: string }> {
  const res = await pushRemote(auth, buildRemoteData(snap), etag);
  return { ok: res.ok, conflict: res.conflict, etag: res.etag, message: res.message };
}

/** 执行一次完整同步：拉取 → 合并 → 上传（冲突重试一次） */
export async function performSync(local: LocalSnapshot, config: SyncConfig): Promise<SyncOutcome> {
  const auth = toAuth(config);
  try {
    const remote = await fetchRemote(auth);
    const baseTemplates = remote.data?.templates ?? [];
    const baseCategories = remote.data?.categories ?? [];

    const merged: LocalSnapshot = {
      categories: mergeEntities(local.categories, baseCategories),
      templates: mergeEntities(local.templates, baseTemplates),
    };

    let push = await doPush(auth, merged, remote.etag);
    if (push.conflict) {
      // 远端被改动：重新拉取并合并一次
      const fresh = await fetchRemote(auth);
      const reMerged: LocalSnapshot = {
        categories: mergeEntities(local.categories, fresh.data?.categories ?? []),
        templates: mergeEntities(local.templates, fresh.data?.templates ?? []),
      };
      push = await doPush(auth, reMerged, fresh.etag);
      if (push.conflict) {
        return {
          ok: false,
          status: 'conflict',
          message: '同步冲突：远端在同步期间被改动，且重试后仍冲突，请稍后再试。',
          etag: null,
        };
      }
      return {
        ok: true,
        status: 'success',
        message: `已同步（合并了远端的新改动）：${reMerged.templates.length} 个模板、${reMerged.categories.length} 个分类`,
        merged: reMerged,
        etag: push.etag,
      };
    }

    if (!push.ok) {
      return { ok: false, status: 'error', message: push.message, etag: null };
    }

    return {
      ok: true,
      status: 'success',
      message: `同步成功：${merged.templates.length} 个模板、${merged.categories.length} 个分类`,
      merged,
      etag: push.etag,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 'error', message, etag: null };
  }
}

export async function testWebDav(config: SyncConfig): Promise<{ ok: boolean; message: string }> {
  return testConnection(toAuth(config));
}

/* ==========================================================================
   单向同步 + 版本管理（替代原双向 performSync）
   ========================================================================== */

/** 版本文件名：promptbox-<毫秒时间戳>.json（保证唯一，展示用 getlastmodified） */
function genVersionName(): string {
  return `promptbox-${Date.now()}.json`;
}

/** 清理超额版本：保留最新 VERSION_KEEP 个，删除更早的 */
async function pruneVersions(auth: WebDavAuth): Promise<void> {
  try {
    const list = await listRemoteVersions(auth);
    if (list.length <= VERSION_KEEP) return;
    const stale = list.slice(VERSION_KEEP); // list 已按修改时间倒序
    for (const v of stale) {
      await deleteRemote(auth, v.path);
    }
  } catch (err) {
    console.warn('[sync] 清理超额版本失败', err);
  }
}

/**
 * 单向「上传」：把本地写回远端主文件（冲突时本端为准强制覆盖），
 * 成功后写一份带时间戳的版本快照，并清理到最多 VERSION_KEEP 个。
 */
export async function uploadOnly(local: LocalSnapshot, config: SyncConfig): Promise<SyncOutcome> {
  const auth = toAuth(config);
  try {
    const data = buildRemoteData(local);
    let push = await pushRemote(auth, data, config.lastEtag);
    if (push.conflict) {
      // 远端已被改动：本端改动视为最新，强制覆盖
      push = await pushRemote(auth, data, null);
    }
    if (!push.ok) {
      return { ok: false, status: 'error', message: push.message, etag: null };
    }

    const ver = await pushVersion(auth, data, genVersionName());
    if (!ver.ok) console.warn('[sync] 版本快照写入失败', ver.message);
    await pruneVersions(auth);

    return {
      ok: true,
      status: 'success',
      message: `已上传 ${local.templates.length} 个模板、${local.categories.length} 个分类`,
      etag: push.etag,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 'error', message, etag: null };
  }
}

/**
 * 单向「拉取」：把远端合并进本地（按 updatedAt last-write-wins），不回写远端。
 * 删除暂不通步，故合并为并集策略。
 */
export async function downloadOnly(
  local: LocalSnapshot,
  config: SyncConfig,
): Promise<SyncOutcome> {
  const auth = toAuth(config);
  try {
    const remote = await fetchRemote(auth);
    if (!remote.data) {
      return { ok: false, status: 'error', message: '远端没有可读的数据', etag: null };
    }
    const merged: LocalSnapshot = {
      categories: mergeEntities(local.categories, remote.data.categories ?? []),
      templates: mergeEntities(local.templates, remote.data.templates ?? []),
    };
    return {
      ok: true,
      status: 'success',
      message: `已拉取（合并后 ${merged.templates.length} 个模板）`,
      merged,
      etag: remote.etag,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 'error', message, etag: null };
  }
}

/** 列出版本目录中的历史版本 */
export async function listVersions(config: SyncConfig): Promise<VersionEntry[]> {
  return listRemoteVersions(toAuth(config));
}

/** 从指定历史版本恢复：把版本内容合并进本地（不回写远端） */
export async function restoreVersion(
  config: SyncConfig,
  versionUrl: string,
  local: LocalSnapshot,
): Promise<SyncOutcome> {
  const auth = toAuth(config);
  try {
    const remote = await fetchVersion(auth, versionUrl);
    if (!remote.data) {
      return { ok: false, status: 'error', message: '该版本文件无法读取', etag: null };
    }
    const merged: LocalSnapshot = {
      categories: mergeEntities(local.categories, remote.data.categories ?? []),
      templates: mergeEntities(local.templates, remote.data.templates ?? []),
    };
    return {
      ok: true,
      status: 'success',
      message: `已恢复版本（合并后 ${merged.templates.length} 个模板）`,
      merged,
      etag: remote.etag,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 'error', message, etag: null };
  }
}

