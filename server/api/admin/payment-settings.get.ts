import { requireAdmin } from '~~/server/utils/admin'
import { publicPaymentSettings, readPaymentSettings } from '~~/server/utils/payment-settings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return publicPaymentSettings(await readPaymentSettings())
})
