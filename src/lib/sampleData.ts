import { DEFAULT_SYNC, type AppData } from '../types';
import { uid } from './id';

/** 首次启动时写入的示例数据，覆盖全部 7 种变量类型，方便大哥直接上手体验 */
export function createSampleData(): AppData {
  const now = Date.now();
  const catWriting = uid('cat');
  const catCoding = uid('cat');
  const catImage = uid('cat');

  return {
    schemaVersion: 1,
    categories: [
      { id: catWriting, name: '写作 / 文案', color: '#2563eb', order: 0, updatedAt: now },
      { id: catCoding, name: '编程 / 开发', color: '#16a34a', order: 1, updatedAt: now },
      { id: catImage, name: '绘画 / 生图', color: '#d946ef', order: 2, updatedAt: now },
    ],
    templates: [
      {
        id: uid('tpl'),
        title: '通用文章撰写',
        description: '按主题、受众、语气生成一篇结构化文章',
        categoryId: catWriting,
        tags: ['写作', '通用'],
        favorite: true,
        createdAt: now - 86400000 * 3,
        updatedAt: now - 3600000,
        lastUsedAt: now - 3600000,
        useCount: 5,
        content:
          '你是一名资深{{domain}}领域的内容创作者。\n\n请围绕主题「{{topic}}」，面向【{{audience}}】写一篇{{tone}}风格的文章，篇幅约 {{words}}。\n\n要求：\n1. 结构清晰，有小标题；\n2. {{#if with_example}}结合真实案例说明；{{else}}以观点论述为主；{{/if}}\n3. 覆盖以下要点：{{points}}。\n{{#if seo}}\n额外要求：面向 SEO 优化，自然融入关键词。\n{{/if}}',
        variables: [
          { id: uid('var'), key: 'domain', label: '领域', type: 'text', required: true, placeholder: '如：人工智能 / 健身', defaultValue: '人工智能' },
          { id: uid('var'), key: 'topic', label: '文章主题', type: 'text', required: true, placeholder: '一句话说明要写什么' },
          {
            id: uid('var'),
            key: 'audience',
            label: '目标读者',
            type: 'select',
            required: true,
            options: [
              { id: uid('opt'), label: '普通大众', value: '普通大众' },
              { id: uid('opt'), label: '行业从业者', value: '行业从业者' },
              { id: uid('opt'), label: '技术专家', value: '技术专家' },
            ],
            defaultValue: '普通大众',
          },
          {
            id: uid('var'),
            key: 'tone',
            label: '语气风格',
            type: 'select',
            options: [
              { id: uid('opt'), label: '专业严谨', value: '专业严谨' },
              { id: uid('opt'), label: '轻松口语', value: '轻松口语' },
              { id: uid('opt'), label: '幽默风趣', value: '幽默风趣' },
            ],
            defaultValue: '专业严谨',
          },
          { id: uid('var'), key: 'words', label: '篇幅字数', type: 'number', min: 100, max: 5000, step: 100, unit: ' 字', defaultValue: 800 },
          {
            id: uid('var'),
            key: 'points',
            label: '关键要点',
            type: 'multiselect',
            separator: '、',
            options: [
              { id: uid('opt'), label: '背景介绍', value: '背景介绍' },
              { id: uid('opt'), label: '核心原理', value: '核心原理' },
              { id: uid('opt'), label: '应用场景', value: '应用场景' },
              { id: uid('opt'), label: '优缺点分析', value: '优缺点分析' },
              { id: uid('opt'), label: '未来趋势', value: '未来趋势' },
            ],
            defaultValue: ['背景介绍', '应用场景'],
          },
          { id: uid('var'), key: 'with_example', label: '结合案例', type: 'toggle', onText: '是', offText: '', defaultValue: true },
          { id: uid('var'), key: 'seo', label: 'SEO 优化', type: 'toggle', defaultValue: false },
        ],
      },
      {
        id: uid('tpl'),
        title: '代码审查助手',
        description: '让 AI 以指定语言和侧重点审查代码',
        categoryId: catCoding,
        tags: ['编程', 'Code Review'],
        favorite: false,
        createdAt: now - 86400000 * 2,
        updatedAt: now - 86400000,
        lastUsedAt: now - 86400000,
        useCount: 2,
        content:
          '请作为一名资深 {{language}} 工程师，审查下面的代码。\n\n审查侧重点：{{focus}}。\n严格程度：{{strictness}}/5。\n\n```{{language}}\n{{code}}\n```\n\n请指出问题并给出改进后的代码。',
        variables: [
          {
            id: uid('var'),
            key: 'language',
            label: '编程语言',
            type: 'select',
            required: true,
            options: [
              { id: uid('opt'), label: 'TypeScript', value: 'typescript' },
              { id: uid('opt'), label: 'Python', value: 'python' },
              { id: uid('opt'), label: 'Rust', value: 'rust' },
              { id: uid('opt'), label: 'Go', value: 'go' },
            ],
            defaultValue: 'typescript',
          },
          {
            id: uid('var'),
            key: 'focus',
            label: '审查侧重点',
            type: 'multiselect',
            separator: '、',
            options: [
              { id: uid('opt'), label: '性能', value: '性能' },
              { id: uid('opt'), label: '安全', value: '安全' },
              { id: uid('opt'), label: '可读性', value: '可读性' },
              { id: uid('opt'), label: '最佳实践', value: '最佳实践' },
            ],
            defaultValue: ['可读性', '最佳实践'],
          },
          { id: uid('var'), key: 'strictness', label: '严格程度', type: 'number', min: 1, max: 5, step: 1, defaultValue: 3 },
          { id: uid('var'), key: 'code', label: '待审查代码', type: 'textarea', required: true, placeholder: '在此粘贴代码…' },
        ],
      },
      {
        id: uid('tpl'),
        title: '会议纪要整理',
        description: '把零散记录整理成规范纪要，演示日期类型变量',
        categoryId: catWriting,
        tags: ['效率', '职场'],
        favorite: false,
        createdAt: now - 86400000 * 5,
        updatedAt: now - 86400000 * 4,
        lastUsedAt: null,
        useCount: 0,
        content:
          '请把下面的会议记录整理成规范的会议纪要。\n\n会议日期：{{meet_date}}\n参会人：{{attendees}}\n\n原始记录：\n"""\n{{raw}}\n"""\n\n输出要求：\n- 分「结论」「讨论要点」两部分；\n{{#if action_items}}- 单独列出待办事项表格，包含负责人与截止时间；{{/if}}\n- 使用{{lang}}输出。',
        variables: [
          { id: uid('var'), key: 'meet_date', label: '会议日期', type: 'date', dateFormat: 'YYYY年M月D日', defaultValue: 'today', required: true },
          { id: uid('var'), key: 'attendees', label: '参会人', type: 'text', placeholder: '张三、李四' },
          { id: uid('var'), key: 'raw', label: '原始记录', type: 'textarea', required: true, placeholder: '把速记内容粘贴进来…' },
          { id: uid('var'), key: 'action_items', label: '生成待办清单', type: 'toggle', defaultValue: true },
          {
            id: uid('var'),
            key: 'lang',
            label: '输出语言',
            type: 'select',
            options: [
              { id: uid('opt'), label: '中文', value: '中文' },
              { id: uid('opt'), label: '英文', value: '英文' },
            ],
            defaultValue: '中文',
          },
        ],
      },
      {
        id: uid('tpl'),
        title: 'Midjourney 出图提示',
        description: '快速拼装英文绘画提示词',
        categoryId: catImage,
        tags: ['绘画', 'Midjourney'],
        favorite: true,
        createdAt: now - 86400000,
        updatedAt: now - 7200000,
        lastUsedAt: now - 7200000,
        useCount: 8,
        content:
          '{{subject}}, {{style}}, {{lighting}}{{#if hd}}, ultra detailed, 8k{{/if}} --ar {{ratio}} {{#if niji}}--niji 6{{/if}}',
        variables: [
          { id: uid('var'), key: 'subject', label: '主体描述', type: 'text', required: true, placeholder: 'a cyberpunk city at night' },
          {
            id: uid('var'),
            key: 'style',
            label: '风格',
            type: 'select',
            options: [
              { id: uid('opt'), label: '写实摄影', value: 'photorealistic' },
              { id: uid('opt'), label: '油画', value: 'oil painting' },
              { id: uid('opt'), label: '动漫', value: 'anime style' },
              { id: uid('opt'), label: '3D 渲染', value: '3d render' },
            ],
            defaultValue: 'photorealistic',
          },
          {
            id: uid('var'),
            key: 'lighting',
            label: '光照',
            type: 'select',
            options: [
              { id: uid('opt'), label: '柔光', value: 'soft lighting' },
              { id: uid('opt'), label: '霓虹', value: 'neon lighting' },
              { id: uid('opt'), label: '黄金时刻', value: 'golden hour' },
            ],
            defaultValue: 'neon lighting',
          },
          {
            id: uid('var'),
            key: 'ratio',
            label: '画幅比例',
            type: 'select',
            options: [
              { id: uid('opt'), label: '16:9', value: '16:9' },
              { id: uid('opt'), label: '1:1', value: '1:1' },
              { id: uid('opt'), label: '9:16', value: '9:16' },
            ],
            defaultValue: '16:9',
          },
          { id: uid('var'), key: 'hd', label: '高清细节', type: 'toggle', defaultValue: true },
          { id: uid('var'), key: 'niji', label: 'Niji 模式', type: 'toggle', defaultValue: false },
        ],
      },
    ],
    settings: {
      theme: 'system',
      accent: '#2563eb',
      globalShortcut: 'CmdOrCtrl+Shift+P',
      hideAfterCopy: false,
      sync: DEFAULT_SYNC,
    },
  };
}
