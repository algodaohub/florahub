import { getRecord, requirePbUser, updateRecord } from '~~/server/utils/pocketbase'
import type { NotificationRecord } from '~~/server/utils/account'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã thông báo' })

  const { token, record } = await requirePbUser(event)
  const existing = await getRecord<NotificationRecord>('notifications', id, token).catch(() => null)
  if (!existing || existing.user !== record.id) {
    throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy thông báo' })
  }

  await updateRecord('notifications', id, token, { read: true })
  return { ok: true }
})
