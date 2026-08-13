import { useMemo, useState } from 'react';
import { useApp } from '../store/useApp';
import { collectTags, countByFilter } from '../lib/query';
import type { FilterKind } from '../types';
import { Icon, type IconName } from './Icon';
import { InlineEdit } from './ui';

const QUICK_NAV: { kind: FilterKind; label: string; icon: IconName }[] = [
  { kind: 'all', label: '全部模板', icon: 'layers' },
  { kind: 'favorites', label: '收藏', icon: 'star' },
  { kind: 'recent', label: '最近使用', icon: 'clock' },
  { kind: 'uncategorized', label: '未分类', icon: 'inbox' },
];

export function Sidebar() {
  const templates = useApp((s) => s.templates);
  const categories = useApp((s) => s.categories);
  const filter = useApp((s) => s.filter);
  const setFilter = useApp((s) => s.setFilter);
  const createTemplate = useApp((s) => s.createTemplate);
  const addCategory = useApp((s) => s.addCategory);
  const updateCategory = useApp((s) => s.updateCategory);
  const deleteCategory = useApp((s) => s.deleteCategory);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const tags = useMemo(() => collectTags(templates), [templates]);

  const isActive = (kind: FilterKind, value?: string) =>
    filter.kind === kind && (value === undefined || filter.value === value);

  return (
    <aside className="sidebar">
      <div className="sidebar__new">
        <button className="btn btn--primary btn--block" onClick={() => createTemplate()}>
          <Icon name="plus" size={15} />
          新建模板
        </button>
      </div>

      <div className="sidebar__scroll">
        <nav className="nav-section">
          {QUICK_NAV.map((item) => (
            <button
              key={item.kind}
              className="nav-item"
              aria-current={isActive(item.kind)}
              onClick={() => setFilter({ kind: item.kind })}
            >
              <Icon name={item.icon} size={15} solid={item.kind === 'favorites' && isActive('favorites')} />
              <span className="nav-item__label">{item.label}</span>
              <span className="nav-item__count">{countByFilter(templates, { kind: item.kind })}</span>
            </button>
          ))}
        </nav>

        <section className="nav-section">
          <div className="nav-section__title">
            <span>分类</span>
            <button
              className="icon-btn icon-btn--sm"
              title="新建分类"
              onClick={() => {
                const id = addCategory('新分类');
                setRenamingId(id);
                setFilter({ kind: 'category', value: id });
              }}
            >
              <Icon name="plus" size={13} />
            </button>
          </div>

          {categories.length === 0 && (
            <p style={{ padding: '2px 8px', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              还没有分类，点上面的 + 建一个
            </p>
          )}

          {categories.map((cat) => (
            <div className="cat-row" key={cat.id}>
              {renamingId === cat.id ? (
                <div style={{ flex: 1, padding: '2px 4px' }}>
                  <InlineEdit
                    value={cat.name}
                    onCommit={(name) => {
                      updateCategory(cat.id, { name });
                      setRenamingId(null);
                    }}
                    onCancel={() => setRenamingId(null)}
                  />
                </div>
              ) : (
                <>
                  <button
                    className="nav-item"
                    aria-current={isActive('category', cat.id)}
                    onClick={() => setFilter({ kind: 'category', value: cat.id })}
                    onDoubleClick={() => setRenamingId(cat.id)}
                    title={cat.name}
                  >
                    <span className="dot" style={{ background: cat.color }} />
                    <span className="nav-item__label">{cat.name}</span>
                    <span className="nav-item__count">
                      {countByFilter(templates, { kind: 'category', value: cat.id })}
                    </span>
                  </button>
                  <span className="row-actions">
                    <button
                      className="icon-btn icon-btn--sm"
                      title="重命名"
                      onClick={() => setRenamingId(cat.id)}
                    >
                      <Icon name="pencil" size={12} />
                    </button>
                    <button
                      className="icon-btn icon-btn--sm icon-btn--danger"
                      title="删除分类（模板会移到未分类）"
                      onClick={() => deleteCategory(cat.id)}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </span>
                </>
              )}
            </div>
          ))}
        </section>

        {tags.length > 0 && (
          <section className="nav-section">
            <div className="nav-section__title">
              <span>标签</span>
            </div>
            <div className="tag-cloud">
              {tags.map(({ tag, count }) => (
                <button
                  key={tag}
                  className="tag-chip"
                  aria-pressed={isActive('tag', tag)}
                  onClick={() =>
                    isActive('tag', tag)
                      ? setFilter({ kind: 'all' })
                      : setFilter({ kind: 'tag', value: tag })
                  }
                >
                  <Icon name="hash" size={10} />
                  {tag}
                  <span style={{ opacity: 0.6 }}>{count}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="sidebar__footer">
        <button className="btn btn--ghost btn--sm" onClick={() => setSettingsOpen(true)}>
          <Icon name="sliders" size={14} />
          设置
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>v0.1.0</span>
      </div>
    </aside>
  );
}
