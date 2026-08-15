import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/useApp';
import { exportToFile, importFromFile } from '../lib/storage';
import { relativeTime } from '../lib/query';
import type { ImportMode, ThemePreference, VersionEntry } from '../types';
import { Icon } from './Icon';
import { ConfirmDialog, Modal, Switch } from './ui';

/** 版本时间格式化（本地时区，YYYY-MM-DD HH:mm:ss） */
function formatVersionDate(n: number): string {
  if (!n) return '未知时间';
  const d = new Date(n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

function versionLabel(v: VersionEntry): string {
  return `${formatVersionDate(v.modified)}${v.size ? ` · ${(v.size / 1024).toFixed(1)} KB` : ''}`;
}

const THEMES: { value: ThemePreference; label: string; icon: 'sun' | 'moon' | 'monitor' }[] = [
  { value: 'system', label: '跟随系统', icon: 'monitor' },
  { value: 'light', label: '浅色', icon: 'sun' },
  { value: 'dark', label: '深色', icon: 'moon' },
];

const ACCENTS = [
  { value: '#2563eb', name: '蓝' },
  { value: '#16a34a', name: '绿' },
  { value: '#0891b2', name: '青' },
  { value: '#7c3aed', name: '紫' },
  { value: '#db2777', name: '玫红' },
  { value: '#ea580c', name: '橙' },
  { value: '#475569', name: '石墨' },
];

export function SettingsModal() {
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const dataPath = useApp((s) => s.dataPath);
  const serialize = useApp((s) => s.serialize);
  const importData = useApp((s) => s.importData);
  const clearAllData = useApp((s) => s.clearAllData);
  const notify = useApp((s) => s.notify);
  const templates = useApp((s) => s.templates);
  const categories = useApp((s) => s.categories);
  const sync = useApp((s) => s.settings.sync);
  const updateSyncConfig = useApp((s) => s.updateSyncConfig);
  const uploadNow = useApp((s) => s.uploadNow);
  const downloadNow = useApp((s) => s.downloadNow);
  const listVersions = useApp((s) => s.listVersions);
  const restoreVersion = useApp((s) => s.restoreVersion);
  const syncVersions = useApp((s) => s.syncVersions);
  const testWebDav = useApp((s) => s.testWebDav);
  const syncPhase = useApp((s) => s.syncPhase);

  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [connMsg, setConnMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const pendingImport = useRef<{ name: string; content: string } | null>(null);
  const versionSelectRef = useRef<HTMLDivElement | null>(null);
  const [askMode, setAskMode] = useState(false);
  const [clearAsk, setClearAsk] = useState(false);

  // 开启同步后自动拉取版本列表
  useEffect(() => {
    if (sync.enabled) {
      void listVersions();
    } else {
      setSelectedVersion('');
    }
    // 仅在开关状态变化时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.enabled]);

  // 版本列表更新后，自动选中第一个（仅当当前无有效选中时）
  useEffect(() => {
    if (syncVersions.length && !syncVersions.some((v) => v.path === selectedVersion)) {
      setSelectedVersion(syncVersions[0].path);
    }
  }, [syncVersions, selectedVersion]);

  // 历史版本自定义下拉：点击外部或按 Esc 关闭
  useEffect(() => {
    if (!versionMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (versionSelectRef.current && !versionSelectRef.current.contains(e.target as Node)) {
        setVersionMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVersionMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [versionMenuOpen]);

  const close = () => setSettingsOpen(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const target = await exportToFile(serialize(), `promptbox-${stamp}.json`);
      if (target) notify(`已导出到 ${target}`);
    } catch (err) {
      console.error(err);
      notify('导出失败，请重试', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePickFile = async () => {
    setBusy(true);
    try {
      const picked = await importFromFile();
      if (!picked) return;
      pendingImport.current = picked;
      setAskMode(true);
    } catch (err) {
      console.error(err);
      notify('读取文件失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runImport = (mode: ImportMode) => {
    const picked = pendingImport.current;
    setAskMode(false);
    pendingImport.current = null;
    if (!picked) return;
    const result = importData(picked.content, mode);
    notify(result.message, result.ok ? 'success' : 'error');
  };

  const varCount = templates.reduce((sum, t) => sum + t.variables.length, 0);

  const handleTest = async () => {
    setSyncBusy(true);
    setConnMsg(null);
    try {
      const res = await testWebDav();
      setConnMsg({ ok: res.ok, text: res.message });
    } finally {
      setSyncBusy(false);
    }
  };

  const handleUpload = async () => {
    setSyncBusy(true);
    try {
      await uploadNow();
    } finally {
      setSyncBusy(false);
    }
  };

  const handleDownload = async () => {
    setSyncBusy(true);
    try {
      await downloadNow();
    } finally {
      setSyncBusy(false);
    }
  };

  const handleRefreshVersions = async () => {
    setSyncBusy(true);
    try {
      await listVersions();
    } finally {
      setSyncBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedVersion) return;
    setSyncBusy(true);
    try {
      await restoreVersion(selectedVersion);
    } finally {
      setSyncBusy(false);
    }
  };

  const phaseLabel: Record<string, string> = {
    uploading: '上传中…',
    downloading: '拉取中…',
    restoring: '恢复中…',
  };

  return (
    <>
      <Modal
        title={
          <>
            <Icon name="sliders" size={15} />
            设置
          </>
        }
        onClose={close}
        footer={
          <>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              {templates.length} 个模板 · {categories.length} 个分类 · {varCount} 个变量
            </span>
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={close}>
              完成
            </button>
          </>
        }
      >
        {/* ---------------- 外观 ---------------- */}
        <div className="settings-row">
          <div>
            <div className="settings-row__label">主题</div>
            <div className="settings-row__desc">默认跟随系统的深浅色</div>
          </div>
          <div className="settings-row__control">
            <div className="segmented">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  aria-pressed={settings.theme === t.value}
                  onClick={() => updateSettings({ theme: t.value })}
                  title={t.label}
                >
                  <span
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <Icon name={t.icon} size={13} />
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row__label">强调色</div>
            <div className="settings-row__desc">界面里唯一的彩色，其余保持中性灰</div>
          </div>
          <div className="settings-row__control">
            <div className="swatches">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  className="swatch"
                  style={{ background: a.value }}
                  aria-pressed={settings.accent.toLowerCase() === a.value}
                  onClick={() => updateSettings({ accent: a.value })}
                  title={a.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ---------------- 云端同步（WebDAV） ---------------- */}
        <div className="settings-row settings-row--stack">
          <div className="settings-row__head">
            <div>
              <div className="settings-row__label">云端同步（WebDAV）</div>
              <div className="settings-row__desc">
                把数据同步到任意 WebDAV 服务（Nextcloud、群晖、InfiniCLOUD 等）。账号密码仅存本机。
              </div>
            </div>
            <Switch
              checked={sync.enabled}
              onChange={(v) => {
                if (v) {
                  if (!sync.url.trim() || !sync.username.trim() || !sync.password.trim()) {
                    notify('配置不可为空！', 'error');
                    return;
                  }
                }
                updateSyncConfig({ enabled: v });
              }}
            />
          </div>

          <div className="sync-grid">
              <label className="field">
                <span className="field__label">服务器地址</span>
                <input
                  className="input"
                  value={sync.url}
                  placeholder="https://dav.example.com"
                  spellCheck={false}
                  onChange={(e) => updateSyncConfig({ url: e.target.value.trim() })}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span className="field__label">账号</span>
                  <input
                    className="input"
                    value={sync.username}
                    placeholder="用户名"
                    spellCheck={false}
                    autoComplete="username"
                    onChange={(e) => updateSyncConfig({ username: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field__label">密码</span>
                  <div className="input-affix">
                    <input
                      className="input"
                      type={showPwd ? 'text' : 'password'}
                      value={sync.password}
                      placeholder="密码"
                      autoComplete="current-password"
                      onChange={(e) => updateSyncConfig({ password: e.target.value })}
                    />
                    <button
                      type="button"
                      className="input-affix__btn"
                      onClick={() => setShowPwd((v) => !v)}
                      title={showPwd ? '隐藏' : '显示'}
                    >
                      <Icon name={showPwd ? 'eye' : 'eyeOff'} size={14} />
                    </button>
                  </div>
                </label>
              </div>
              <label className="field">
                <span className="field__label">远端文件路径</span>
                <input
                  className="input"
                  value={sync.remotePath}
                  placeholder="/promptbox/promptbox.json"
                  spellCheck={false}
                  onChange={(e) => updateSyncConfig({ remotePath: e.target.value.trim() })}
                />
              </label>

              <div className="field-row field-row--between">
                <label className="inline-check">
                  <Switch
                    checked={sync.autoSync}
                    onChange={(v) => updateSyncConfig({ autoSync: v })}
                  />
                  <span>改动后自动同步</span>
                </label>
                <div className="sync-actions">
                  <button className="btn" onClick={handleTest} disabled={syncBusy || !sync.enabled}>
                    {syncBusy && syncPhase !== 'uploading' && syncPhase !== 'downloading' && syncPhase !== 'restoring'
                      ? '检测中…'
                      : '测试连接'}
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={handleUpload}
                    disabled={syncBusy || !sync.enabled}
                    title="把本机数据上传到云端"
                  >
                    {syncPhase === 'uploading' ? (
                      <>
                        <Icon name="refresh" size={14} className="sync-spin" />
                        上传中…
                      </>
                    ) : (
                      <>
                        <Icon name="upload" size={14} />
                        上传
                      </>
                    )}
                  </button>
                  <button
                    className="btn"
                    onClick={handleDownload}
                    disabled={syncBusy || !sync.enabled}
                    title="把云端数据合并到本机"
                  >
                    {syncPhase === 'downloading' ? (
                      <>
                        <Icon name="refresh" size={14} className="sync-spin" />
                        拉取中…
                      </>
                    ) : (
                      <>
                        <Icon name="download" size={14} />
                        拉取
                      </>
                    )}
                  </button>
                </div>
              </div>

              {connMsg && (
                <div className={`sync-conn ${connMsg.ok ? 'is-ok' : 'is-err'}`}>
                  <Icon name={connMsg.ok ? 'check' : 'alert'} size={13} />
                  {connMsg.text}
                </div>
              )}

              {(sync.lastSyncAt || sync.lastMessage) && (
                <div className={`sync-status sync-status--${sync.lastStatus}`}>
                  {syncPhase !== 'idle' ? (
                    <>
                      <Icon name="refresh" size={13} className="sync-spin" />
                      {phaseLabel[syncPhase] ?? '处理中…'}
                    </>
                  ) : (
                    <>
                      <Icon
                        name={
                          sync.lastStatus === 'success'
                            ? 'cloud'
                            : sync.lastStatus === 'error'
                              ? 'alert'
                              : sync.lastStatus === 'conflict'
                                ? 'alert'
                                : 'cloud'
                        }
                        size={13}
                      />
                      <span>
                        {sync.lastSyncAt
                          ? `上次操作：${relativeTime(sync.lastSyncAt)}`
                          : '尚未同步'}
                        {sync.lastMessage ? ` · ${sync.lastMessage}` : ''}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* -------- 历史版本 -------- */}
              <div className="version-block">
                <div className="settings-row__head">
                  <div>
                    <div className="settings-row__label">历史版本</div>
                    <div className="settings-row__tip">云端保留最近 10 个快照，满了自动删除最早的</div>
                  </div>
                  <button
                    className="btn btn--ghost"
                    onClick={handleRefreshVersions}
                    disabled={syncBusy || !sync.enabled}
                    title="刷新版本列表"
                  >
                    <Icon name="refresh" size={13} />
                  </button>
                </div>

                {syncVersions.length === 0 ? (
                  <div className="version-empty">
                    {sync.enabled ? '暂无历史版本，上传后会自动生成' : '开启同步后可查看历史版本'}
                  </div>
                ) : (
                  <>
                    <div className="version-select" ref={versionSelectRef}>
                      <button
                        type="button"
                        className="select version-select__trigger"
                        onClick={() => !syncBusy && setVersionMenuOpen((o) => !o)}
                        disabled={syncBusy}
                        aria-haspopup="listbox"
                        aria-expanded={versionMenuOpen}
                      >
                        <span className="version-select__value">
                          {selectedVersion
                            ? versionLabel(
                                syncVersions.find((v) => v.path === selectedVersion) ?? syncVersions[0],
                              )
                            : '请选择版本'}
                        </span>
                        <Icon name="chevronDown" size={13} className="version-select__chevron" />
                      </button>
                      {versionMenuOpen && (
                        <div className="version-select__menu" role="listbox">
                          {syncVersions.map((v: VersionEntry) => (
                            <button
                              type="button"
                              key={v.path}
                              role="option"
                              aria-selected={v.path === selectedVersion}
                              className={
                                'version-select__option' +
                                (v.path === selectedVersion ? ' is-selected' : '')
                              }
                              onClick={() => {
                                setSelectedVersion(v.path);
                                setVersionMenuOpen(false);
                              }}
                            >
                              {versionLabel(v)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="btn"
                      onClick={handleRestore}
                      disabled={syncBusy || !selectedVersion}
                      title="把选中版本合并恢复到本机"
                    >
                      {syncPhase === 'restoring' ? (
                        <>
                          <Icon name="refresh" size={14} className="sync-spin" />
                          恢复中…
                        </>
                      ) : (
                        <>
                          <Icon name="clock" size={14} />
                          恢复此版本
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>

              <div className="settings-row__desc">
                说明：上传会把本机数据写到云端并生成一个带时间戳的快照；拉取会把云端数据合并到本机（按修改时间取较新者）。
                删除暂不通步，需在各端分别删除。浏览器直连时请确保服务已放开 CORS（允许 GET/PUT/PROPFIND 与 Authorization）。
              </div>
            </div>
        </div>

        {/* ---------------- 数据 ---------------- */}
        <div className="settings-row">
          <div>
            <div className="settings-row__label">数据备份</div>
            <div className="settings-row__desc">导出为 JSON，可在另一台机器上导入</div>
          </div>
          <div className="settings-row__control">
            <button className="btn" onClick={handleExport} disabled={busy}>
              <Icon name="download" size={14} />
              导出
            </button>
            <button className="btn" onClick={handlePickFile} disabled={busy}>
              <Icon name="upload" size={14} />
              导入
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="settings-row__label">数据存放位置</div>
            <div className="path-box" title={dataPath}>
              {dataPath || '加载中…'}
            </div>
            <div className="settings-row__desc" style={{ marginTop: 6 }}>
              全部内容都保存在本机。开启 WebDAV 后会同步到你的云端，账号密码仅留在本机。
            </div>
          </div>
        </div>

        {/* ---------------- 危险区 ---------------- */}
        <div className="settings-row settings-row--danger">
          <div>
            <div className="settings-row__label">清空全部数据</div>
            <div className="settings-row__desc">
              删除所有模板和分类（设置保留），此操作不可恢复，建议先「导出」备份
            </div>
          </div>
          <div className="settings-row__control">
            <button className="btn btn--danger" onClick={() => setClearAsk(true)}>
              <Icon name="trash" size={14} />
              清空全部数据
            </button>
          </div>
        </div>
      </Modal>

      {askMode && (
        <ConfirmDialog
          title="导入方式"
          message={
            <>
              文件：<code className="code-hint">{pendingImport.current?.name}</code>
              <br />
              「合并」会保留现有模板并追加导入内容；「覆盖」会用文件内容替换现有全部模板。
            </>
          }
          confirmText="合并导入"
          onConfirm={() => runImport('merge')}
          onCancel={() => {
            setAskMode(false);
            pendingImport.current = null;
          }}
          extra={
            <button className="btn btn--danger" onClick={() => runImport('replace')}>
              覆盖导入
            </button>
          }
        />
      )}

      {clearAsk && (
        <ConfirmDialog
          title="确认清空全部数据？"
          danger
          message={
            <>
              将删除<b>全部模板和分类</b>，此操作<b>不可恢复</b>。
              <br />
              设置（主题、同步配置）会保留。建议先「导出」备份。
            </>
          }
          confirmText="清空"
          onConfirm={() => {
            clearAllData();
            setClearAsk(false);
            close();
          }}
          onCancel={() => setClearAsk(false)}
        />
      )}
    </>
  );
}
