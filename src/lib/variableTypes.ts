import type { TemplateVariable, VariableType } from '../types';
import { uid } from './id';

export interface VariableTypeMeta {
  type: VariableType;
  label: string;
  hint: string;
  /** 对应 components/Icon.tsx 中的图标名 */
  icon: string;
}

/** 变量类型注册表 —— 新增类型只需在这里加一项，并在 VariableField 里加一个分支 */
export const VARIABLE_TYPES: VariableTypeMeta[] = [
  { type: 'text', label: '单行文本', hint: '短句、名称、主题等', icon: 'text' },
  { type: 'textarea', label: '多行文本', hint: '长段落、代码、原始素材', icon: 'textarea' },
  { type: 'select', label: '下拉单选', hint: '从预设选项里挑一个', icon: 'select' },
  { type: 'multiselect', label: '多选', hint: '可同时选中多个并自动拼接', icon: 'multiselect' },
  { type: 'toggle', label: '开关', hint: '开/关分别插入不同文本，可配合条件块', icon: 'toggle' },
  { type: 'number', label: '数字', hint: '带范围与步长，可加单位', icon: 'number' },
  { type: 'date', label: '日期', hint: '日期选择器，可自定义格式', icon: 'date' },
];

export const VARIABLE_TYPE_MAP: Record<VariableType, VariableTypeMeta> = VARIABLE_TYPES.reduce(
  (acc, meta) => {
    acc[meta.type] = meta;
    return acc;
  },
  {} as Record<VariableType, VariableTypeMeta>,
);

export function typeLabel(type: VariableType): string {
  return VARIABLE_TYPE_MAP[type]?.label ?? type;
}

/** 创建一个带合理默认配置的新变量 */
export function createVariable(type: VariableType = 'text', index = 1): TemplateVariable {
  const base: TemplateVariable = {
    id: uid('var'),
    key: `var${index}`,
    label: `变量 ${index}`,
    type,
    required: false,
  };

  switch (type) {
    case 'select':
      return { ...base, options: [newOption('选项 A'), newOption('选项 B')] };
    case 'multiselect':
      return {
        ...base,
        options: [newOption('选项 A'), newOption('选项 B'), newOption('选项 C')],
        separator: '、',
        defaultValue: [],
      };
    case 'toggle':
      return { ...base, onText: '是', offText: '', defaultValue: false };
    case 'number':
      return { ...base, min: 0, max: 10000, step: 1, defaultValue: 100 };
    case 'date':
      return { ...base, dateFormat: 'YYYY-MM-DD', defaultValue: 'today' };
    case 'textarea':
      return { ...base, placeholder: '在此粘贴内容…' };
    default:
      return base;
  }
}

export function newOption(label: string) {
  return { id: uid('opt'), label, value: label };
}

/** 切换类型时清理掉不属于新类型的配置，避免脏数据 */
export function migrateVariableType(
  variable: TemplateVariable,
  next: VariableType,
): TemplateVariable {
  const kept: TemplateVariable = {
    id: variable.id,
    key: variable.key,
    label: variable.label,
    description: variable.description,
    placeholder: variable.placeholder,
    required: variable.required,
    type: next,
  };
  const fresh = createVariable(next);
  switch (next) {
    case 'select':
      return { ...kept, options: variable.options?.length ? variable.options : fresh.options };
    case 'multiselect':
      return {
        ...kept,
        options: variable.options?.length ? variable.options : fresh.options,
        separator: variable.separator ?? '、',
        defaultValue: [],
      };
    case 'toggle':
      return { ...kept, onText: variable.onText ?? '是', offText: variable.offText ?? '', defaultValue: false };
    case 'number':
      return {
        ...kept,
        min: variable.min ?? 0,
        max: variable.max ?? 10000,
        step: variable.step ?? 1,
        unit: variable.unit,
        defaultValue: typeof variable.defaultValue === 'number' ? variable.defaultValue : '',
      };
    case 'date':
      return { ...kept, dateFormat: variable.dateFormat ?? 'YYYY-MM-DD', defaultValue: 'today' };
    default:
      return {
        ...kept,
        defaultValue: typeof variable.defaultValue === 'string' ? variable.defaultValue : '',
      };
  }
}
