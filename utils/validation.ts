/**
 * Chuẩn hoá số điện thoại Việt Nam: bỏ khoảng trắng, dấu chấm, gạch nối, ngoặc.
 * "090 123-4567" → "0901234567", "+84 90 123 4567" → "+84901234567".
 */
export function normalizePhone(value: string) {
  return String(value ?? '').replace(/[\s.\-()]/g, '')
}

/**
 * Hợp lệ với di động 10 số (0xxxxxxxxx), đầu số quốc tế +84/84
 * và số cố định 11 số (02xxxxxxxxx).
 */
export function isValidVietnamesePhone(value: string) {
  const phone = normalizePhone(value)
  if (!phone) return false
  if (/^0\d{9}$/.test(phone)) return true
  if (/^(?:\+84|84)\d{9}$/.test(phone)) return true
  return /^02\d{9}$/.test(phone)
}
