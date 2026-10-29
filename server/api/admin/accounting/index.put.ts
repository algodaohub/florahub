import { requireAdminMutation } from '~~/server/utils/admin'
import { saveAccountingSettings } from '~~/server/utils/accounting'

/** Thông tin người bán dùng cho sổ/hoá đơn; chỉ quản trị viên được sửa. */
export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true, resource: 'orders', action: 'write' })

  const body = await readBody<{
    sellerName?: string
    sellerTaxCode?: string
    sellerAddress?: string
    invoiceSymbol?: string
    invoiceTemplate?: string
  }>(event)

  const settings = await saveAccountingSettings(body ?? {})
  return { settings }
})
