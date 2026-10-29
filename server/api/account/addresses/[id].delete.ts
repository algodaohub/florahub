import { deleteRecord, getRecord, requirePbUser } from '~~/server/utils/pocketbase'
import type { AddressRecord } from '~~/server/utils/account'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã địa chỉ' })

  const { token, record } = await requirePbUser(event)
  const existing = await getRecord<AddressRecord>('addresses', id, token).catch(() => null)
  if (!existing || existing.user !== record.id) {
    throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy địa chỉ' })
  }

  await deleteRecord('addresses', id, token)
  return { ok: true }
})
