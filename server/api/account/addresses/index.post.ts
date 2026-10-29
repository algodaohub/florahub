import { createRecord, requirePbUser } from '~~/server/utils/pocketbase'
import { clearDefaultAddress, toAddress, type AddressRecord } from '~~/server/utils/account'

export default defineEventHandler(async (event) => {
  const { token, record } = await requirePbUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const recipient = String(body?.recipient ?? '').trim()
  const phone = String(body?.phone ?? '').trim()
  const line1 = String(body?.line1 ?? '').trim()
  const city = String(body?.city ?? '').trim()

  if (!recipient || !phone || !line1 || !city) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng nhập người nhận, số điện thoại, địa chỉ và tỉnh/thành' })
  }

  const isDefault = Boolean(body?.isDefault)
  if (isDefault) await clearDefaultAddress(token, record.id)

  const created = await createRecord<AddressRecord>('addresses', token, {
    user: record.id,
    label: String(body?.label ?? '').trim() || 'Địa chỉ',
    recipient,
    phone,
    line1,
    ward: String(body?.ward ?? '').trim(),
    district: String(body?.district ?? '').trim(),
    city,
    city_code: String(body?.cityCode ?? '').trim(),
    district_code: String(body?.districtCode ?? '').trim(),
    ward_code: String(body?.wardCode ?? '').trim(),
    is_default: isDefault
  })

  return { address: toAddress(created) }
})
