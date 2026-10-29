/** Nhãn & phép tính kế toán dùng chung client + server (VND, giá đã gồm GTGT). */

export const ACCOUNT_NAMES: Record<string, string> = {
  '111': 'Tiền mặt',
  '112': 'Tiền gửi ngân hàng',
  '131': 'Phải thu của khách hàng',
  '511': 'Doanh thu bán hàng và cung cấp dịch vụ',
  '3331': 'Thuế GTGT phải nộp',
  '5212': 'Hàng bán bị trả lại'
}

export const INVOICE_STATUS_META: Record<string, { label: string; tone: 'gray' | 'green' | 'rose' }> = {
  '': { label: 'Chưa xuất', tone: 'gray' },
  issued: { label: 'Đã xuất', tone: 'green' },
  cancelled: { label: 'Đã huỷ', tone: 'rose' }
}

export function accountName(account: string) {
  return ACCOUNT_NAMES[account] ?? account
}

/** Tách thuế GTGT từ giá đã bao gồm thuế. */
export function vatFromGross(gross: number, ratePercent: number) {
  const rate = Math.min(100, Math.max(0, Number(ratePercent) || 0))
  if (!gross || rate <= 0) return 0
  return Math.round((gross * rate) / (100 + rate))
}

export function vatRateLabel(ratePercent: number) {
  const rate = Math.min(100, Math.max(0, Number(ratePercent) || 0))
  return rate > 0 ? `${rate}%` : 'không chịu thuế'
}

export function invoiceStatusMeta(status: string) {
  return INVOICE_STATUS_META[status] ?? INVOICE_STATUS_META['']
}

/** Số hoá đơn tuần tự theo năm, ví dụ HD2026-000001. */
export function formatInvoiceNumber(year: number, sequence: number) {
  return `HD${year}-${String(sequence).padStart(6, '0')}`
}

export function parseInvoiceSequence(value: string) {
  const match = /-(\d+)$/.exec(String(value ?? ''))
  return match ? Number(match[1]) : 0
}
