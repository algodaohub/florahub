import {
  authWithPassword,
  createUser,
  setAuthCookie,
  toAuthUser
} from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email?: string
    password?: string
    confirmPassword?: string
    firstName?: string
    lastName?: string
    phone?: string
  }>(event)

  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')
  const confirmPassword = String(body?.confirmPassword ?? '')
  const firstName = String(body?.firstName ?? '').trim()
  const lastName = String(body?.lastName ?? '').trim()
  const phone = String(body?.phone ?? '').trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Email không hợp lệ' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Mật khẩu cần ít nhất 8 ký tự' })
  }
  if (password !== confirmPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Mật khẩu nhập lại không khớp' })
  }
  if (!firstName || !lastName) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng nhập họ và tên' })
  }
  if (!/^0\d{9,10}$/.test(phone)) {
    throw createError({ statusCode: 400, statusMessage: 'Số điện thoại không hợp lệ' })
  }

  try {
    await createUser({ email, password, firstName, lastName, phone })
  } catch (error: any) {
    const message = String(error?.statusMessage ?? '')
    if (/already|unique|exists/i.test(message)) {
      throw createError({ statusCode: 409, statusMessage: 'Email này đã được đăng ký' })
    }
    throw error
  }

  const auth = await authWithPassword(email, password)
  setAuthCookie(event, auth.token)

  return { user: toAuthUser(auth.record) }
})
