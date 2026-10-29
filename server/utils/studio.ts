import type { H3Event } from 'h3'
import { requireAdmin } from './admin'

export const STUDIO_KEY_HEADER = 'x-studio-key'

export function studioKey() {
  return process.env.NUXT_STUDIO_KEY || process.env.STUDIO_KEY || 'studio'
}

export function requireStudioKey(event: H3Event) {
  const provided =
    String(getRequestHeader(event, STUDIO_KEY_HEADER) ?? '').trim() ||
    String(getQuery(event).key ?? '').trim()

  if (provided !== studioKey()) {
    throw createError({ statusCode: 401, statusMessage: 'Studio key không hợp lệ' })
  }
}

export function hasStudioKey(event: H3Event) {
  const provided =
    String(getRequestHeader(event, STUDIO_KEY_HEADER) ?? '').trim() ||
    String(getQuery(event).key ?? '').trim()
  return provided === studioKey()
}

/**
 * Route cửa hàng dùng được từ hai nơi:
 * - `/admin/storefront` (phiên đăng nhập admin) — đường chính.
 * - script/CLI cũ với `x-studio-key` — giữ tạm để không phá công cụ hiện có.
 */
export async function requireStudioOrAdmin(event: H3Event) {
  if (hasStudioKey(event)) return { via: 'studio-key' as const, session: null }
  const session = await requireAdmin(event, { resource: 'storefront', action: 'write' })
  return { via: 'admin' as const, session }
}
