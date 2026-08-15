import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp, useSelectedTemplate } from './store/useApp';
import { relativeTime } from './lib/query';
import { Icon } from './components/Icon';
import { Sidebar } from './components/Sidebar';
import { TemplateList } from './components/TemplateList';
import { TemplateRunner } from './components/TemplateRunner';
import { TemplateEditor } from './components/TemplateEditor';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmDialog, EmptyState, Modal } from './components/ui';

/* ==========================================================================
   主题：把设置里的 theme / accent 同步到 <html>
   ========================================================================== */

function useThemeSync() {
  const theme = useApp((s) => s.settings.theme);
  const accent = useApp((s) => s.settings.accent);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
  }, [accent]);
}

/* ==========================================================================
   面板宽度：拖拽调整 + 记忆
   ========================================================================== */

const LS_LAYOUT = 'promptbox.layout';
const LIMITS = { sidebar: [180, 340], list: [240, 520] } as const;

type PaneKey = 'sidebar' | 'list';

function useLayout() {
  const [widths, setWidths] = useState<Record<PaneKey, number>>(() => {
    try {
      const raw = localStorage.getItem(LS_LAYOUT);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          sidebar: clamp(p.sidebar ?? 232, LIMITS.sidebar[0], LIMITS.sidebar[1]),
          list: clamp(p.list ?? 320, LIMITS.list[0], LIMITS.list[1]),
        };
      }
    } catch {
      /* 忽略损坏的偏好 */
    }
    return { sidebar: 232, list: 320 };
  });

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--w-sidebar', `${widths.sidebar}px`);
    root.style.setProperty('--w-list', `${widths.list}px`);
    try {
      localStorage.setItem(LS_LAYOUT, JSON.stringify(widths));
    } catch {
      /* 忽略 */
    }
  }, [widths]);

  const resize = useCallback((key: PaneKey, next: number) => {
    const [min, max] = LIMITS[key];
    setWidths((prev) => ({ ...prev, [key]: clamp(next, min, max) }));
  }, []);

  return { widths, resize };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

interface ResizerProps {
  onDrag: (deltaX: number) => void;
  label: string;
}

function Resizer({ onDrag, label }: ResizerProps) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      onDrag(e.clientX - startX.current);
      startX.current = e.clientX;
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, onDrag]);

  return (
    <div
      className="resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      data-dragging={dragging}
      onMouseDown={(e) => {
        startX.current = e.clientX;
        setDragging(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onDrag(-16);
        if (e.key === 'ArrowRight') onDrag(16);
      }}
      tabIndex={0}
    />
  );
}

/* ==========================================================================
   顶栏
   ========================================================================== */

function TopBar({ searchRef }: { searchRef: React.RefObject<HTMLInputElement | null> }) {
  const query = useApp((s) => s.query);
  const setQuery = useApp((s) => s.setQuery);
  const sidebarCollapsed = useApp((s) => s.sidebarCollapsed);
  const toggleSidebar = useApp((s) => s.toggleSidebar);
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const syncPhase = useApp((s) => s.syncPhase);
  const sync = useApp((s) => s.settings.sync);
  const uploadNow = useApp((s) => s.uploadNow);

  const cycleTheme = () => {
    const order = ['system', 'light', 'dark'] as const;
    const next = order[(order.indexOf(settings.theme) + 1) % order.length];
    updateSettings({ theme: next });
  };

  const themeIcon = settings.theme === 'dark' ? 'moon' : settings.theme === 'light' ? 'sun' : 'monitor';
  const themeLabel =
    settings.theme === 'dark' ? '深色' : settings.theme === 'light' ? '浅色' : '跟随系统';

  return (
    <header className="topbar">
      <button
        className="icon-btn"
        onClick={toggleSidebar}
        aria-pressed={sidebarCollapsed}
        title={sidebarCollapsed ? '显示侧栏 (Ctrl+B)' : '隐藏侧栏 (Ctrl+B)'}
      >
        <Icon name="panelLeft" />
      </button>

      <div className="topbar__brand">
        <span className="brand-mark">
          <Icon name="braces" size={13} strokeWidth={2.2} />
        </span>
        <span className="brand-name">PromptBox</span>
      </div>

      <div className="topbar__spacer" />

      <div className="topbar__search">
        <Icon name="search" size={14} className="icon-left" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.currentTarget.blur();
              setQuery('');
            }
          }}
          placeholder="搜索标题、正文、标签…  Ctrl+K"
          spellCheck={false}
          aria-label="搜索模板"
        />
        {query && (
          <button className="icon-btn icon-btn--sm clear-btn" onClick={() => setQuery('')} title="清空">
            <Icon name="x" size={13} />
          </button>
        )}
      </div>

      <div className="topbar__spacer" />

      <button className="icon-btn" onClick={cycleTheme} title={`主题：${themeLabel}`}>
        <Icon name={themeIcon} />
      </button>
      <button
        className={`icon-btn ${syncPhase !== 'idle' ? 'is-busy' : ''} ${
          sync.lastStatus === 'error' ? 'is-err' : ''
        }`}
        onClick={() => (sync.enabled ? uploadNow() : setSettingsOpen(true))}
        title={
          sync.enabled
            ? `云端同步：${
                syncPhase !== 'idle'
                  ? syncPhase === 'uploading'
                    ? '上传中…'
                    : syncPhase === 'downloading'
                      ? '拉取中…'
                      : syncPhase === 'restoring'
                        ? '恢复中…'
                        : '处理中…'
                  : sync.lastStatus === 'success'
                    ? `已同步${sync.lastSyncAt ? `（${relativeTime(sync.lastSyncAt)}）` : ''}`
                    : sync.lastStatus === 'error'
                      ? `上次失败：${sync.lastMessage || ''}`
                      : '点击上传到云端'
              }`
            : '未开启同步，点击去设置'
        }
      >
        {syncPhase !== 'idle' ? (
          <Icon name="refresh" className="sync-spin" />
        ) : (
          <Icon name="cloud" />
        )}
      </button>
      <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="设置">
        <Icon name="sliders" />
      </button>
    </header>
  );
}

/* ==========================================================================
   右栏：使用 / 编辑
   ========================================================================== */

function DetailPane() {
  const template = useSelectedTemplate();
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const createTemplate = useApp((s) => s.createTemplate);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const duplicateTemplate = useApp((s) => s.duplicateTemplate);
  const deleteTemplate = useApp((s) => s.deleteTemplate);
  const openQuickUse = useApp((s) => s.openQuickUse);
  const notify = useApp((s) => s.notify);

  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!template) {
    return (
      <section className="detail-pane">
        <div className="detail-body" style={{ display: 'grid', placeItems: 'center' }}>
          <EmptyState
            icon="sparkles"
            title="选一个模板开始"
            desc={
              <>
                左侧挑一个，或者新建一个属于你的提示词模板。
                <br />
                正文里用 <code className="code-hint">{'{{变量名}}'}</code> 占位，使用时会自动生成表单。
              </>
            }
            action={
              <button className="btn btn--primary" onClick={() => createTemplate()}>
                <Icon name="plus" size={14} />
                新建模板
              </button>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="detail-pane">
      <header className="detail-head">
        <div className="detail-head__title" title={template.title}>
          {template.title}
        </div>

        <div className="segmented">
          <button aria-pressed={mode === 'use'} onClick={() => setMode('use')}>
            使用
          </button>
          <button aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
            编辑
          </button>
        </div>

        <button
          className="icon-btn icon-btn--star"
          aria-pressed={template.favorite}
          onClick={() => toggleFavorite(template.id)}
          title={template.favorite ? '取消收藏' : '收藏'}
        >
          <Icon name="star" solid={template.favorite} />
        </button>
        <button
          className="icon-btn"
          onClick={() => openQuickUse(template.id)}
          title="在弹窗里快速使用"
        >
          <Icon name="play" />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            duplicateTemplate(template.id);
            notify('已创建副本');
          }}
          title="创建副本"
        >
          <Icon name="copy" />
        </button>
        <button
          className="icon-btn icon-btn--danger"
          onClick={() => setConfirmDelete(true)}
          title="删除模板"
        >
          <Icon name="trash" />
        </button>
      </header>

      <div className="detail-body">
        {mode === 'use' ? (
          <TemplateRunner template={template} />
        ) : (
          <TemplateEditor template={template} />
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="删除模板"
          danger
          confirmText="删除"
          message={
            <>
              确定要删除「{template.title}」吗？这个操作不可撤销。
              <br />
              如果只是暂时不用，可以先取消收藏或换个分类。
            </>
          }
          onConfirm={() => {
            setConfirmDelete(false);
            deleteTemplate(template.id);
            notify('模板已删除', 'info');
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </section>
  );
}

/* ==========================================================================
   快速使用弹窗（全局快捷键唤起的主场景）
   ========================================================================== */

function QuickUseModal() {
  const template = useSelectedTemplate();
  const closeQuickUse = useApp((s) => s.closeQuickUse);

  if (!template) return null;

  return (
    <Modal
      wide
      flush
      onClose={closeQuickUse}
      title={template.title}
    >
      <div style={{ height: 'min(560px, 72vh)', containerType: 'inline-size' }}>
        <TemplateRunner
          template={template}
          compact
        />
      </div>
    </Modal>
  );
}

/* ==========================================================================
   Toast
   ========================================================================== */

function ToastHost() {
  const toast = useApp((s) => s.toast);
  const dismiss = useApp((s) => s.dismissToast);
  if (!toast) return null;
  return (
    <div className="toast-host">
      <div className={`toast toast--${toast.kind}`} role="status" onClick={dismiss}>
        <span className="toast__dot" />
        {toast.text}
      </div>
    </div>
  );
}

/* ==========================================================================
   App
   ========================================================================== */

export function App() {
  const ready = useApp((s) => s.ready);
  const init = useApp((s) => s.init);
  const sidebarCollapsed = useApp((s) => s.sidebarCollapsed);
  const quickUseOpen = useApp((s) => s.quickUseOpen);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const openQuickUse = useApp((s) => s.openQuickUse);
  const createTemplate = useApp((s) => s.createTemplate);
  const toggleSidebar = useApp((s) => s.toggleSidebar);
  const setMode = useApp((s) => s.setMode);

  const { widths, resize } = useLayout();
  const searchRef = useRef<HTMLInputElement | null>(null);

  useThemeSync();

  useEffect(() => {
    void init();
  }, [init]);

  // 应用内快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (key === 'n') {
        e.preventDefault();
        createTemplate();
      } else if (key === 'b') {
        e.preventDefault();
        toggleSidebar();
      } else if (key === 'e') {
        e.preventDefault();
        setMode('edit');
      } else if (key === 'p' && e.shiftKey) {
        // 桌面端由 Rust 侧注册全局快捷键；这里让窗口内按下也能唤起弹窗
        e.preventDefault();
        openQuickUse();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createTemplate, toggleSidebar, setMode, openQuickUse]);

  if (!ready) {
    return (
      <div className="app" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>正在载入…</div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar searchRef={searchRef} />

      <div className="workspace">
        {!sidebarCollapsed && (
          <>
            <Sidebar />
            <Resizer label="调整侧栏宽度" onDrag={(dx) => resize('sidebar', widths.sidebar + dx)} />
          </>
        )}

        <TemplateList />
        <Resizer label="调整列表宽度" onDrag={(dx) => resize('list', widths.list + dx)} />

        <DetailPane />
      </div>

      {quickUseOpen && <QuickUseModal />}
      {settingsOpen && <SettingsModal />}
      <ToastHost />
    </div>
  );
}
