import { useMemo, useRef, useState } from 'react';
import type { PromptTemplate, TemplateVariable, VariableType } from '../types';
import { useApp } from '../store/useApp';
import { findUndefinedKeys, findUnusedVariables, renameKeyInContent } from '../lib/template';
import { VARIABLE_TYPES, createVariable } from '../lib/variableTypes';
import { uid } from '../lib/id';
import { Icon, type IconName } from './Icon';
import { TagInput } from './ui';
import { VariableEditor } from './VariableEditor';

interface Props {
  template: PromptTemplate;
}

export function TemplateEditor({ template }: Props) {
  const updateTemplate = useApp((s) => s.updateTemplate);
  const updateVariables = useApp((s) => s.updateVariables);
  const categories = useApp((s) => s.categories);
  const notify = useApp((s) => s.notify);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const undefinedKeys = useMemo(
    () => findUndefinedKeys(template.content, template.variables),
    [template.content, template.variables],
  );
  const unusedVars = useMemo(
    () => findUnusedVariables(template.content, template.variables),
    [template.content, template.variables],
  );
  const duplicateKeys = useMemo(() => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const v of template.variables) {
      if (seen.has(v.key)) dup.add(v.key);
      seen.add(v.key);
    }
    return dup;
  }, [template.variables]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /** 在正文光标处插入文本 */
  const insertAtCursor = (text: string) => {
    const el = contentRef.current;
    if (!el) {
      updateTemplate(template.id, { content: template.content + text });
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`;
    updateTemplate(template.id, { content: next });
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + text.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const uniqueKey = (base: string) => {
    const existing = new Set(template.variables.map((v) => v.key));
    if (!existing.has(base)) return base;
    let i = 2;
    while (existing.has(`${base}${i}`)) i += 1;
    return `${base}${i}`;
  };

  const addVariable = (type: VariableType) => {
    const index = template.variables.length + 1;
    const fresh = createVariable(type, index);
    fresh.key = uniqueKey(fresh.key);
    updateVariables(template.id, [...template.variables, fresh]);
    setExpanded((prev) => new Set(prev).add(fresh.id));
  };

  /**
   * 更新单个变量定义。
   * 若变量名（key）变了，同步把正文里的 {{旧名}} / {{#if 旧名}} 一起改掉，
   * 否则正文里的 token 会变成没人认领的孤儿。
   */
  const patchVariable = (next: TemplateVariable) => {
    const prev = template.variables.find((v) => v.id === next.id);
    const variables = template.variables.map((v) => (v.id === next.id ? next : v));
    if (prev && prev.key && next.key && prev.key !== next.key) {
      const content = renameKeyInContent(template.content, prev.key, next.key);
      updateTemplate(template.id, { variables, content });
      return;
    }
    updateVariables(template.id, variables);
  };

  const removeVariable = (id: string) =>
    updateVariables(
      template.id,
      template.variables.filter((v) => v.id !== id),
    );

  const moveVariable = (id: string, delta: number) => {
    const list = [...template.variables];
    const from = list.findIndex((v) => v.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    updateVariables(template.id, list);
  };

  /** 把正文里出现但未定义的 {{key}} 一键补成变量 */
  const scanVariables = () => {
    if (undefinedKeys.length === 0) {
      notify('正文里的变量都已定义', 'info');
      return;
    }
    const created: TemplateVariable[] = undefinedKeys.map((key) => ({
      id: uid('var'),
      key,
      label: key,
      type: 'text' as VariableType,
      required: false,
      defaultValue: '',
    }));
    updateVariables(template.id, [...template.variables, ...created]);
    notify(`已补全 ${created.length} 个变量定义`);
  };

  return (
    <div className="editor">
      <div className="editor__inner">
        {/* ---------------- 基本信息 ---------------- */}
        <section className="section">
          <input
            className="title-input"
            value={template.title}
            placeholder="模板名称"
            onChange={(e) => updateTemplate(template.id, { title: e.target.value })}
          />
          <input
            className="input"
            style={{ marginTop: 'var(--sp-2)', border: 'none', background: 'transparent', padding: 0, color: 'var(--text-muted)' }}
            value={template.description ?? ''}
            placeholder="一句话描述这个模板做什么（可选）"
            onChange={(e) => updateTemplate(template.id, { description: e.target.value })}
          />

          <div className="field-row" style={{ marginTop: 'var(--sp-4)' }}>
            <div className="field">
              <label className="field__label">
                <Icon name="folder" size={13} />
                分类
              </label>
              <select
                className="select"
                value={template.categoryId ?? ''}
                onChange={(e) =>
                  updateTemplate(template.id, { categoryId: e.target.value || null })
                }
              >
                <option value="">未分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label">
                <Icon name="tag" size={13} />
                标签
              </label>
              <TagInput
                tags={template.tags}
                onChange={(tags) => updateTemplate(template.id, { tags })}
              />
            </div>
          </div>
        </section>

        {/* ---------------- 正文 ---------------- */}
        <section className="section">
          <div className="section__head">
            <h3 className="section__title">
              提示词正文
              <span className="section__desc">
                用 <code className="code-hint">{'{{变量名}}'}</code> 插入变量，
                <code className="code-hint">{'{{#if 变量}}…{{/if}}'}</code> 做条件段落
              </span>
            </h3>
          </div>

          <div className="content-toolbar">
            {template.variables.length > 0 && (
              <>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginRight: 4 }}>
                  插入变量：
                </span>
                {template.variables.map((v) => (
                  <button
                    key={v.id}
                    className="btn btn--sm"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }}
                    title={`插入 ${v.key}`}
                    onClick={() => insertAtCursor(`{{${v.key}}}`)}
                  >
                    {v.key}
                  </button>
                ))}
              </>
            )}
            <span style={{ flex: 1 }} />
            <button
              className="btn btn--sm"
              title="插入一个条件块"
              onClick={() =>
                insertAtCursor(
                  `{{#if ${template.variables[0]?.key ?? 'flag'}}}\n条件成立时输出的内容\n{{/if}}`,
                )
              }
            >
              <Icon name="braces" size={13} />
              条件块
            </button>
            <button className="btn btn--sm" onClick={scanVariables} title="把正文里未定义的变量补成定义">
              <Icon name="wand" size={13} />
              扫描变量
            </button>
          </div>

          {undefinedKeys.length > 0 && (
            <div className="hint-banner">
              <Icon name="alert" size={15} />
              <div className="hint-banner__body">
                正文引用了 {undefinedKeys.length} 个未定义变量：
                {undefinedKeys.map((k) => (
                  <code className="code-hint" key={k} style={{ marginLeft: 4 }}>
                    {`{{${k}}}`}
                  </code>
                ))}
              </div>
              <button className="btn btn--sm" onClick={scanVariables}>
                一键补全
              </button>
            </div>
          )}

          {duplicateKeys.size > 0 && (
            <div className="hint-banner">
              <Icon name="alert" size={15} />
              <div className="hint-banner__body">
                变量名重复：{[...duplicateKeys].join('、')} —— 重复时只有第一个生效，请改名。
              </div>
            </div>
          )}

          {unusedVars.length > 0 && (
            <div className="hint-banner hint-banner--info">
              <Icon name="info" size={15} />
              <div className="hint-banner__body">
                有 {unusedVars.length} 个变量定义了但正文没用到：
                {unusedVars.map((v) => (
                  <code className="code-hint" key={v.id} style={{ marginLeft: 4 }}>
                    {v.key}
                  </code>
                ))}
              </div>
            </div>
          )}

          <textarea
            ref={contentRef}
            className="textarea textarea--mono"
            style={{ minHeight: 260 }}
            value={template.content}
            placeholder={'例如：\n请以{{tone}}的语气，围绕「{{topic}}」写一篇约 {{words}} 的文章。\n{{#if with_example}}要求结合真实案例。{{/if}}'}
            onChange={(e) => updateTemplate(template.id, { content: e.target.value })}
          />
        </section>

        {/* ---------------- 变量定义 ---------------- */}
        <section className="section">
          <div className="section__head">
            <h3 className="section__title">
              变量定义
              <span className="section__desc">共 {template.variables.length} 个</span>
            </h3>
            {template.variables.length > 1 && (
              <button
                className="btn btn--sm"
                onClick={() =>
                  setExpanded((prev) =>
                    prev.size > 0 ? new Set() : new Set(template.variables.map((v) => v.id)),
                  )
                }
              >
                {expanded.size > 0 ? '全部收起' : '全部展开'}
              </button>
            )}
          </div>

          {template.variables.map((variable, index) => (
            <VariableEditor
              key={variable.id}
              variable={variable}
              index={index}
              total={template.variables.length}
              duplicateKey={duplicateKeys.has(variable.key)}
              expanded={expanded.has(variable.id)}
              onToggleExpand={() => toggleExpand(variable.id)}
              onChange={patchVariable}
              onRemove={() => removeVariable(variable.id)}
              onMove={(delta) => moveVariable(variable.id, delta)}
            />
          ))}

          <div className="add-var-menu" style={{ marginTop: 'var(--sp-3)' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>
              添加变量：
            </span>
            {VARIABLE_TYPES.map((meta) => (
              <button
                key={meta.type}
                className="btn btn--sm add-var-btn"
                onClick={() => addVariable(meta.type)}
                title={meta.hint}
              >
                <Icon name={meta.icon as IconName} size={13} />
                {meta.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
