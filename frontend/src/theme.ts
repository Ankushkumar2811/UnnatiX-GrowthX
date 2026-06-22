// UnnatiX GrowthX – design tokens (mirrors /app/design_guidelines.json)

export const theme = {
  color: {
    surface: '#0C0C0C',
    onSurface: '#F5F5F5',
    surfaceSecondary: '#161616',
    onSurfaceSecondary: '#D4D4D4',
    surfaceTertiary: '#222222',
    onSurfaceTertiary: '#A3A3A3',
    brand: '#FF4400',
    brandSecondary: '#FF7300',
    brandTertiary: '#3B1605',
    onBrand: '#FFFFFF',
    success: '#00E676',
    warning: '#FFC400',
    error: '#FF1744',
    info: '#00E5FF',
    border: '#2A2A2A',
    borderStrong: '#444444',
    divider: '#1F1F1F',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xl2: 32, xl3: 48 },
  radius: { sm: 4, md: 8, lg: 16, pill: 999 },
  type: {
    display: { fontWeight: '700' as const, letterSpacing: 0.5 },
    h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.4 },
    h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.3 },
    h3: { fontSize: 18, fontWeight: '600' as const },
    body: { fontSize: 14, fontWeight: '400' as const },
    label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
    small: { fontSize: 12, fontWeight: '400' as const },
  },
};

export const AGENT_META: Record<string, { name: string; role: string; accent: string }> = {
  ceo: { name: 'Aurora', role: 'CEO AI', accent: '#FF4400' },
  marketing: { name: 'Vega', role: 'Marketing AI', accent: '#FF7300' },
  sales: { name: 'Atlas', role: 'Sales AI', accent: '#00E676' },
  research: { name: 'Iris', role: 'Research AI', accent: '#00E5FF' },
  developer: { name: 'Nova', role: 'Developer AI', accent: '#A78BFA' },
  operations: { name: 'Orion', role: 'Operations AI', accent: '#FFC400' },
  finance: { name: 'Sterling', role: 'Finance AI', accent: '#F59E0B' },
  hr: { name: 'Sage', role: 'HR AI', accent: '#EC4899' },
};
