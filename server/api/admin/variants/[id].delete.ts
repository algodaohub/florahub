import { pbDelete, pbGetRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã biến thể' })

  const variant = await pbGetRecord('variants', id)
  if (!variant) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy biến thể' })

  await pbDelete('variants', id)
  return { ok: true }
})
