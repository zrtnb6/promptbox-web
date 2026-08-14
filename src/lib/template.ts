/**
 * 提示词模板渲染引擎
 *
 * 支持的语法：
 *   {{key}}                          变量插值
 *   {{#if key}} … {{/if}}            条件块（变量有值 / 开关打开时输出）
 *   {{#if key}} … {{else}} … {{/if}} 条件分支
 *   {{#unless key}} … {{/unless}}    反向条件块
 *
 * 条件块可嵌套。真值判定见 isTruthy()。
 */

import type { TemplateVariable, VariableType, VariableValue } from '../types';

// ---------------------------------------------------------------- AST

type Node =
  | { type: 'text'; value: string }
  | { type: 'var'; key: string }
  | { type: 'cond'; key: string; negate: boolean; then: Node[]; otherwise: Node[] };

interface Frame {
  node: Extract<Node, { type: 'cond' }>;
  branch: 'then' | 'otherwise';
}

const TOKEN_RE =
  /\{\{\s*(?:(#if|#unless)\s+([\p{L}\p{N}_.-]+)|(else)|(\/if|\/unless)|([\p{L}\p{N}_.-]+))\s*\}\}/gu;

function parse(content: string): Node[] {
  const root: Node[] = [];
  const stack: Frame[] = [];

  const push = (node: Node) => {
    if (stack.length === 0) {
      root.push(node);
      return;
    }
    const frame = stack[stack.length - 1];
    (frame.branch === 'then' ? frame.node.then : frame.node.otherwise).push(node);
  };

  const re = new RegExp(TOKEN_RE.source, TOKEN_RE.flags);
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    if (match.index > cursor) {
      push({ type: 'text', value: content.slice(cursor, match.index) });
    }
    cursor = match.index + match[0].length;

    const openTag = match[1];
    const condKey = match[2];
    const isElse = match[3];
    const closeTag = match[4];
    const varKey = match[5];

    if (openTag && condKey) {
      const node: Extract<Node, { type: 'cond' }> = {
        type: 'cond',
        key: condKey,
        negate: openTag === '#unless',
        then: [],
        otherwise: [],
      };
      push(node);
      stack.push({ node, branch: 'then' });
    } else if (isElse) {
      if (stack.length > 0) stack[stack.length - 1].branch = 'otherwise';
    } else if (closeTag) {
      stack.pop();
    } else if (varKey) {
      push({ type: 'var', key: varKey });
    }
  }

  if (cursor < content.length) {
    push({ type: 'text', value: content.slice(cursor) });
  }
  return root;
}

// ---------------------------------------------------------------- 取值格式化

const DEFAULT_SEPARATOR = '、';

export function formatDate(iso: string, fmt = 'YYYY-MM-DD'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const map: Record<string, string> = {
    YYYY: m[1],
    MM: m[2],
    DD: m[3],
    M: String(Number(m[2])),
    D: String(Number(m[3])),
  };
  return fmt.replace(/YYYY|MM|DD|M|D/g, (t) => map[t] ?? t);
}

/** 把变量的原始取值转成最终插入提示词的字符串 */
export function formatValue(variable: TemplateVariable, raw: VariableValue): string {
  switch (variable.type) {
    case 'toggle': {
      const on = raw === true;
      const onText = variable.onText?.trim() ? variable.onText : '是';
      const offText = variable.offText ?? '';
      return on ? onText : offText;
    }
    case 'multiselect': {
      const list = Array.isArray(raw) ? raw.filter((v) => v !== '' && v != null) : [];
      const sep = variable.separator ?? DEFAULT_SEPARATOR;
      return list.join(sep);
    }
    case 'number': {
      if (raw === '' || raw == null) return '';
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isNaN(n)) return '';
      return `${n}${variable.unit ?? ''}`;
    }
    case 'date': {
      if (typeof raw !== 'string' || !raw) return '';
      return formatDate(raw, variable.dateFormat || 'YYYY-MM-DD');
    }
    default: {
      if (raw == null) return '';
      return String(raw);
    }
  }
}

/** 条件块真值判定 */
export function isTruthy(variable: TemplateVariable | undefined, raw: VariableValue): boolean {
  if (raw == null) return false;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return !Number.isNaN(raw);
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === 'string') return raw.trim().length > 0;
  return Boolean(variable && raw);
}

// ---------------------------------------------------------------- 渲染

export interface RenderSegment {
  /** static 原文 / value 已填入的变量值 / empty 尚未填写的变量 */
  kind: 'static' | 'value' | 'empty';
  /** 参与复制的真实文本（empty 段为空串） */
  text: string;
  key?: string;
  /** empty 段用于在预览里显示占位提示 */
  label?: string;
}

export type ValueMap = Record<string, VariableValue>;

/**
 * 渲染成片段数组：既能拼出可复制的纯文本，也能在预览里高亮变量。
 */
export function renderSegments(
  content: string,
  variables: TemplateVariable[],
  values: ValueMap,
): RenderSegment[] {
  const byKey = new Map(variables.map((v) => [v.key, v]));
  const out: RenderSegment[] = [];

  const emit = (seg: RenderSegment) => {
    const last = out[out.length - 1];
    if (last && last.kind === 'static' && seg.kind === 'static') {
      last.text += seg.text;
      return;
    }
    out.push(seg);
  };

  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        emit({ kind: 'static', text: node.value });
      } else if (node.type === 'var') {
        const variable = byKey.get(node.key);
        if (!variable) {
          // 未定义的变量：原样保留，提醒用户去补定义
          emit({ kind: 'empty', text: '', key: node.key, label: node.key });
          continue;
        }
        const text = formatValue(variable, values[node.key] ?? null);
        if (text === '') {
          emit({ kind: 'empty', text: '', key: node.key, label: variable.key });
        } else {
          emit({ kind: 'value', text, key: node.key });
        }
      } else {
        const variable = byKey.get(node.key);
        const truthy = isTruthy(variable, values[node.key] ?? null);
        const take = node.negate ? !truthy : truthy;
        walk(take ? node.then : node.otherwise);
      }
    }
  };

  walk(parse(content));
  return out;
}

/** 渲染为可直接复制的纯文本 */
export function renderTemplate(
  content: string,
  variables: TemplateVariable[],
  values: ValueMap,
): string {
  return renderSegments(content, variables, values)
    .map((s) => s.text)
    .join('');
}

// ---------------------------------------------------------------- 变量与正文的一致性

/** 提取正文中出现过的所有 key（插值 + 条件），按出现顺序去重 */
export function extractKeys(content: string): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const collect = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === 'var' || node.type === 'cond') {
        if (!seen.has(node.key)) {
          seen.add(node.key);
          order.push(node.key);
        }
      }
      if (node.type === 'cond') {
        collect(node.then);
        collect(node.otherwise);
      }
    }
  };
  collect(parse(content));
  return order;
}

/** 正文里用到但没定义的变量 */
export function findUndefinedKeys(content: string, variables: TemplateVariable[]): string[] {
  const defined = new Set(variables.map((v) => v.key));
  return extractKeys(content).filter((k) => !defined.has(k));
}

/** 定义了但正文没用到的变量 */
export function findUnusedVariables(
  content: string,
  variables: TemplateVariable[],
): TemplateVariable[] {
  const used = new Set(extractKeys(content));
  return variables.filter((v) => !used.has(v.key));
}

// ---------------------------------------------------------------- 默认值

export function emptyValueFor(type: VariableType): VariableValue {
  switch (type) {
    case 'toggle':
      return false;
    case 'multiselect':
      return [];
    case 'number':
      return '';
    default:
      return '';
  }
}

/** 根据变量定义算出表单初值 */
export function initialValue(variable: TemplateVariable): VariableValue {
  const dv = variable.defaultValue;
  switch (variable.type) {
    case 'toggle':
      return dv === true;
    case 'multiselect':
      if (Array.isArray(dv)) return [...dv];
      if (typeof dv === 'string' && dv) return [dv];
      return [];
    case 'number':
      if (typeof dv === 'number') return dv;
      if (typeof dv === 'string' && dv.trim() !== '' && !Number.isNaN(Number(dv))) return Number(dv);
      return '';
    case 'select':
      if (typeof dv === 'string' && dv) return dv;
      return variable.options?.[0] ? optionValue(variable.options[0]) : '';
    case 'date':
      if (dv === 'today') return todayISO();
      return typeof dv === 'string' ? dv : '';
    default:
      return typeof dv === 'string' ? dv : dv == null ? '' : String(dv);
  }
}

export function buildInitialValues(variables: TemplateVariable[]): ValueMap {
  const map: ValueMap = {};
  for (const v of variables) map[v.key] = initialValue(v);
  return map;
}

export function optionValue(opt: { label: string; value: string }): string {
  return opt.value?.trim() ? opt.value : opt.label;
}

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 必填但没填的变量 */
export function missingRequired(
  variables: TemplateVariable[],
  values: ValueMap,
): TemplateVariable[] {
  return variables.filter((v) => {
    if (!v.required) return false;
    if (v.type === 'toggle') return false; // 开关永远有值
    return formatValue(v, values[v.key] ?? null).trim() === '';
  });
}
