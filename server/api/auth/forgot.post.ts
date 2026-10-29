import { requestPasswordReset } from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string }>(event)
  const email = String(body?.email ?? '').trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Email không hợp lệ' })
  }

  try {
    await requestPasswordReset(email)
  } catch {
    // Không tiết lộ email có tồn tại hay không.
  }

  return {
    message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.'
  }
})
