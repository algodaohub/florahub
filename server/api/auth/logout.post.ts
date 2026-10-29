import { clearAuthCookie } from '~~/server/utils/pocketbase'

export default defineEventHandler((event) => {
  clearAuthCookie(event)
  return { ok: true }
})
