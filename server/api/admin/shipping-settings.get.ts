import { requireAdmin } from '~~/server/utils/admin'
import { readStoreShippingPolicy } from '~~/server/utils/shipping-policy'
import { publicShippingSettings, readShippingSettings } from '~~/server/utils/shipping-settings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const settings = await readShippingSettings()
  const policy = await readStoreShippingPolicy(event)
  return publicShippingSettings(settings, policy)
})
