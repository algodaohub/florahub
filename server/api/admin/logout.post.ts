import { clearAuthCookie } from '~~/server/utils/pocketbase'
import { forgetAdminSession, requireSameOrigin } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const token = String(getCookie(event, 'pb_token') ?? '')
  if (token) forgetAdminSession(token)
  clearAuthCookie(event)
  return { ok: true }
})
