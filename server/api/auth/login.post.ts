import { authWithPassword, setAuthCookie, toAuthUser } from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; password?: string }>(event)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng nhập email và mật khẩu' })
  }

  try {
    const auth = await authWithPassword(email, password)
    setAuthCookie(event, auth.token)
    return { user: toAuthUser(auth.record) }
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Email hoặc mật khẩu không đúng' })
  }
})
