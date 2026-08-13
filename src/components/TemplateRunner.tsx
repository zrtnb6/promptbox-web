import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PromptTemplate, VariableValue } from '../types';
import {
  buildInitialValues,
  missingRequired,
  renderSegments,
  type ValueMap,
} from '../lib/template';
import { copyText, hideWindow } from '../lib/storage';
import { useApp } from '../store/useApp';
import { VariableField } from './VariableField';
import { Icon } from './Icon';
import { EmptyState } from './ui';

/** 会话内缓存已填写的值：来回切换模板不丢输入 */
const valueCache = new Map<string, ValueMap>();

interface Props {
  template: PromptTemplate;
  /** 复制成功后的回调（弹窗模式下用于自动关闭） */
  onCopied?: () => void;
  compact?: boolean;
}

export function TemplateRunner({ template, onCopied, compact }: Props) {
  const registerUse = useApp((s) => s.registerUse);
  const notify = useApp((s) => s.notify);
  const hideAfterCopy = useApp((s) => s.settings.hideAfterCopy);

  const [values, setValues] = useState<ValueMap>(() => {
    const cached = valueCache.get(template.id);
    return cached ? { ...buildInitialValues(template.variables), ...cached } : buildInitialValues(template.variables);
  });

  // 切换模板 / 变量定义变化时，重建表单值（保留已填内容）
  useEffect(() => {
    const base = buildInitialValues(template.variables);
    const cached = valueCache.get(template.id);
    setValues(cached ? { ...base, ...pick(cached, Object.keys(base)) } : base);
  }, [template.id, template.variables]);

  useEffect(() => {
    valueCache.set(template.id, values);
  }, [template.id, values]);

  const setValue = useCallback((key: string, value: VariableValue) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const segments = useMemo(
    () => renderSegments(template.content, template.variables, values),
    [template.content, template.variables, values],
  );

  const finalText = useMemo(() => segments.map((s) => s.text).join(''), [segments]);
  const missing = useMemo(() => missingRequired(template.variables, values), [template.variables, values]);

  const handleCopy = useCallback(async () => {
    if (!finalText.trim()) {
      notify('内容为空，没什么可复制的', 'error');
      return;
    }
    await copyText(finalText);
    registerUse(template.id);
    notify(`已复制 ${finalText.length} 个字符到剪贴板`);
    onCopied?.();
    if (hideAfterCopy) void hideWindow();
  }, [finalText, notify, registerUse, template.id, onCopied, hideAfterCopy]);

  // Ctrl/Cmd + Enter 快速复制
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleCopy();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCopy]);

  const reset = () => {
    const base = buildInitialValues(template.variables);
    valueCache.set(template.id, base);
    setValues(base);
  };

  return (
    <div className="runner">
      <div className="runner__form">
        <div className="runner__section-title">
          <span>填写变量（{template.variables.length}）</span>
          {template.variables.length > 0 && (
            <button className="btn btn--ghost btn--sm" onClick={reset} title="恢复默认值">
              <Icon name="refresh" size={13} />
              重置
            </button>
          )}
        </div>

        {template.variables.length === 0 ? (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            这个模板没有变量，右侧就是最终内容，直接复制即可。
          </p>
        ) : (
          template.variables.map((variable, index) => (
            <div className="field" key={variable.id}>
              <label className="field__label" htmlFor={`field-${variable.id}`}>
                {variable.label || variable.key}
                {variable.required && <span className="required-mark">*</span>}
                <code
                  className="code-hint"
                  style={{ marginLeft: 'auto', fontWeight: 400, opacity: 0.75 }}
                >
                  {`{{${variable.key}}}`}
                </code>
              </label>
              <VariableField
                variable={variable}
                value={values[variable.key] ?? null}
                onChange={(v) => setValue(variable.key, v)}
                autoFocus={index === 0 && !compact}
              />
              {variable.description && <div className="field__hint">{variable.description}</div>}
            </div>
          ))
        )}
      </div>

      <div className="runner__preview">
        <div className="preview__head">
          <span className="preview__title">实时预览</span>
          {missing.length > 0 && (
            <span
              className="badge"
              style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}
            >
              <Icon name="alert" size={11} />
              缺 {missing.length} 项必填
            </span>
          )}
        </div>

        <div className="preview__body">
          {template.content.trim() ? (
            <div className="preview__text">
              {segments.map((seg, i) => {
                if (seg.kind === 'static') return <span key={i}>{seg.text}</span>;
                if (seg.kind === 'value')
                  return (
                    <span className="seg-value" key={i}>
                      {seg.text}
                    </span>
                  );
                return (
                  <span className="seg-empty" key={i} title={`变量 ${seg.key} 尚未填写`}>
                    {seg.label}
                  </span>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="pencil"
              title="模板正文是空的"
              desc="切到「编辑」页签写点内容，用 {{变量名}} 插入变量"
            />
          )}
        </div>

        <div className="preview__foot">
          <span className="preview__stats">
            {finalText.length} 字符 · {finalText.split('\n').length} 行
            {missing.length > 0 && ` · 未填：${missing.map((v) => v.label).join('、')}`}
          </span>
          <button className="btn btn--primary btn--lg" onClick={handleCopy}>
            <Icon name="copy" size={15} />
            复制到剪贴板
            <kbd style={{ marginLeft: 4, background: 'rgba(255,255,255,.18)', borderColor: 'transparent', color: '#fff' }}>
              Ctrl+↵
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

function pick(source: ValueMap, keys: string[]): ValueMap {
  const out: ValueMap = {};
  for (const k of keys) {
    if (k in source) out[k] = source[k];
  }
  return out;
}
