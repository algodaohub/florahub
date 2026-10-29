import {
  requirePbUser,
  toAuthUser,
  updateUserRecord
} from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const { token, record } = await requirePbUser(event)
  const body = await readBody<{
    firstName?: string
    lastName?: string
    phone?: string
  }>(event)

  const firstName = String(body?.firstName ?? '').trim()
  const lastName = String(body?.lastName ?? '').trim()
  const phone = String(body?.phone ?? '').trim()

  if (!firstName || !lastName) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng nhập họ và tên' })
  }
  if (phone && !/^0\d{9,10}$/.test(phone)) {
    throw createError({ statusCode: 400, statusMessage: 'Số điện thoại không hợp lệ' })
  }

  const updated = await updateUserRecord(record.id, token, {
    first_name: firstName,
    last_name: lastName,
    phone
  })

  return { user: toAuthUser(updated) }
})
