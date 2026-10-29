import { getRecord, requirePbUser, updateRecord } from '~~/server/utils/pocketbase'
import { clearDefaultAddress, toAddress, type AddressRecord } from '~~/server/utils/account'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã địa chỉ' })

  const { token, record } = await requirePbUser(event)
  const existing = await getRecord<AddressRecord>('addresses', id, token).catch(() => null)
  if (!existing || existing.user !== record.id) {
    throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy địa chỉ' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const recipient = String(body?.recipient ?? existing.recipient).trim()
  const phone = String(body?.phone ?? existing.phone).trim()
  const line1 = String(body?.line1 ?? existing.line1).trim()
  const city = String(body?.city ?? existing.city).trim()

  if (!recipient || !phone || !line1 || !city) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng nhập người nhận, số điện thoại, địa chỉ và tỉnh/thành' })
  }

  const isDefault = body?.isDefault === undefined ? existing.is_default : Boolean(body.isDefault)
  if (isDefault) await clearDefaultAddress(token, record.id, id)

  const updated = await updateRecord<AddressRecord>('addresses', id, token, {
    label: String(body?.label ?? existing.label).trim() || 'Địa chỉ',
    recipient,
    phone,
    line1,
    ward: String(body?.ward ?? existing.ward ?? '').trim(),
    district: String(body?.district ?? existing.district ?? '').trim(),
    city,
    city_code: String(body?.cityCode ?? existing.city_code ?? '').trim(),
    district_code: String(body?.districtCode ?? existing.district_code ?? '').trim(),
    ward_code: String(body?.wardCode ?? existing.ward_code ?? '').trim(),
    is_default: isDefault
  })

  return { address: toAddress(updated) }
})
