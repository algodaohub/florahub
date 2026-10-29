import { listRecords, requirePbUser, updateRecord } from '~~/server/utils/pocketbase'
import type { NotificationRecord } from '~~/server/utils/account'

export default defineEventHandler(async (event) => {
  const { token, record } = await requirePbUser(event)
  const result = await listRecords<NotificationRecord>('notifications', token, `user = "${record.id}" && read = false`)

  for (const item of result.items) {
    await updateRecord('notifications', item.id, token, { read: true })
  }

  return { ok: true, updated: result.items.length }
})
