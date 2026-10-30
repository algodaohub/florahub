const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']

function readTriple(value: number, forceHundred: boolean): string {
  const hundred = Math.floor(value / 100)
  const ten = Math.floor((value % 100) / 10)
  const unit = value % 10
  const parts: string[] = []

  if (hundred > 0 || forceHundred) parts.push(`${DIGITS[hundred]} trăm`)

  if (ten > 1) {
    parts.push(`${DIGITS[ten]} mươi`)
    if (unit === 1) parts.push('mốt')
    else if (unit === 5) parts.push('lăm')
    else if (unit > 0) parts.push(DIGITS[unit])
  } else if (ten === 1) {
    parts.push('mười')
    if (unit === 5) parts.push('lăm')
    else if (unit > 0) parts.push(DIGITS[unit])
  } else if (unit > 0) {
    if (hundred > 0 || forceHundred) parts.push('lẻ')
    parts.push(DIGITS[unit])
  }

  return parts.join(' ')
}

/** Đọc số tiền VND thành chữ, phục vụ phiếu chi/đối soát. */
export function amountInWords(value: number): string {
  const amount = Math.max(0, Math.round(Number(value) || 0))
  if (amount === 0) return 'Không đồng'

  const groups: number[] = []
  let remaining = amount
  while (remaining > 0) {
    groups.push(remaining % 1000)
    remaining = Math.floor(remaining / 1000)
  }

  const parts: string[] = []
  let seenHigher = false
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index]!
    if (group === 0) continue
    const words = readTriple(group, seenHigher)
    const scale = SCALES[index] ?? 'tỷ'
    parts.push(scale ? `${words} ${scale}` : words)
    seenHigher = true
  }

  const text = parts.join(' ').replace(/\s+/g, ' ').trim()
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`
}
