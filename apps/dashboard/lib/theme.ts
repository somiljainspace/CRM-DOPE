// CRM-DOPE design tokens — shared visual system
export const theme = {
  // Deep navy/graphite surfaces
  bg: '#0a0d13',
  bgSoft: '#0f131a',
  surface: '#141921',
  surface2: '#1a2029',
  surface3: '#202731',
  border: '#232b38',
  borderSoft: '#1c2330',
  // Text
  text: '#e9edf3',
  dim: '#949dac',
  sub: '#5f6a7a',
  // Indigo/violet accents
  accent: '#6366f1',
  accentSoft: '#818cf8',
  accentDeep: '#4f46e5',
  // Cyan/teal highlights
  highlight: '#06b6d4',
  highlightSoft: '#22d3ee',
  // Semantic
  success: '#34d399',
  danger: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
  // Shape
  radius: 16,
  radiusSm: 10,
  radiusLg: 22,
  radiusFull: 9999,
  // Depth
  shadowSm: '0 1px 2px rgba(0,0,0,.5)',
  shadow: '0 1px 3px rgba(0,0,0,.5), 0 8px 24px rgba(0,0,0,.35)',
  shadowLg: '0 4px 12px rgba(0,0,0,.45), 0 24px 64px rgba(0,0,0,.4)',
  // Type
  font: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  serif: "'Instrument Serif', Georgia, serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
} as const;

export const spacing = (n: number) => `${n * 4}px`;

export const transitions = {
  fast: '140ms cubic-bezier(0.4,0,0.2,1)',
  normal: '220ms cubic-bezier(0.4,0,0.2,1)',
  slow: '340ms cubic-bezier(0.4,0,0.2,1)',
  spring: '520ms cubic-bezier(0.34,1.56,0.64,1)',
} as const;

export const gradient = {
  hero: 'radial-gradient(1200px 500px at 20% -10%, rgba(99,102,241,.25), transparent 60%), radial-gradient(800px 400px at 90% 0%, rgba(6,182,212,.16), transparent 55%)',
  panel: 'linear-gradient(180deg, rgba(99,102,241,.08), transparent 70%)',
  accent: 'linear-gradient(135deg, #6366f1, #8b5cf6 45%, #06b6d4)',
  subtle: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(6,182,212,.08))',
} as const;
