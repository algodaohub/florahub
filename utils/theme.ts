import type { StoreConfig, StoreFontKey, StoreShape } from '~/types/store'

export const fontStacks: Record<StoreFontKey, string> = {
  lora: "'Lora', Georgia, serif",
  playfair: "'Playfair Display', Georgia, serif",
  nunito: "'Nunito', 'Be Vietnam Pro', system-ui, sans-serif",
  inter: "'Inter', system-ui, -apple-system, sans-serif",
  'be-vietnam': "'Be Vietnam Pro', system-ui, -apple-system, sans-serif"
}

export const fontOptions: Array<{ value: StoreFontKey; label: string }> = [
  { value: 'lora', label: 'Lora (serif ấm)' },
  { value: 'playfair', label: 'Playfair Display (serif sang)' },
  { value: 'be-vietnam', label: 'Be Vietnam Pro (sans)' },
  { value: 'inter', label: 'Inter (sans tối giản)' },
  { value: 'nunito', label: 'Nunito (sans tròn)' }
]

const shadows: Record<StoreShape['shadow'], { soft: string; card: string }> = {
  none: { soft: '0 0 0 0 rgba(0,0,0,0)', card: '0 0 0 0 rgba(0,0,0,0)' },
  soft: { soft: '0 4px 14px -8px rgba(27, 26, 22, 0.22)', card: '0 10px 30px -18px rgba(27, 26, 22, 0.28)' },
  strong: { soft: '0 8px 20px -10px rgba(27, 26, 22, 0.35)', card: '0 18px 42px -20px rgba(27, 26, 22, 0.45)' }
}

export function hexToRgbTriplet(hex: string): string {
  const value = hex.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(value)) return ''
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value
  const number = Number.parseInt(full, 16)
  return `${(number >> 16) & 255} ${(number >> 8) & 255} ${number & 255}`
}

export function themeVars(config: StoreConfig): Record<string, string> {
  const { colors, typography, shape, layout } = config
  const shadow = shadows[shape.shadow] ?? shadows.soft
  // One typeface for the whole storefront: the body font is also used for display text.
  const bodyFont = fontStacks[typography.bodyFont] ?? fontStacks['be-vietnam']

  return {
    '--color-primary': hexToRgbTriplet(colors.primary),
    '--color-primary-dark': hexToRgbTriplet(colors.primaryDark),
    '--color-primary-soft': hexToRgbTriplet(colors.primarySoft),
    '--color-on-primary': hexToRgbTriplet(colors.onPrimary),
    '--color-accent': hexToRgbTriplet(colors.accent),
    '--color-accent-soft': hexToRgbTriplet(colors.accentSoft),
    '--color-paper': hexToRgbTriplet(colors.paper),
    '--color-paper-deep': hexToRgbTriplet(colors.paperDeep),
    '--color-ink': hexToRgbTriplet(colors.ink),
    '--color-muted': hexToRgbTriplet(colors.muted),
    '--color-hairline': hexToRgbTriplet(colors.hairline),
    '--color-discount': hexToRgbTriplet(colors.discount),
    '--font-display': bodyFont,
    '--font-body': bodyFont,
    '--font-display-weight': String(typography.displayWeight || 600),
    '--heading-tracking': typography.headingTracking || '-0.01em',
    '--radius-card': `${shape.cardRadius}px`,
    '--radius-btn': `${shape.buttonRadius}px`,
    '--radius-input': `${shape.inputRadius}px`,
    '--radius-img': `${shape.imageRadius}px`,
    '--shadow-soft': shadow.soft,
    '--shadow-card': shadow.card,
    '--shell-max': `${layout.shellWidth}px`,
    '--gutter': `${layout.gutter}px`,
    '--grid-cols': String(layout.productGridColumns),
    '--van-primary-color': `rgb(${hexToRgbTriplet(colors.primary) || '63 107 79'})`,
    '--van-text-color': `rgb(${hexToRgbTriplet(colors.ink) || '43 42 38'})`,
    '--van-background': `rgb(${hexToRgbTriplet(colors.paper) || '247 243 235'})`
  }
}

export function buildThemeDeclarations(config: StoreConfig): string {
  return Object.entries(themeVars(config))
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
}

export function buildThemeStyle(config: StoreConfig): string {
  return `:root{${buildThemeDeclarations(config)}}`
}
