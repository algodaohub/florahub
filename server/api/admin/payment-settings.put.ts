import { requireAdminMutation } from '~~/server/utils/admin'
import {
  publicPaymentSettings,
  savePaymentSettings,
  type PaymentSettingsInput
} from '~~/server/utils/payment-settings'

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const body = await readBody<Record<string, unknown>>(event)
  const rawPg = body?.pg && typeof body.pg === 'object' ? (body.pg as Record<string, unknown>) : {}

  const input: PaymentSettingsInput = {
    apiToken: optionalString(body?.apiToken),
    apiBaseUrl: optionalString(body?.apiBaseUrl),
    webhookApiKey: optionalString(body?.webhookApiKey),
    webhookSecret: optionalString(body?.webhookSecret),
    pg: {
      merchantId: optionalString(rawPg.merchantId),
      secretKey: optionalString(rawPg.secretKey),
      ipnSecret: optionalString(rawPg.ipnSecret),
      env: optionalString(rawPg.env),
      publicUrl: optionalString(rawPg.publicUrl)
    }
  }

  const saved = await savePaymentSettings(input)
  return publicPaymentSettings(saved)
})
