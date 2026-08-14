/**
 * 极简线性图标集（24×24 网格，1.6px 描边，随 currentColor 变色）
 * 全部内联为 path，避免引入图标库依赖，也方便按需增删。
 */

const PATHS: Record<string, string[]> = {
  braces: [
    'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1',
    'M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1',
  ],
  search: ['M3 11a8 8 0 1 0 16 0 8 8 0 1 0-16 0', 'm21 21-4.35-4.35'],
  plus: ['M5 12h14', 'M12 5v14'],
  star: [
    'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45L2.6 9.45l6.5-.95z',
  ],
  copy: [
    'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  pencil: ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z'],
  play: ['M6 4l14 8-14 8z'],
  trash: [
    'M3 6h18',
    'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2',
    'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  ],
  folder: ['M4 20a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5l2 3H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z'],
  tag: [
    'M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z',
    'M7.5 7.5h.01',
  ],
  sliders: [
    'M4 21v-7',
    'M4 10V3',
    'M12 21v-9',
    'M12 8V3',
    'M20 21v-5',
    'M20 12V3',
    'M1 14h6',
    'M9 8h6',
    'M17 16h6',
  ],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  chevronLeft: ['m15 18 -6-6 6-6'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  check: ['M20 6 9 17l-5-5'],
  panelLeft: [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M9 3v18',
  ],
  sun: [
    'M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
    'M12 2v2',
    'M12 20v2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'M4.9 19.1l1.4-1.4',
    'M17.7 6.3l1.4-1.4',
  ],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'],
  monitor: [
    'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M8 21h8',
    'M12 17v4',
  ],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 8 5-5 5 5', 'M12 3v12'],
  more: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
  grip: ['M9 5h.01', 'M9 12h.01', 'M9 19h.01', 'M15 5h.01', 'M15 12h.01', 'M15 19h.01'],
  clock: ['M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0', 'M12 7v5l3.5 2'],
  calendar: [
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
  ],
  hash: ['M4 9h16', 'M4 15h16', 'M10 3 8 21', 'M16 3l-2 18'],
  text: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16'],
  textarea: ['M4 6h16', 'M4 11h16', 'M4 16h10'],
  select: ['m7 15 5 5 5-5', 'm7 9 5-5 5 5'],
  multiselect: [
    'M8 6h13',
    'M8 12h13',
    'M8 18h13',
    'M3 6h.01',
    'M3 12h.01',
    'M3 18h.01',
  ],
  toggle: ['M8 6h8a6 6 0 0 1 0 12H8A6 6 0 0 1 8 6z', 'M14 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0'],
  wand: [
    'M15 4V2',
    'M15 16v-2',
    'M8 9h2',
    'M20 9h2',
    'M17.8 11.8 19 13',
    'M15 9h.01',
    'M17.8 6.2 19 5',
    'm3 21 9-9',
    'M12.2 6.2 11 5',
  ],
  refresh: ['M21 12a9 9 0 1 1-3.2-6.9', 'M21 3v6h-6'],
  alert: [
    'm21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z',
    'M12 9v4',
    'M12 17h.01',
  ],
  info: ['M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0', 'M12 16v-5', 'M12 8h.01'],
  inbox: [
    'M22 12h-6l-2 3h-4l-2-3H2',
    'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  ],
  keyboard: [
    'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
    'M6 10h.01',
    'M10 10h.01',
    'M14 10h.01',
    'M18 10h.01',
    'M7 14h10',
  ],
  insert: ['M9 10 4 15l5 5', 'M20 4v7a4 4 0 0 1-4 4H4'],
  arrowUp: ['m18 15-6-6-6 6'],
  arrowDown: ['m6 9 6 6 6-6'],
  layers: ['m12 2 9 5-9 5-9-5z', 'm3 12 9 5 9-5', 'm3 17 9 5 9-5'],
  sparkles: ['M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z', 'M19 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 'M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0'],
  eyeOff: [
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z',
    'M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
    'M3 3l18 18',
  ],
  cloud: [
    'M6.5 19a4.5 4.5 0 0 1-.5-8.97 6 6 0 0 1 11.64-1.6A4 4 0 0 1 18 19z',
    'M9 13l2 2 4-4',
  ],
};

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** 实心填充（用于收藏星标等状态） */
  solid?: boolean;
  className?: string;
}

export function Icon({ name, size = 16, strokeWidth = 1.6, solid = false, className }: IconProps) {
  const paths = PATHS[name] ?? [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
