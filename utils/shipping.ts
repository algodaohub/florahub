import type { ShippingOptionBadge } from '~/types/shipping'

const SHIPPING_BADGE_LABELS: Record<ShippingOptionBadge, string> = {
  cheapest: 'Rẻ nhất',
  fastest: 'Nhanh nhất',
  recommended: 'Đề xuất',
  fallback: 'Tạm tính'
}

export function shippingBadgeLabel(badge: ShippingOptionBadge) {
  return SHIPPING_BADGE_LABELS[badge] ?? badge
}

export type ShippingStatusTone = 'gray' | 'green' | 'amber' | 'blue' | 'rose' | 'violet'

export type ShippingStatusMeta = { label: string; tone: ShippingStatusTone }

/** Nhóm trạng thái Goship: 903/904 đang giao, 905/913 đã giao, 907/908 chuyển hoàn, 914 huỷ. */
export function shippingStatusMeta(code: number, statusText = ''): ShippingStatusMeta {
  const text = String(statusText ?? '').trim()
  if (code === 905 || code === 913) return { label: text || 'Đã giao', tone: 'green' }
  if (code === 903 || code === 904) return { label: text || 'Đang giao', tone: 'blue' }
  if (code === 907 || code === 908) return { label: text || 'Chuyển hoàn', tone: 'violet' }
  if (code === 914) return { label: text || 'Đã huỷ vận đơn', tone: 'rose' }
  if (code === 906) return { label: text || 'Đang xử lý', tone: 'amber' }
  if (code === 1000) return { label: text || 'Đơn lỗi', tone: 'amber' }
  if (text) return { label: text, tone: 'gray' }
  return { label: 'Chưa có vận đơn', tone: 'gray' }
}
