import { authWithPassword, setAuthCookie, toAuthUser } from '~~/server/utils/pocketbase'
import { isAdminRole, requireSameOrigin, resolveAdminRole } from '~~/server/utils/admin'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { count: number; resetAt: number }>()

function clientKey(event: any) {
  return String(getRequestHeader(event, 'x-forwarded-for') ?? getRequestHeader(event, 'host') ?? 'local')
    .split(',')[0]
    .trim()
}

function checkRateLimit(event: any) {
  const key = clientKey(event)
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  entry.count += 1
  if (entry.count > MAX_ATTEMPTS) {
    throw createError({ statusCode: 429, statusMessage: 'Quá nhiều lần đăng nhập. Thử lại sau 15 phút.' })
  }
}

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  checkRateLimit(event)

  const body = await readBody<{ email?: string; password?: string }>(event)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng nhập email và mật khẩu' })
  }

  let auth
  try {
    auth = await authWithPassword(email, password)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Email hoặc mật khẩu không đúng' })
  }

  const role = resolveAdminRole(auth.record)
  if (!isAdminRole(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Tài khoản này không có quyền quản trị' })
  }

  attempts.delete(clientKey(event))
  setAuthCookie(event, auth.token)

  return {
    user: toAuthUser(auth.record),
    role,
    permissions: Array.isArray((auth.record as any).permissions) ? (auth.record as any).permissions : []
  }
})
