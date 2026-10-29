export function productColorHex(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

  if (normalized.includes('do')) return '#A43A32'
  if (normalized.includes('hong')) return '#E6A5B4'
  if (normalized.includes('trang')) return '#F4EFE4'
  if (normalized.includes('vang')) return '#E4B93F'
  if (normalized.includes('cam')) return '#DD8A4B'
  if (normalized.includes('tim')) return '#8A6FAE'
  if (normalized.includes('xanh')) return '#6C8E6E'
  if (normalized.includes('kem')) return '#E4D2B4'
  return '#CFC7B8'
}
