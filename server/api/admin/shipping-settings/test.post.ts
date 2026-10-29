import { requireAdminMutation } from '~~/server/utils/admin'
import { testConnection } from '~~/server/utils/goship'
import { readStoreShippingPolicy } from '~~/server/utils/shipping-policy'
import {
  publicShippingSettings,
  readShippingSettings,
  saveShippingConnectionState
} from '~~/server/utils/shipping-settings'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const result = await testConnection()
  const verifiedAt = new Date().toISOString()
  await saveShippingConnectionState({ verifiedAt })
  const settings = await readShippingSettings()

  return {
    ...result,
    verifiedAt,
    settings: publicShippingSettings(settings, await readStoreShippingPolicy(event))
  }
})
