import { create } from 'zustand';
import type {
  AppData,
  Category,
  ImportMode,
  ListFilter,
  PromptTemplate,
  Settings,
  SortKey,
  SyncConfig,
  SyncPhase,
  TemplateVariable,
  VersionEntry,
} from '../types';
import { DEFAULT_SYNC } from '../types';
import { uid } from '../lib/id';
import { createSampleData } from '../lib/sampleData';
import { dataFilePath, loadData, persistData, saveUiPrefs } from '../lib/storage';
import {
  downloadOnly,
  listVersions as listRemoteVersions,
  restoreVersion as restoreRemoteVersion,
  testWebDav as runTestWebDav,
  uploadOnly,
  type LocalSnapshot,
} from '../lib/sync';

const SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#2563eb',
  globalShortcut: 'CmdOrCtrl+Shift+P',
  hideAfterCopy: false,
  sync: DEFAULT_SYNC,
};

export const CATEGORY_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d946ef',
  '#f59e0b',
  '#ef4444',
  '#0891b2',
  '#7c3aed',
  '#64748b',
];

export type DetailMode = 'use' | 'edit';

export interface ToastState {
  id: string;
  text: string;
  kind: 'success' | 'error' | 'info';
}

interface AppState {
  // ---- 数据 ----
  ready: boolean;
  templates: PromptTemplate[];
  categories: Category[];
  settings: Settings;
  dataPath: string;

  // ---- UI ----
  filter: ListFilter;
  query: string;
  sort: SortKey;
  selectedId: string | null;
  mode: DetailMode;
  sidebarCollapsed: boolean;
  quickUseOpen: boolean;
  settingsOpen: boolean;
  toast: ToastState | null;

  // ---- 同步（瞬态） ----
  syncPhase: SyncPhase;
  syncVersions: VersionEntry[];

  // ---- 生命周期 ----
  init: () => Promise<void>;

  // ---- 导航 / 视图 ----
  setFilter: (filter: ListFilter) => void;
  setQuery: (q: string) => void;
  setSort: (s: SortKey) => void;
  select: (id: string | null) => void;
  setMode: (m: DetailMode) => void;
  toggleSidebar: () => void;
  openQuickUse: (id?: string) => void;
  closeQuickUse: () => void;
  setSettingsOpen: (open: boolean) => void;
  notify: (text: string, kind?: ToastState['kind']) => void;
  dismissToast: () => void;

  // ---- 模板 CRUD ----
  createTemplate: () => string;
  updateTemplate: (id: string, patch: Partial<PromptTemplate>) => void;
  updateVariables: (id: string, variables: TemplateVariable[]) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => void;
  toggleFavorite: (id: string) => void;
  registerUse: (id: string) => void;

  // ---- 分类 ----
  addCategory: (name: string) => string;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  // ---- 设置 ----
  updateSettings: (patch: Partial<Settings>) => void;
  updateSyncConfig: (patch: Partial<SyncConfig>) => void;

  // ---- 导入导出 ----
  serialize: () => string;
  importData: (raw: string, mode: ImportMode) => { ok: boolean; message: string };

  // ---- 同步 ----
  testWebDav: () => Promise<{ ok: boolean; message: string }>;
  uploadNow: () => Promise<void>;
  downloadNow: () => Promise<void>;
  listVersions: () => Promise<void>;
  restoreVersion: (url: string) => Promise<void>;
}

// ------------------------------------------------------------- 持久化（防抖）

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
/** 同步进行中守卫，避免自动同步与手动同步重入、以及同步落库再触发自动同步 */
let syncingRef = false;
/** 列出版本进行中守卫 */
let versionLoadingRef = false;

function snapshot(state: AppState): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    templates: state.templates,
    categories: state.categories,
    settings: state.settings,
  };
}

/** 仅落盘，不触发自动同步（供同步回写使用） */
function persistOnly(get: () => AppState) {
  const state = get();
  if (!state.ready) return;
  persistData(snapshot(state)).catch((err) => {
    console.error('[store] 保存失败', err);
  });
}

function scheduleSave(get: () => AppState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const state = get();
    if (!state.ready) return;
    persistData(snapshot(state)).catch((err) => {
      console.error('[store] 保存失败', err);
    });
    // 自动同步：改动后单向上传（开启且非同步进行中）
    const sync = state.settings.sync;
    if (sync.enabled && sync.autoSync && !syncingRef) {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        syncTimer = null;
        void get().uploadNow();
      }, 1500);
    }
  }, 350);
}

// ------------------------------------------------------------- 数据规整

function sanitizeTemplate(raw: any): PromptTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.content !== 'string' && typeof raw.title !== 'string') return null;
  const now = Date.now();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid('tpl'),
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : '未命名模板',
    description: typeof raw.description === 'string' ? raw.description : undefined,
    content: typeof raw.content === 'string' ? raw.content : '',
    variables: Array.isArray(raw.variables)
      ? raw.variables
          .filter((v: any) => v && typeof v.key === 'string')
          .map((v: any) => ({
            ...v,
            id: typeof v.id === 'string' && v.id ? v.id : uid('var'),
            label: typeof v.label === 'string' && v.label ? v.label : v.key,
            type: v.type ?? 'text',
          }))
      : [],
    categoryId: typeof raw.categoryId === 'string' ? raw.categoryId : null,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: any) => typeof t === 'string') : [],
    favorite: Boolean(raw.favorite),
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
    lastUsedAt: Number.isFinite(raw.lastUsedAt) ? raw.lastUsedAt : null,
    useCount: Number.isFinite(raw.useCount) ? raw.useCount : 0,
  };
}

function sanitizeCategory(raw: any, index: number): Category | null {
  if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string') return null;
  const now = Date.now();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid('cat'),
    name: raw.name,
    color: typeof raw.color === 'string' ? raw.color : CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    order: Number.isFinite(raw.order) ? raw.order : index,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
  };
}

// ------------------------------------------------------------- Store

export const useApp = create<AppState>()((set, get) => ({
  ready: false,
  templates: [],
  categories: [],
  settings: DEFAULT_SETTINGS,
  dataPath: '',

  filter: { kind: 'all' },
  query: '',
  sort: 'updated',
  selectedId: null,
  mode: 'use',
  sidebarCollapsed: false,
  quickUseOpen: false,
  settingsOpen: false,
  toast: null,
  syncVersions: [],
  syncPhase: 'idle',

  init: async () => {
    const [loaded, path] = await Promise.all([loadData(), dataFilePath()]);
    const data = loaded ?? createSampleData();
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...(data.settings ?? {}),
      sync: { ...DEFAULT_SYNC, ...(data.settings?.sync ?? {}) },
    };
    const templates = (data.templates ?? [])
      .map(sanitizeTemplate)
      .filter((t): t is PromptTemplate => t !== null);
    const categories = (data.categories ?? [])
      .map(sanitizeCategory)
      .filter((c): c is Category => c !== null)
      .sort((a, b) => a.order - b.order);

    set({
      ready: true,
      templates,
      categories,
      settings,
      dataPath: path,
      selectedId: templates[0]?.id ?? null,
    });
    saveUiPrefs({ theme: settings.theme, accent: settings.accent });
    // 首次启动会写入示例数据，这里落盘一次
    if (!loaded) scheduleSave(get);
  },

  setFilter: (filter) => set({ filter }),
  setQuery: (query) => set({ query }),
  setSort: (sort) => set({ sort }),
  select: (selectedId) => set({ selectedId }),
  setMode: (mode) => set({ mode }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openQuickUse: (id) =>
    set((s) => ({ quickUseOpen: true, selectedId: id ?? s.selectedId })),
  closeQuickUse: () => set({ quickUseOpen: false }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

  notify: (text, kind = 'success') => {
    const toast: ToastState = { id: uid('toast'), text, kind };
    set({ toast });
    setTimeout(() => {
      if (get().toast?.id === toast.id) set({ toast: null });
    }, 2200);
  },
  dismissToast: () => set({ toast: null }),

  createTemplate: () => {
    const now = Date.now();
    const { filter } = get();
    const tpl: PromptTemplate = {
      id: uid('tpl'),
      title: '未命名模板',
      description: '',
      content: '',
      variables: [],
      categoryId: filter.kind === 'category' ? (filter.value ?? null) : null,
      tags: [],
      favorite: false,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      useCount: 0,
    };
    set((s) => ({
      templates: [tpl, ...s.templates],
      selectedId: tpl.id,
      mode: 'edit',
    }));
    scheduleSave(get);
    return tpl.id;
  },

  updateTemplate: (id, patch) => {
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
      ),
    }));
    scheduleSave(get);
  },

  updateVariables: (id, variables) => {
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, variables, updatedAt: Date.now() } : t,
      ),
    }));
    scheduleSave(get);
  },

  deleteTemplate: (id) => {
    const { templates, selectedId } = get();
    const index = templates.findIndex((t) => t.id === id);
    const next = templates.filter((t) => t.id !== id);
    const nextSelected =
      selectedId === id ? (next[Math.min(index, next.length - 1)]?.id ?? null) : selectedId;
    set({ templates: next, selectedId: nextSelected });
    scheduleSave(get);
  },

  duplicateTemplate: (id) => {
    const src = get().templates.find((t) => t.id === id);
    if (!src) return;
    const now = Date.now();
    const copy: PromptTemplate = {
      ...src,
      id: uid('tpl'),
      title: `${src.title} 副本`,
      variables: src.variables.map((v) => ({ ...v, id: uid('var') })),
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      useCount: 0,
      favorite: false,
    };
    set((s) => ({ templates: [copy, ...s.templates], selectedId: copy.id, mode: 'edit' }));
    scheduleSave(get);
  },

  toggleFavorite: (id) => {
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)),
    }));
    scheduleSave(get);
  },

  registerUse: (id) => {
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, lastUsedAt: Date.now(), useCount: t.useCount + 1 } : t,
      ),
    }));
    persistOnly(get);
  },

  addCategory: (name) => {
    const { categories } = get();
    const cat: Category = {
      id: uid('cat'),
      name: name.trim() || '新分类',
      color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
      order: categories.length,
      updatedAt: Date.now(),
    };
    set({ categories: [...categories, cat] });
    scheduleSave(get);
    return cat.id;
  },

  updateCategory: (id, patch) => {
    set((s) => ({
      categories: s.categories.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
      ),
    }));
    scheduleSave(get);
  },

  deleteCategory: (id) => {
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
      // 分类删除后，模板回到「未分类」，绝不连带删除内容
      templates: s.templates.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
      filter: s.filter.kind === 'category' && s.filter.value === id ? { kind: 'all' } : s.filter,
    }));
    scheduleSave(get);
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    saveUiPrefs({ theme: settings.theme, accent: settings.accent });
    scheduleSave(get);
  },

  updateSyncConfig: (patch) => {
    const sync = { ...get().settings.sync, ...patch };
    set((s) => ({ settings: { ...s.settings, sync } }));
    scheduleSave(get);
  },

  serialize: () => {
    const s = get();
    return JSON.stringify(
      {
        app: 'PromptBox',
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        categories: s.categories,
        templates: s.templates,
        settings: s.settings,
      },
      null,
      2,
    );
  },

  importData: (raw, mode) => {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, message: 'JSON 解析失败，请检查文件格式' };
    }

    const incomingTemplates = (Array.isArray(parsed?.templates) ? parsed.templates : [])
      .map(sanitizeTemplate)
      .filter((t: PromptTemplate | null): t is PromptTemplate => t !== null);
    const incomingCategories = (Array.isArray(parsed?.categories) ? parsed.categories : [])
      .map(sanitizeCategory)
      .filter((c: Category | null): c is Category => c !== null);

    if (incomingTemplates.length === 0 && incomingCategories.length === 0) {
      return { ok: false, message: '文件里没有可导入的模板或分类' };
    }

    if (mode === 'replace') {
      set({
        templates: incomingTemplates,
        categories: incomingCategories,
        selectedId: incomingTemplates[0]?.id ?? null,
        filter: { kind: 'all' },
      });
      scheduleSave(get);
      return {
        ok: true,
        message: `已覆盖导入 ${incomingTemplates.length} 个模板、${incomingCategories.length} 个分类`,
      };
    }

    // 合并：id 冲突则重新分配 id，避免覆盖已有内容
    const existingTplIds = new Set(get().templates.map((t) => t.id));
    const existingCatIds = new Set(get().categories.map((c) => c.id));
    const catIdMap = new Map<string, string>();

    const mergedCategories = [...get().categories];
    for (const cat of incomingCategories) {
      if (existingCatIds.has(cat.id)) {
        const sameName = mergedCategories.find((c) => c.name === cat.name);
        if (sameName) {
          catIdMap.set(cat.id, sameName.id);
          continue;
        }
        const newId = uid('cat');
        catIdMap.set(cat.id, newId);
        mergedCategories.push({ ...cat, id: newId, order: mergedCategories.length });
      } else {
        mergedCategories.push({ ...cat, order: mergedCategories.length });
      }
    }

    const mergedTemplates = [...get().templates];
    let added = 0;
    for (const tpl of incomingTemplates) {
      const id = existingTplIds.has(tpl.id) ? uid('tpl') : tpl.id;
      const categoryId = tpl.categoryId ? (catIdMap.get(tpl.categoryId) ?? tpl.categoryId) : null;
      mergedTemplates.unshift({ ...tpl, id, categoryId });
      added += 1;
    }

    set({ templates: mergedTemplates, categories: mergedCategories });
    scheduleSave(get);
    return { ok: true, message: `已合并导入 ${added} 个模板` };
  },

  testWebDav: () => runTestWebDav(get().settings.sync),

  uploadNow: async () => {
    const cfg = get().settings.sync;
    if (!cfg.enabled) return;
    if (syncingRef) return;
    syncingRef = true;
    set({ syncPhase: 'uploading' });

    try {
      const local: LocalSnapshot = { categories: get().categories, templates: get().templates };
      const outcome = await uploadOnly(local, cfg);
      const nextSync: SyncConfig = {
        ...cfg,
        lastSyncAt: Date.now(),
        lastStatus: outcome.status,
        lastMessage: outcome.message,
        lastEtag: outcome.etag,
      };
      set((s) => ({ settings: { ...s.settings, sync: nextSync }, syncPhase: 'idle' }));
      get().notify(outcome.message, outcome.ok ? 'success' : 'error');
      persistOnly(get); // 落盘，但不再触发自动同步
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextSync: SyncConfig = { ...cfg, lastStatus: 'error', lastMessage: message };
      set((s) => ({ settings: { ...s.settings, sync: nextSync }, syncPhase: 'idle' }));
      get().notify(`上传出错：${message}`, 'error');
      persistOnly(get);
    } finally {
      syncingRef = false;
    }
  },

  downloadNow: async () => {
    const cfg = get().settings.sync;
    if (!cfg.enabled) return;
    if (syncingRef) return;
    syncingRef = true;
    set({ syncPhase: 'downloading' });

    try {
      const local: LocalSnapshot = { categories: get().categories, templates: get().templates };
      const outcome = await downloadOnly(local, cfg);
      if (outcome.ok && outcome.merged) {
        const merged = outcome.merged;
        const nextSync: SyncConfig = {
          ...cfg,
          lastSyncAt: Date.now(),
          lastStatus: 'success',
          lastMessage: outcome.message,
          lastEtag: outcome.etag,
        };
        set((s) => ({
          categories: merged.categories,
          templates: merged.templates,
          settings: { ...s.settings, sync: nextSync },
          syncPhase: 'idle',
        }));
        get().notify(outcome.message, 'success');
        persistOnly(get);
      } else {
        const nextSync: SyncConfig = { ...cfg, lastStatus: outcome.status, lastMessage: outcome.message };
        set((s) => ({ settings: { ...s.settings, sync: nextSync }, syncPhase: 'idle' }));
        get().notify(outcome.message, 'error');
        persistOnly(get);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextSync: SyncConfig = { ...cfg, lastStatus: 'error', lastMessage: message };
      set((s) => ({ settings: { ...s.settings, sync: nextSync }, syncPhase: 'idle' }));
      get().notify(`拉取出错：${message}`, 'error');
      persistOnly(get);
    } finally {
      syncingRef = false;
    }
  },

  listVersions: async () => {
    const cfg = get().settings.sync;
    if (!cfg.enabled) return;
    if (versionLoadingRef) return;
    versionLoadingRef = true;
    try {
      const list = await listRemoteVersions(cfg);
      set({ syncVersions: list });
    } catch (err) {
      set({ syncVersions: [] });
      const message = err instanceof Error ? err.message : String(err);
      get().notify(`历史版本加载失败：${message}`, 'error');
    } finally {
      versionLoadingRef = false;
    }
  },

  restoreVersion: async (url) => {
    const cfg = get().settings.sync;
    if (!cfg.enabled) return;
    if (syncingRef) return;
    syncingRef = true;
    set({ syncPhase: 'restoring' });

    try {
      const local: LocalSnapshot = { categories: get().categories, templates: get().templates };
      const outcome = await restoreRemoteVersion(cfg, url, local);
      if (outcome.ok && outcome.merged) {
        const merged = outcome.merged;
        const nextSync: SyncConfig = {
          ...cfg,
          lastSyncAt: Date.now(),
          lastStatus: 'success',
          lastMessage: outcome.message,
        };
        set((s) => ({
          categories: merged.categories,
          templates: merged.templates,
          settings: { ...s.settings, sync: nextSync },
          syncPhase: 'idle',
        }));
        get().notify(outcome.message, 'success');
        persistOnly(get);
        void get().listVersions(); // 恢复后刷新版本列表
      } else {
        const nextSync: SyncConfig = { ...cfg, lastStatus: outcome.status, lastMessage: outcome.message };
        set((s) => ({ settings: { ...s.settings, sync: nextSync }, syncPhase: 'idle' }));
        get().notify(outcome.message, 'error');
        persistOnly(get);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextSync: SyncConfig = { ...cfg, lastStatus: 'error', lastMessage: message };
      set((s) => ({ settings: { ...s.settings, sync: nextSync }, syncPhase: 'idle' }));
      get().notify(`恢复出错：${message}`, 'error');
      persistOnly(get);
    } finally {
      syncingRef = false;
    }
  },
}));

/** 便捷选择器：当前选中的模板 */
export function useSelectedTemplate(): PromptTemplate | null {
  return useApp((s) => s.templates.find((t) => t.id === s.selectedId) ?? null);
}
