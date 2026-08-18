import type { TemplateVariable, VariableValue } from '../types';
import { optionValue } from '../lib/template';
import { Switch } from './ui';

interface Props {
  variable: TemplateVariable;
  value: VariableValue;
  onChange: (value: VariableValue) => void;
  autoFocus?: boolean;
}

/**
 * 运行期变量输入控件 —— 每种变量类型一个分支。
 * 新增变量类型时，在这里补一个 case 即可。
 */
export function VariableField({ variable, value, onChange, autoFocus }: Props) {
  const id = `field-${variable.id}`;

  switch (variable.type) {
    case 'textarea':
      return (
        <textarea
          id={id}
          className="textarea"
          rows={5}
          autoFocus={autoFocus}
          value={typeof value === 'string' ? value : ''}
          placeholder={variable.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'select': {
      const options = variable.options ?? [];
      const current = typeof value === 'string' ? value : '';
      return (
        <select
          id={id}
          className="select"
          value={current}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        >
          {!variable.required && <option value="">（不填）</option>}
          {options.map((opt) => (
            <option key={opt.id} value={optionValue(opt)}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    case 'multiselect': {
      const options = variable.options ?? [];
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="check-grid">
          {options.length === 0 && (
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              尚未配置选项
            </span>
          )}
          {options.map((opt) => {
            const val = optionValue(opt);
            const on = selected.includes(val);
            return (
              <button
                type="button"
                key={opt.id}
                className="check-chip"
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? selected.filter((v) => v !== val) : [...selected, val])
                }
              >
                {on ? '✓' : '+'} {opt.label}
              </button>
            );
          })}
        </div>
      );
    }

    case 'toggle': {
      const on = value === true;
      const onLabel = variable.onText?.trim() || '是';
      const offLabel = variable.offText?.trim() || '（空）';
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Switch id={id} checked={on} onChange={onChange} />
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            插入：<code className="code-hint">{on ? onLabel : offLabel}</code>
          </span>
        </div>
      );
    }

    case 'number': {
      const num = typeof value === 'number' ? value : '';
      const hasRange = typeof variable.min === 'number' && typeof variable.max === 'number';
      const stepRaw = variable.step ?? 1;
      const safeStep = stepRaw > 0 ? stepRaw : 1;
      const rMin = variable.min ?? 0;
      const rMax = variable.max ?? 0;
      // 滑块连续拖动后吸附到 step 网格；网格点超出 max 时归一化到 max，
      // 仅当拖动真正到达滑块最右（raw >= max）时强制为 max，
      // 这样「步长不能整除最大值」时余数段也能成为最后一个停靠点
      // （如 max=1000、step=222：停靠点 0 → 222 → 444 → 666 → 888 → 1000）
      const snapToStep = (raw: number): number => {
        if (!hasRange) return raw;
        let v = rMin + Math.round((raw - rMin) / safeStep + 1e-9) * safeStep;
        if (v < rMin) v = rMin;
        if (v > rMax) v = rMax;
        if (raw >= rMax) v = rMax;
        return v;
      };
      return (
        <div className="number-field">
          {hasRange && (
            <input
              type="range"
              min={rMin}
              max={rMax}
              step={safeStep <= 1 ? safeStep : 1}
              value={typeof num === 'number' ? num : rMin}
              onChange={(e) => onChange(snapToStep(Number(e.target.value)))}
            />
          )}
          <input
            id={id}
            className="input"
            type="number"
            autoFocus={autoFocus}
            min={variable.min}
            max={variable.max}
            step={safeStep}
            value={num}
            placeholder={variable.placeholder}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
          {variable.unit && (
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              {variable.unit}
            </span>
          )}
        </div>
      );
    }

    case 'date':
      return (
        <input
          id={id}
          className="input"
          type="date"
          autoFocus={autoFocus}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'text':
    default:
      return (
        <input
          id={id}
          className="input"
          autoFocus={autoFocus}
          value={typeof value === 'string' ? value : ''}
          placeholder={variable.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
