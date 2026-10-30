export type BadgeTone = 'gray' | 'green' | 'amber' | 'blue' | 'rose' | 'violet' | 'emerald'

export const ORDER_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Chờ xác nhận', tone: 'amber' },
  confirmed: { label: 'Đã xác nhận', tone: 'blue' },
  shipping: { label: 'Đang giao', tone: 'violet' },
  completed: { label: 'Hoàn tất', tone: 'green' },
  cancelled: { label: 'Đã huỷ', tone: 'rose' }
}

export const PAYMENT_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  '': { label: 'Chưa có TT', tone: 'gray' },
  pending: { label: 'Chờ thanh toán', tone: 'amber' },
  cod: { label: 'Thu khi giao', tone: 'blue' },
  paid: { label: 'Đã thanh toán', tone: 'green' },
  refunded: { label: 'Đã hoàn tiền', tone: 'violet' }
}

export const PRODUCT_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  published: { label: 'Đang bán', tone: 'green' },
  draft: { label: 'Nháp', tone: 'gray' },
  archived: { label: 'Đã ẩn', tone: 'amber' }
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'COD',
  bank: 'Chuyển khoản',
  qr: 'VietQR',
  sepay: 'Cổng SePay (có phí)',
  vnpay: 'VNPay',
  momo: 'MoMo'
}

export const COMMISSION_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Chờ duyệt', tone: 'amber' },
  approved: { label: 'Khả dụng', tone: 'blue' },
  processing: { label: 'Đang chi trả', tone: 'violet' },
  paid: { label: 'Đã chi trả', tone: 'green' },
  cancelled: { label: 'Đã huỷ', tone: 'rose' }
}

export const PAYOUT_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Phiếu nháp', tone: 'amber' },
  paid: { label: 'Đã chi', tone: 'green' },
  cancelled: { label: 'Đã huỷ', tone: 'rose' }
}

export const PAYOUT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Chuyển khoản ngân hàng',
  cash: 'Tiền mặt',
  other: 'Khác'
}

export function payoutStatusMeta(status: string) {
  return PAYOUT_STATUS_META[status] ?? { label: status || '—', tone: 'gray' as BadgeTone }
}

export function payoutMethodLabel(method: string) {
  return PAYOUT_METHOD_LABELS[method] ?? (method ? method : 'Chưa xác định')
}

export function commissionStatusMeta(status: string) {
  return COMMISSION_STATUS_META[status] ?? { label: status || '—', tone: 'gray' as BadgeTone }
}

export function orderStatusMeta(status: string) {
  return ORDER_STATUS_META[status] ?? { label: status || '—', tone: 'gray' as BadgeTone }
}

export function paymentStatusMeta(status: string) {
  return PAYMENT_STATUS_META[status] ?? { label: status || '—', tone: 'gray' as BadgeTone }
}

export function productStatusMeta(status: string) {
  return PRODUCT_STATUS_META[status] ?? { label: status || '—', tone: 'gray' as BadgeTone }
}

export function paymentMethodLabel(method: string) {
  return PAYMENT_METHOD_LABELS[method] ?? method ?? '—'
}

export function formatCompactVnd(value: number) {
  if (value >= 1_000_000_000) return `${Math.round(value / 100_000_000) / 10} tỷ`
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10} tr`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(value)
}

export function toDateInput(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}
