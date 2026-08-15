/**
 * 存储层（纯 Web 版）
 *
 * 数据保存在浏览器 localStorage，并支持 JSON 导入 / 导出、WebDAV 同步。
 */

import type { AppData } from '../types';

const LS_DATA_KEY = 'promptbox.data';
const LS_UI_KEY = 'promptbox.ui';

// ------------------------------------------------------------------ 主数据

export async function loadData(): Promise<AppData | null> {
  try {
    const raw = localStorage.getItem(LS_DATA_KEY);
    return raw ? (JSON.parse(raw) as AppData) : null;
  } catch (err) {
    console.error('[storage] localStorage 读取失败', err);
    return null;
  }
}

export async function persistData(data: AppData): Promise<void> {
  localStorage.setItem(LS_DATA_KEY, JSON.stringify(data));
}

export async function dataFilePath(): Promise<string> {
  return 'localStorage · promptbox.data（浏览器模式）';
}

// ------------------------------------------------------------------ UI 偏好
// 主题/强调色额外写一份到 localStorage，供 index.html 在首帧前读取，避免闪白。

export function saveUiPrefs(prefs: { theme: string; accent: string }): void {
  try {
    localStorage.setItem(LS_UI_KEY, JSON.stringify(prefs));
  } catch {
    /* 忽略 */
  }
}

// ------------------------------------------------------------------ 导入 / 导出

/** 导出 JSON：浏览器下触发文件下载，返回文件名 */
export async function exportToFile(json: string, suggestedName: string): Promise<string | null> {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return suggestedName;
}

/** 选择并读取 JSON 文件 */
export async function importFromFile(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ name: file.name, content: String(reader.result ?? '') });
      reader.onerror = () => resolve(null);
      reader.readAsText(file, 'utf-8');
    };
    input.click();
  });
}

// ------------------------------------------------------------------ 剪贴板

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 极端降级：隐藏 textarea + execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

