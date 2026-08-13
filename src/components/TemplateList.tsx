import { useMemo } from 'react';
import { useApp } from '../store/useApp';
import { contentPreview, filterTemplates, relativeTime } from '../lib/query';
import type { SortKey } from '../types';
import { Icon } from './Icon';
import { EmptyState } from './ui';

const SORT_LABELS: { value: SortKey; label: string }[] = [
  { value: 'updated', label: '最近修改' },
  { value: 'created', label: '创建时间' },
  { value: 'used', label: '使用次数' },
  { value: 'title', label: '名称' },
];

export function TemplateList() {
  const templates = useApp((s) => s.templates);
  const categories = useApp((s) => s.categories);
  const filter = useApp((s) => s.filter);
  const query = useApp((s) => s.query);
  const sort = useApp((s) => s.sort);
  const setSort = useApp((s) => s.setSort);
  const selectedId = useApp((s) => s.selectedId);
  const select = useApp((s) => s.select);
  const setMode = useApp((s) => s.setMode);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const openQuickUse = useApp((s) => s.openQuickUse);
  const createTemplate = useApp((s) => s.createTemplate);

  const list = useMemo(
    () => filterTemplates(templates, filter, query, sort),
    [templates, filter, query, sort],
  );

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const heading = (() => {
    switch (filter.kind) {
      case 'favorites':
        return '收藏';
      case 'recent':
        return '最近使用';
      case 'uncategorized':
        return '未分类';
      case 'category':
        return catMap.get(filter.value ?? '')?.name ?? '分类';
      case 'tag':
        return `#${filter.value}`;
      default:
        return '全部模板';
    }
  })();

  return (
    <section className="list-pane">
      <header className="list-pane__head">
        <div>
          <div className="list-pane__title">{heading}</div>
          <div className="list-pane__meta">
            {query ? `搜索到 ${list.length} 个` : `${list.length} 个模板`}
          </div>
        </div>
        <select
          className="select select--sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          title="排序方式"
          disabled={filter.kind === 'recent'}
        >
          {SORT_LABELS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </header>

      <div className="list-pane__scroll">
        {list.length === 0 ? (
          <EmptyState
            icon={query ? 'search' : 'inbox'}
            title={query ? '没有匹配的模板' : '这里还是空的'}
            desc={query ? '换个关键词试试' : '新建一个模板，开始积累你的提示词库'}
            action={
              !query && (
                <button className="btn btn--primary btn--sm" onClick={() => createTemplate()}>
                  <Icon name="plus" size={14} />
                  新建模板
                </button>
              )
            }
          />
        ) : (
          <ul>
            {list.map((tpl) => {
              const cat = tpl.categoryId ? catMap.get(tpl.categoryId) : null;
              return (
                <li key={tpl.id}>
                  <div
                    className="tpl-card"
                    role="option"
                    aria-selected={selectedId === tpl.id}
                    tabIndex={0}
                    onClick={() => select(tpl.id)}
                    onDoubleClick={() => {
                      select(tpl.id);
                      openQuickUse(tpl.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        select(tpl.id);
                        openQuickUse(tpl.id);
                      }
                    }}
                  >
                    <div className="tpl-card__top">
                      <span className="tpl-card__title">{tpl.title}</span>
                      <button
                        className="icon-btn icon-btn--sm icon-btn--star"
                        aria-pressed={tpl.favorite}
                        title={tpl.favorite ? '取消收藏' : '收藏'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(tpl.id);
                        }}
                      >
                        <Icon name="star" size={13} solid={tpl.favorite} />
                      </button>
                    </div>

                    <div className="tpl-card__snippet">
                      {tpl.description?.trim() || contentPreview(tpl.content) || '（空模板）'}
                    </div>

                    <div className="tpl-card__foot">
                      {cat && (
                        <span className="tpl-card__cat">
                          <span className="dot" style={{ background: cat.color }} />
                          {cat.name}
                        </span>
                      )}
                      {tpl.variables.length > 0 && (
                        <span className="badge" title="变量数量">
                          <Icon name="braces" size={10} />
                          {tpl.variables.length}
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      <span title={`已使用 ${tpl.useCount} 次`}>
                        {tpl.lastUsedAt ? relativeTime(tpl.lastUsedAt) : relativeTime(tpl.updatedAt)}
                      </span>
                      <button
                        className="icon-btn icon-btn--sm"
                        title="使用这个模板"
                        onClick={(e) => {
                          e.stopPropagation();
                          select(tpl.id);
                          setMode('use');
                          openQuickUse(tpl.id);
                        }}
                      >
                        <Icon name="play" size={12} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
