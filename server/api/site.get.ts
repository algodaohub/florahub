import { getStoreConfig, toSiteSettings } from '~~/server/utils/store'
import { readPaymentSettings, withPaymentReadiness } from '~~/server/utils/payment-settings'

export default defineEventHandler(async (event) => {
  // Cấu hình theme đổi theo từng lần lưu → không để trình duyệt/CDN cache.
  setResponseHeader(event, 'cache-control', 'no-store, max-age=0')

  const { config, store, resolvedBy } = await getStoreConfig(event)
  const publicConfig = withPaymentReadiness(config, await readPaymentSettings())
  return {
    ...toSiteSettings(publicConfig),
    config: publicConfig,
    store,
    resolvedBy
  }
})
