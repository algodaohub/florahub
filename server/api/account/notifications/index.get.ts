import { listRecords, requirePbUser } from '~~/server/utils/pocketbase'
import { toNotification, type NotificationRecord } from '~~/server/utils/account'

export default defineEventHandler(async (event) => {
  const { token, record } = await requirePbUser(event)
  const result = await listRecords<NotificationRecord>('notifications', token, `user = "${record.id}"`)
  const notifications = result.items.map(toNotification)
  return {
    notifications,
    unread: notifications.filter((item) => !item.read).length
  }
})
