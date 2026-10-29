import { publicShippingPolicy, readStoreShippingPolicy } from '~~/server/utils/shipping-policy'
import { isGoshipConfigured, readShippingSettings } from '~~/server/utils/shipping-settings'

/** Chính sách vận chuyển công khai — không trả token, pickup hay thông tin nội bộ. */
export default defineEventHandler(async (event) => {
  const settings = await readShippingSettings()
  const policy = await readStoreShippingPolicy(event)

  setHeader(event, 'cache-control', 'private, max-age=30')

  return {
    policy: publicShippingPolicy(policy, settings.codEnabled),
    liveQuotes: isGoshipConfigured(settings) && policy.enabled
  }
})
