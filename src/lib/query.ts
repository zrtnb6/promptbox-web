import type { ListFilter, PromptTemplate, SortKey } from '../types';

/** 最近使用的时间窗（14 天） */
const RECENT_WINDOW = 1000 * 60 * 60 * 24 * 14;

function matchesFilter(tpl: PromptTemplate, filter: ListFilter): boolean {
  switch (filter.kind) {
    case 'all':
      return true;
    case 'favorites':
      return tpl.favorite;
    case 'recent':
      return tpl.lastUsedAt != null && Date.now() - tpl.lastUsedAt < RECENT_WINDOW;
    case 'uncategorized':
      return !tpl.categoryId;
    case 'category':
      return tpl.categoryId === filter.value;
    case 'tag':
      return !!filter.value && tpl.tags.includes(filter.value);
    default:
      return true;
  }
}

function matchesQuery(tpl: PromptTemplate, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    tpl.title.toLowerCase().includes(needle) ||
    (tpl.description ?? '').toLowerCase().includes(needle) ||
    tpl.content.toLowerCase().includes(needle) ||
    tpl.tags.some((t) => t.toLowerCase().includes(needle)) ||
    tpl.variables.some(
      (v) => v.key.toLowerCase().includes(needle),
    )
  );
}

const comparators: Record<SortKey, (a: PromptTemplate, b: PromptTemplate) => number> = {
  updated: (a, b) => b.updatedAt - a.updatedAt,
  created: (a, b) => b.createdAt - a.createdAt,
  title: (a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'),
  used: (a, b) => b.useCount - a.useCount || b.updatedAt - a.updatedAt,
};

export function filterTemplates(
  templates: PromptTemplate[],
  filter: ListFilter,
  query: string,
  sort: SortKey,
): PromptTemplate[] {
  const list = templates.filter((t) => matchesFilter(t, filter) && matchesQuery(t, query));
  // 「最近使用」固定按使用时间倒序，符合直觉
  if (filter.kind === 'recent') {
    return list.sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
  }
  return list.sort(comparators[sort]);
}

/** 汇总所有标签及其数量，按数量倒序 */
export function collectTags(templates: PromptTemplate[]): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  for (const t of templates) {
    for (const tag of t.tags) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hans-CN'));
}

export function countByFilter(templates: PromptTemplate[], filter: ListFilter): number {
  return templates.filter((t) => matchesFilter(t, filter)).length;
}

/** 相对时间：刚刚 / 3 分钟前 / 昨天 / 2026-08-01 */
export function relativeTime(ts: number | null): string {
  if (!ts) return '未使用';
  const diff = Date.now() - ts;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < day * 2) return '昨天';
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`;
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 正文摘要：去掉占位符标记，压缩空白 */
export function contentPreview(content: string, max = 120): string {
  const flat = content
    .replace(/\{\{[^}]*\}\}/g, '▢')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
