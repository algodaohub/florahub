import type { StorePaymentMethod, StorePaymentQr, StorePayments } from '~/types/store'

export const paymentMethodLabels: Record<StorePaymentMethod, string> = {
  qr: 'VietQR — miễn phí',
  cod: 'Thanh toán khi nhận hàng',
  sepay: 'Cổng SePay — có phí'
}

/** QR chỉ dùng được khi bật và đã có ngân hàng + số tài khoản. */
export function isQrPaymentReady(payments: { qr: StorePaymentQr } | null | undefined) {
  const qr = payments?.qr
  return Boolean(qr?.enabled && qr.bankId.trim() && qr.accountNo.trim())
}

/** SePay chỉ dùng được khi admin bật và merchant key đã lưu trong database. */
export function isSepayReady(payments: StorePayments | null | undefined) {
  return payments?.sepay?.enabled === true && payments.sepay.ready === true
}

/**
 * Phương thức áp dụng cho đơn hàng mới, lấy từ cấu hình hệ thống.
 * SePay tắt/thiếu credentials hoặc QR thiếu thông tin ngân hàng thì tự lùi về COD.
 */
export function resolvePaymentMethod(
  payments: StorePayments | null | undefined,
  sepayReady = isSepayReady(payments)
): StorePaymentMethod {
  if (!payments) return 'cod'
  if (payments.method === 'sepay' && sepayReady) return 'sepay'
  if (payments.method === 'qr' || payments.method === 'sepay') {
    return isQrPaymentReady(payments) ? 'qr' : 'cod'
  }
  return 'cod'
}

/** Trạng thái thanh toán lưu cùng đơn hàng lúc tạo. */
export function initialPaymentStatus(method: StorePaymentMethod) {
  return method === 'cod' ? 'cod' : 'pending'
}

export function buildVietQrUrl(
  payments: { qr: StorePaymentQr } | null | undefined,
  options: { amount?: number; addInfo?: string } = {}
) {
  if (!isQrPaymentReady(payments)) return ''
  const qr = payments!.qr
  const params = new URLSearchParams()
  if (options.amount && options.amount > 0) params.set('amount', String(Math.round(options.amount)))
  if (options.addInfo) params.set('addInfo', options.addInfo)
  if (qr.accountName) params.set('accountName', qr.accountName)
  const query = params.toString()
  const path = `${encodeURIComponent(qr.bankId)}-${encodeURIComponent(qr.accountNo)}-${qr.template}.png`
  return `https://img.vietqr.io/image/${path}${query ? `?${query}` : ''}`
}

/** Chia nhóm số tài khoản để dễ đọc; giá trị sao chép vẫn dùng số gốc. */
export function formatBankAccount(accountNo: string) {
  return String(accountNo ?? '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
}
