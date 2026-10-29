import type { H3Event } from 'h3'
import { PB_TOKEN_COOKIE, refreshAuth, toAuthUser, type PbUserRecord } from './pocketbase'

export type AdminRole = 'customer' | 'staff' | 'admin'

export type AdminSession = {
  token: string
  id: string
  email: string
  displayName: string
  role: AdminRole
  permissions: string[]
  record: PbUserRecord
}

export const ADMIN_ONLY_ROLES: AdminRole[] = ['staff', 'admin']

const SESSION_TTL = 60_000
const sessionCache = new Map<string, { session: AdminSession; expiresAt: number }>()

/** Email được cấp quyền admin khi collection `users` chưa có field `role`. */
function adminEmailAllowlist() {
  return String(process.env.ADMIN_EMAILS || process.env.NUXT_ADMIN_EMAILS || 'demo@florahub.vn')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Role lấy từ `users.role` khi schema đã có field này.
 * Chưa migrate → fallback allowlist để không tự khoá quyền quản trị hiện tại.
 */
export function resolveAdminRole(record: PbUserRecord): AdminRole {
  const raw = String((record as unknown as { role?: unknown }).role ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'admin' || raw === 'staff' || raw === 'customer') return raw

  const email = String(record.email ?? '').toLowerCase()
  return adminEmailAllowlist().includes(email) ? 'admin' : 'customer'
}

function resolvePermissions(record: PbUserRecord): string[] {
  const raw = (record as unknown as { permissions?: unknown }).permissions
  if (Array.isArray(raw)) return raw.map((value) => String(value)).filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map((value) => String(value)).filter(Boolean)
    } catch {
      return raw.split(',').map((value) => value.trim()).filter(Boolean)
    }
  }
  return []
}

function toSession(token: string, record: PbUserRecord): AdminSession {
  const user = toAuthUser(record)
  return {
    token,
    id: record.id,
    email: record.email,
    displayName: user.displayName,
    role: resolveAdminRole(record),
    permissions: resolvePermissions(record),
    record
  }
}

export function isAdminRole(role: AdminRole | null | undefined): boolean {
  return Boolean(role && ADMIN_ONLY_ROLES.includes(role))
}

/** Trả session nếu request có token hợp lệ (kể cả khách hàng), null nếu chưa đăng nhập. */
export async function getAdminSession(event: H3Event): Promise<AdminSession | null> {
  const token =
    String(getCookie(event, PB_TOKEN_COOKIE) ?? '').trim() ||
    String(getRequestHeader(event, 'authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim()

  if (!token) return null

  const cached = sessionCache.get(token)
  if (cached && cached.expiresAt > Date.now()) return cached.session

  try {
    const auth = await refreshAuth(token)
    const session = toSession(auth.token, auth.record)
    sessionCache.set(auth.token, { session, expiresAt: Date.now() + SESSION_TTL })
    if (auth.token !== token) sessionCache.delete(token)
    return session
  } catch {
    sessionCache.delete(token)
    return null
  }
}

export function forgetAdminSession(token: string) {
  sessionCache.delete(token)
}

export type AdminGuardOptions = {
  /** Chỉ cho phép khi role là admin (bỏ qua staff). */
  adminOnly?: boolean
  resource?: string
  action?: 'read' | 'write'
}

/** Chặn request không phải staff/admin. Dùng cho mọi route /api/admin/*. */
export async function requireAdmin(event: H3Event, options: AdminGuardOptions = {}): Promise<AdminSession> {
  const session = await getAdminSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Bạn cần đăng nhập quản trị' })
  }
  if (!isAdminRole(session.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Tài khoản không có quyền quản trị' })
  }
  if (options.adminOnly && session.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Chỉ quản trị viên mới được thực hiện thao tác này' })
  }
  if (
    session.role === 'staff' &&
    session.permissions.length > 0 &&
    options.resource &&
    !session.permissions.includes(options.resource)
  ) {
    throw createError({ statusCode: 403, statusMessage: 'Bạn không có quyền với mục này' })
  }
  return session
}

/** Chặn CSRF cơ bản: mutation phải đến từ cùng origin. */
export function requireSameOrigin(event: H3Event) {
  if (event.method === 'GET' || event.method === 'HEAD') return
  const origin = String(getRequestHeader(event, 'origin') ?? '').trim()
  if (!origin) return // curl/script không gửi origin — vẫn cần token hợp lệ
  const host = String(getRequestHeader(event, 'host') ?? '').trim()
  try {
    if (new URL(origin).host !== host) {
      throw createError({ statusCode: 403, statusMessage: 'Origin không hợp lệ' })
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 403, statusMessage: 'Origin không hợp lệ' })
  }
}

/** Mutation admin: kiểm tra đăng nhập + origin. */
export async function requireAdminMutation(event: H3Event, options: AdminGuardOptions = {}) {
  requireSameOrigin(event)
  return requireAdmin(event, options)
}
