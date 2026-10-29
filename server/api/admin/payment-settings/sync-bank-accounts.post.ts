import { requireAdminMutation } from '~~/server/utils/admin'
import { paymentReadiness, readPaymentSettings } from '~~/server/utils/payment-settings'
import { listBankAccounts } from '~~/server/utils/sepay-api'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const accounts = await listBankAccounts(true)
  const settings = await readPaymentSettings()

  return {
    accounts,
    syncedAt: settings.bankAccountsSyncedAt,
    readiness: paymentReadiness(settings)
  }
})
