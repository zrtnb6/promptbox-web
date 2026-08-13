import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

// ------------------------------------------------------------------ Modal

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  flush?: boolean;
  headerExtra?: ReactNode;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  flush,
  headerExtra,
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal${wide ? ' modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="modal__title">{title}</div>
          {headerExtra}
          <button className="icon-btn" onClick={onClose} title="关闭 (Esc)">
            <Icon name="x" />
          </button>
        </div>
        <div className={`modal__body${flush ? ' modal__body--flush' : ''}`}>{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Switch

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  id?: string;
}

export function Switch({ checked, onChange, label, id }: SwitchProps) {
  return (
    <label className="switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch__track">
        <span className="switch__thumb" />
      </span>
      {label != null && <span>{label}</span>}
    </label>
  );
}

// ------------------------------------------------------------------ 标签输入

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ tags, onChange, placeholder = '输入标签后回车' }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const value = draft.trim();
    if (!value) return;
    if (!tags.includes(value)) onChange([...tags, value]);
    setDraft('');
  };

  return (
    <div className="tag-input">
      {tags.map((tag) => (
        <span className="tag-pill" key={tag}>
          {tag}
          <button
            className="icon-btn icon-btn--sm"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            title="移除标签"
          >
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={tags.length ? '' : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

// ------------------------------------------------------------------ 空状态

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  desc?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon = 'inbox', title, desc, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon name={icon} size={20} />
      </div>
      <div className="empty__title">{title}</div>
      {desc && <div className="empty__desc">{desc}</div>}
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ 内联重命名输入

interface InlineEditProps {
  value: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}

export function InlineEdit({ value, onCommit, onCancel }: InlineEditProps) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className="input"
      style={{ height: 26, fontSize: 'var(--fs-base)' }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(draft.trim() || value);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onCommit(draft.trim() || value)}
    />
  );
}

// ------------------------------------------------------------------ 确认对话框

interface ConfirmProps {
  title: string;
  message: ReactNode;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** 追加的第三个动作按钮（例如「覆盖导入」） */
  extra?: ReactNode;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = '确认',
  danger,
  onConfirm,
  onCancel,
  extra,
}: ConfirmProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            取消
          </button>
          {extra}
          <button
            className={danger ? 'btn btn--primary' : 'btn btn--primary'}
            style={danger ? { background: 'var(--danger)', borderColor: 'var(--danger)' } : undefined}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div style={{ color: 'var(--text-secondary)' }}>{message}</div>
    </Modal>
  );
}
