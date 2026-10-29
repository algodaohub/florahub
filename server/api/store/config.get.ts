import { findStoreById, getStoreConfig, toStoreMeta } from '~~/server/utils/store'
import { readPaymentSettings, withPaymentReadiness } from '~~/server/utils/payment-settings'

export default defineEventHandler(async (event) => {
  const settings = await readPaymentSettings()
  const storeId = String(getQuery(event).store ?? '').trim()
  if (storeId) {
    const store = await findStoreById(storeId)
    if (!store) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy cửa hàng' })
    return {
      config: withPaymentReadiness(store.config, settings),
      store: toStoreMeta(store),
      resolvedBy: 'default' as const
    }
  }

  const result = await getStoreConfig(event)
  return { ...result, config: withPaymentReadiness(result.config, settings) }
})
