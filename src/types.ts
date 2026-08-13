/**
 * PromptBox 数据模型
 *
 * 设计原则：
 * 1. 纯 JSON 可序列化 —— 本地 JSON 文件、SQLite、未来的云同步都能直接承载。
 * 2. 变量类型开放扩展 —— 新增类型只需扩展 VariableType 与对应渲染器，模型不动。
 * 3. 每条记录自带 id / 时间戳，为将来的多端同步（last-write-wins 或 CRDT）留好锚点。
 */

/** 变量类型。新增类型时在此扩展，并在 lib/variableTypes.ts 与 VariableField 中登记。 */
export type VariableType =
  | 'text' // 单行文本
  | 'textarea' // 多行文本
  | 'select' // 下拉单选
  | 'multiselect' // 多选
  | 'toggle' // 开关 / 布尔
  | 'number' // 数字
  | 'date'; // 日期

/** 变量取值：受类型约束的联合 */
export type VariableValue = string | number | boolean | string[] | null;

/** 下拉 / 多选的选项 */
export interface VariableOption {
  id: string;
  /** 展示给用户的文案 */
  label: string;
  /** 实际插入提示词的值；留空则回退到 label */
  value: string;
}

export interface TemplateVariable {
  id: string;
  /** 在正文中通过 {{key}} 引用，仅允许字母数字下划线连字符 */
  key: string;
  /** 表单里显示的名称 */
  label: string;
  type: VariableType;
  /** 表单中的辅助说明 */
  description?: string;
  /** 输入框占位符 */
  placeholder?: string;
  required?: boolean;
  defaultValue?: VariableValue;

  // ---- select / multiselect ----
  options?: VariableOption[];
  /** multiselect 拼接多个值时使用的分隔符，默认 "、" */
  separator?: string;

  // ---- number ----
  min?: number;
  max?: number;
  step?: number;
  /** 数字单位后缀，例如 "字" -> "500字" */
  unit?: string;

  // ---- toggle ----
  /** 开关打开时插入的文本（留空则插入 "是"） */
  onText?: string;
  /** 开关关闭时插入的文本（留空则插入空串） */
  offText?: string;

  // ---- date ----
  /** 日期格式：YYYY-MM-DD / YYYY年M月D日 / MM/DD/YYYY */
  dateFormat?: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description?: string;
  /** 提示词正文，支持 {{key}} 占位与 {{#if key}}…{{/if}} 条件块 */
  content: string;
  variables: TemplateVariable[];
  categoryId: string | null;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
  useCount: number;
}

export interface Category {
  id: string;
  name: string;
  /** 分类色点，十六进制 */
  color: string;
  order: number;
  /** 修改时间（ms），用于多端同步的 last-write-wins */
  updatedAt: number;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePreference;
  /** 强调色（十六进制） */
  accent: string;
  /** 全局快捷键，仅作展示与后续可配置化，实际注册在 Rust 侧 */
  globalShortcut: string;
  /** 复制后是否自动隐藏窗口（快捷键唤起场景很实用） */
  hideAfterCopy: boolean;
  /** 云端同步配置（设备私有，不同步到远端） */
  sync: SyncConfig;
}

/**
 * WebDAV 同步配置。
 * 注意：账号密码仅保存在本机（浏览器 localStorage / 桌面本地文件），不会上传、也不会进入同步文件。
 */
export interface SyncConfig {
  enabled: boolean;
  /** WebDAV 服务根地址，例如 https://dav.example.com */
  url: string;
  username: string;
  password: string;
  /** 远端文件路径，例如 /promptbox/promptbox.json */
  remotePath: string;
  /** 数据变更后是否自动同步 */
  autoSync: boolean;
  /** 上次成功同步时间（ms） */
  lastSyncAt: number | null;
  /** 上次同步结果状态 */
  lastStatus: SyncStatus;
  /** 上次同步结果描述 */
  lastMessage: string;
  /**
   * 上次成功同步后的实体 id 集合（预留给未来的「删除传播」升级）。
   * v1 采用「新增/编辑双向同步 + 按 updatedAt 取新」策略，删除暂不通步。
   */
  baselineTemplates: string[];
  baselineCategories: string[];
  /** 远端文件 etag，PUT 时用于乐观并发（If-Match） */
  lastEtag: string | null;
}

export type SyncStatus = 'idle' | 'success' | 'error' | 'conflict';

/** 同步进行中的瞬态阶段（不持久化） */
export type SyncPhase = 'idle' | 'uploading' | 'downloading' | 'restoring';

/** WebDAV 服务器上的一个历史版本（自维护 versions 目录） */
export interface VersionEntry {
  /** 文件名，例如 promptbox-1691923920000.json */
  name: string;
  /** 完整文件 URL，用于 GET / DELETE */
  path: string;
  /** 远端最后修改时间（ms） */
  modified: number;
  /** 文件大小（字节，可选） */
  size?: number;
}

/** WebDAV 同步默认值（设备私有，不同步到远端） */
export const DEFAULT_SYNC: SyncConfig = {
  enabled: false,
  url: '',
  username: '',
  password: '',
  remotePath: '/promptbox/promptbox.json',
  autoSync: true,
  lastSyncAt: null,
  lastStatus: 'idle',
  lastMessage: '',
  baselineTemplates: [],
  baselineCategories: [],
  lastEtag: null,
};

/** 远端存储的数据文件结构（不含设备私有 settings 与同步基线） */
export interface RemoteData {
  app: 'PromptBox';
  schemaVersion: number;
  exportedAt: string;
  categories: Category[];
  templates: PromptTemplate[];
}

export interface AppData {
  schemaVersion: number;
  templates: PromptTemplate[];
  categories: Category[];
  settings: Settings;
}

/** 中间列表的筛选维度 */
export type FilterKind =
  | 'all'
  | 'favorites'
  | 'recent'
  | 'uncategorized'
  | 'category'
  | 'tag';

export interface ListFilter {
  kind: FilterKind;
  /** category / tag 时携带对应 id 或标签名 */
  value?: string;
}

export type SortKey = 'updated' | 'created' | 'title' | 'used';

/** 导入策略 */
export type ImportMode = 'merge' | 'replace';
