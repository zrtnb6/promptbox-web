/** 轻量 id 生成：优先用 crypto.randomUUID，降级到时间戳+随机串 */
export function uid(prefix = ''): string {
  let core: string;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    core = crypto.randomUUID();
  } else {
    core = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return prefix ? `${prefix}_${core}` : core;
}

/** 把任意文案规整成合法的变量 key：小写、下划线连接 */
export function slugifyKey(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'var';
}
