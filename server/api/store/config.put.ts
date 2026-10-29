import type { StoreConfig } from '~/types/store'
import { saveStoreById, saveStoreConfig, toStoreMeta } from '~~/server/utils/store'
import { readPaymentSettings, withPaymentReadiness } from '~~/server/utils/payment-settings'
import { requireStudioOrAdmin } from '~~/server/utils/studio'

export default defineEventHandler(async (event) => {
  await requireStudioOrAdmin(event)
  const storeId = String(getQuery(event).store ?? '').trim()
  const body = await readBody<{
    config?: Partial<StoreConfig>
    name?: string
    domain?: string
    preset?: string
    active?: boolean
    isDefault?: boolean
  }>(event)

  const config = body?.config
  if (!config || typeof config !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Thiếu cấu hình cửa hàng' })
  }

  const meta = {
    name: body?.name?.trim() || undefined,
    domain: body?.domain !== undefined ? String(body.domain).trim() : undefined,
    preset: body?.preset?.trim() || undefined,
    active: body?.active,
    isDefault: body?.isDefault
  }

  const settings = await readPaymentSettings()
  if (storeId) {
    const saved = await saveStoreById(storeId, config, meta)
    return {
      config: withPaymentReadiness(saved.config, settings),
      store: toStoreMeta(saved),
      resolvedBy: 'default' as const
    }
  }

  const result = await saveStoreConfig(event, config, meta)
  return { ...result, config: withPaymentReadiness(result.config, settings) }
})
