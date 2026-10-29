/**
 * Chuẩn hoá tên đơn vị hành chính để so khớp dữ liệu cũ/mới.
 * "TP. Hồ Chí Minh" → "ho chi minh", "Tỉnh Đắk Lắk" → "dak lak".
 */
export function normalizeLocationName(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\b(thanh pho|tinh|tp|tp\.|phuong|thi tran|thi xa|dac khu|quan|huyen|xa)\b/g, ' ')
    .replace(/[.,\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isSameLocationName(a: string, b: string) {
  const left = normalizeLocationName(a)
  const right = normalizeLocationName(b)
  return Boolean(left) && left === right
}

// Tên đã bỏ dấu dùng cho tìm kiếm: giữ nguyên tiền tố ("phường", "tỉnh"...)
// để người dùng gõ "phuong ba dinh" hay "ba dinh" đều khớp.
const searchKeyCache = new Map<string, string>()

export function searchLocationKey(value: string) {
  const raw = String(value ?? '')
  const cached = searchKeyCache.get(raw)
  if (cached !== undefined) return cached

  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (searchKeyCache.size < 5000) searchKeyCache.set(raw, key)
  return key
}

// Từ khoá viết tắt / tên cũ cho các thành phố lớn.
const locationAliases: Record<string, string[]> = {
  'thanh pho ho chi minh': ['hcm', 'tphcm', 'sai gon', 'sg'],
  'thanh pho ha noi': ['hn'],
  'thanh pho hai phong': ['hp'],
  'thanh pho da nang': ['dn'],
  'thanh pho can tho': ['ct']
}

/**
 * So khớp không dấu, không phân biệt thứ tự từ và hiểu viết tắt.
 * "sai gon" khớp "Thành phố Hồ Chí Minh", "gon" khớp "Phường Sài Gòn".
 */
export function matchesLocationQuery(name: string, query: string) {
  const tokens = searchLocationKey(query).split(' ').filter(Boolean)
  if (!tokens.length) return true

  const key = searchLocationKey(name)
  const haystacks = [key, ...(locationAliases[key] ?? [])]
  return haystacks.some((haystack) => tokens.every((token) => haystack.includes(token)))
}
