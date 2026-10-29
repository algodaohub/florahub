import { listRecords, requirePbUser } from '~~/server/utils/pocketbase'
import { toAddress, type AddressRecord } from '~~/server/utils/account'

export default defineEventHandler(async (event) => {
  const { token, record } = await requirePbUser(event)
  const result = await listRecords<AddressRecord>('addresses', token, `user = "${record.id}"`)
  const addresses = result.items.map(toAddress)
  addresses.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  return { addresses }
})
