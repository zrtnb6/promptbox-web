import { useEffect, useState } from 'react';
import type { TemplateVariable, VariableType } from '../types';
import { slugifyKey, uid } from '../lib/id';
import { VARIABLE_TYPES, migrateVariableType, newOption, typeLabel } from '../lib/variableTypes';
import { Icon, type IconName } from './Icon';
import { Switch } from './ui';

interface Props {
  variable: TemplateVariable;
  index: number;
  total: number;
  duplicateKey: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (next: TemplateVariable) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}

const DATE_FORMATS = ['YYYY-MM-DD', 'YYYY年M月D日', 'M月D日', 'YYYY/MM/DD'];

export function VariableEditor({
  variable,
  index,
  total,
  duplicateKey,
  expanded,
  onToggleExpand,
  onChange,
  onRemove,
  onMove,
}: Props) {
  const patch = (p: Partial<TemplateVariable>) => onChange({ ...variable, ...p });

  /**
   * 变量名单独用草稿态：改名要连带重写正文里的 {{旧名}}，
   * 所以不能每敲一个字就提交一次，统一在失焦 / 回车时提交。
   */
  const [keyDraft, setKeyDraft] = useState(variable.key);
  useEffect(() => setKeyDraft(variable.key), [variable.id, variable.key]);

  const commitKey = () => {
    const nextKey = slugifyKey(keyDraft);
    if (!nextKey || nextKey === variable.key) {
      setKeyDraft(variable.key); // 空名或没变化：回滚输入框显示
      return;
    }
    patch({ key: nextKey });
  };

  const keyPreview = slugifyKey(keyDraft) || variable.key;
  const keyDirty = keyPreview !== variable.key;

  const changeType = (type: VariableType) => {
    if (type === variable.type) return;
    onChange(migrateVariableType(variable, type));
  };

  const options = variable.options ?? [];

  const updateOption = (id: string, p: Partial<{ label: string; value: string }>) =>
    patch({ options: options.map((o) => (o.id === id ? { ...o, ...p } : o)) });

  return (
    <div className="var-card">
      <div className="var-card__head">
        <span className="var-card__grip" title={`第 ${index + 1} 个变量`}>
          <Icon name="grip" size={14} />
        </span>
        <code className="var-card__key" style={duplicateKey ? { background: 'var(--danger-soft)', color: 'var(--danger)' } : undefined}>
          {`{{${variable.key}}}`}
        </code>
        {variable.required && <span className="required-mark"> *</span>}
        <span className="var-card__type">
          <Icon
            name={(VARIABLE_TYPES.find((t) => t.type === variable.type)?.icon ?? 'text') as IconName}
            size={11}
          />
          {typeLabel(variable.type)}
        </span>
        <button
          className="icon-btn icon-btn--sm"
          title="上移"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <Icon name="arrowUp" size={13} />
        </button>
        <button
          className="icon-btn icon-btn--sm"
          title="下移"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <Icon name="arrowDown" size={13} />
        </button>
        <button className="icon-btn icon-btn--sm icon-btn--danger" title="删除变量" onClick={onRemove}>
          <Icon name="trash" size={13} />
        </button>
        <button
          className="icon-btn icon-btn--sm"
          title={expanded ? '收起' : '展开配置'}
          onClick={onToggleExpand}
        >
          <Icon name={expanded ? 'chevronDown' : 'chevronLeft'} size={14} />
        </button>
      </div>

      {expanded && (
        <div className="var-card__body">
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <label className="field__label">
                变量名
                {duplicateKey && <span className="required-mark">重复！</span>}
              </label>
              <input
                className="input"
                style={{ fontFamily: 'var(--font-mono)' }}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onBlur={commitKey}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setKeyDraft(variable.key);
                    e.currentTarget.blur();
                  }
                }}
              />
              <div className="field__hint">
                正文中用 <code className="code-hint">{`{{${keyPreview}}}`}</code> 引用，也是该变量在表单里的显示名
                {keyDirty && (
                  <span style={{ color: 'var(--accent-text)' }}>
                    （回车或失焦后生效，正文里的引用会自动跟着改名）
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="field">
            <label className="field__label">变量类型</label>
            <div className="type-picker">
              {VARIABLE_TYPES.map((meta) => (
                <button
                  key={meta.type}
                  className="type-option"
                  aria-pressed={variable.type === meta.type}
                  onClick={() => changeType(meta.type)}
                  title={meta.hint}
                >
                  <Icon name={meta.icon as IconName} size={13} />
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* ---------------- 类型专属配置 ---------------- */}

          {(variable.type === 'select' || variable.type === 'multiselect') && (
            <div className="field">
              <label className="field__label">选项列表</label>
              {options.map((opt) => (
                <div className="option-row" key={opt.id}>
                  <input
                    className="input"
                    value={opt.label}
                    placeholder="显示文案"
                    onChange={(e) => updateOption(opt.id, { label: e.target.value })}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <input
                    className="input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}
                    value={opt.value}
                    placeholder="插入的实际值（留空同左）"
                    onChange={(e) => updateOption(opt.id, { value: e.target.value })}
                  />
                  <button
                    className="icon-btn icon-btn--sm icon-btn--danger"
                    title="删除选项"
                    onClick={() => patch({ options: options.filter((o) => o.id !== opt.id) })}
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
              <button
                className="btn btn--sm"
                onClick={() => patch({ options: [...options, newOption('')] })}
              >
                <Icon name="plus" size={13} />
                添加选项
              </button>
            </div>
          )}

          {variable.type === 'multiselect' && (
            <div className="field-row">
              <div className="field">
                <label className="field__label">多值拼接分隔符</label>
                <input
                  className="input"
                  value={variable.separator ?? '、'}
                  onChange={(e) => patch({ separator: e.target.value })}
                  placeholder="、"
                />
                <div className="field__hint">选中多个时用它连接，例如「、」「, 」「\n- 」</div>
              </div>
              <div className="field" />
            </div>
          )}

          {variable.type === 'toggle' && (
            <div className="field-row">
              <div className="field">
                <label className="field__label">开启时插入</label>
                <input
                  className="input"
                  value={variable.onText ?? ''}
                  onChange={(e) => patch({ onText: e.target.value })}
                  placeholder="是"
                />
              </div>
              <div className="field">
                <label className="field__label">关闭时插入</label>
                <input
                  className="input"
                  value={variable.offText ?? ''}
                  onChange={(e) => patch({ offText: e.target.value })}
                  placeholder="（留空则不插入任何内容）"
                />
              </div>
            </div>
          )}

          {variable.type === 'number' && (
            <>
              <div className="field-row">
                <div className="field">
                  <label className="field__label">最小值</label>
                  <input
                    className="input"
                    type="number"
                    value={variable.min ?? ''}
                    onChange={(e) => patch({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="field__label">最大值</label>
                  <input
                    className="input"
                    type="number"
                    value={variable.max ?? ''}
                    onChange={(e) => patch({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="field__label">步长</label>
                  <input
                    className="input"
                    type="number"
                    value={variable.step ?? 1}
                    onChange={(e) => patch({ step: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="field__label">单位后缀</label>
                  <input
                    className="input"
                    value={variable.unit ?? ''}
                    onChange={(e) => patch({ unit: e.target.value })}
                    placeholder="如「 字」"
                  />
                </div>
              </div>
              <div className="field">
                <label className="field__label">默认值</label>
                <input
                  className="input"
                  type="number"
                  value={typeof variable.defaultValue === 'number' ? variable.defaultValue : ''}
                  onChange={(e) =>
                    patch({ defaultValue: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                />
              </div>
            </>
          )}

          {variable.type === 'date' && (
            <div className="field-row">
              <div className="field">
                <label className="field__label">日期格式</label>
                <select
                  className="select"
                  value={variable.dateFormat ?? 'YYYY-MM-DD'}
                  onChange={(e) => patch({ dateFormat: e.target.value })}
                >
                  {DATE_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label">默认值</label>
                <select
                  className="select"
                  value={variable.defaultValue === 'today' ? 'today' : 'empty'}
                  onChange={(e) => patch({ defaultValue: e.target.value === 'today' ? 'today' : '' })}
                >
                  <option value="today">今天</option>
                  <option value="empty">留空</option>
                </select>
              </div>
            </div>
          )}

          {(variable.type === 'text' || variable.type === 'textarea') && (
            <div className="field">
              <label className="field__label">默认值</label>
              {variable.type === 'textarea' ? (
                <textarea
                  className="textarea"
                  rows={3}
                  value={typeof variable.defaultValue === 'string' ? variable.defaultValue : ''}
                  onChange={(e) => patch({ defaultValue: e.target.value })}
                />
              ) : (
                <input
                  className="input"
                  value={typeof variable.defaultValue === 'string' ? variable.defaultValue : ''}
                  onChange={(e) => patch({ defaultValue: e.target.value })}
                />
              )}
            </div>
          )}

          {variable.type === 'select' && (
            <div className="field">
              <label className="field__label">默认选中</label>
              <select
                className="select"
                value={typeof variable.defaultValue === 'string' ? variable.defaultValue : ''}
                onChange={(e) => patch({ defaultValue: e.target.value })}
              >
                <option value="">（不预选）</option>
                {options.map((o) => (
                  <option key={o.id} value={o.value || o.label}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label className="field__label">占位提示</label>
              <input
                className="input"
                value={variable.placeholder ?? ''}
                onChange={(e) => patch({ placeholder: e.target.value })}
                placeholder="输入框里的灰色提示文字"
              />
            </div>
            <div className="field">
              <label className="field__label">辅助说明</label>
              <input
                className="input"
                value={variable.description ?? ''}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="填写说明，显示在输入框下方"
              />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <Switch
              checked={Boolean(variable.required)}
              onChange={(v) => patch({ required: v })}
              label="必填项"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** 供外部创建选项时复用 */
export function makeOption(label: string) {
  return { id: uid('opt'), label, value: label };
}
