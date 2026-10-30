/**
 * Luồng trạng thái đơn hàng & thanh toán dùng chung client + server.
 * Đã thanh toán (`paid`) chỉ đi tiếp sang `refunded`; không bao giờ quay lại `pending`.
 */
export const ORDER_STATUS_FLOW: Record<string, readonly string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['completed'],
  completed: [],
  cancelled: []
}

export const PAYMENT_STATUS_FLOW: Record<string, readonly string[]> = {
  '': ['pending', 'cod', 'paid'],
  pending: ['paid'],
  cod: ['paid'],
  paid: ['refunded'],
  refunded: []
}

export function canSetOrderStatus(from: unknown, to: unknown): boolean {
  const current = String(from ?? '')
  const next = String(to ?? '')
  if (current === next) return true
  return (ORDER_STATUS_FLOW[current] ?? []).includes(next)
}

export function canSetPaymentStatus(from: unknown, to: unknown): boolean {
  const current = String(from ?? '')
  const next = String(to ?? '')
  if (current === next) return true
  return (PAYMENT_STATUS_FLOW[current] ?? []).includes(next)
}

export function canCancelOrder(status: unknown): boolean {
  return (ORDER_STATUS_FLOW[String(status ?? '')] ?? []).includes('cancelled')
}
