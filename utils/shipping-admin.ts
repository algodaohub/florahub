import type { ShippingSecretState } from '~/types/shipping'

export function secretPlaceholder(state: ShippingSecretState, fallback: string) {
  return state.has ? `Đang dùng ${state.hint} — để trống nếu không đổi` : fallback
}

export const GOSHIP_BASE_URLS = {
  sandbox: 'https://sandbox.goship.io/api/v2',
  production: 'https://api.goship.io/api/v2'
} as const
