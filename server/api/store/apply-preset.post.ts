import { applyPresetToStore } from '~~/server/utils/store'
import { requireStudioOrAdmin } from '~~/server/utils/studio'
import { findPreset } from '~~/utils/store-presets'

export default defineEventHandler(async (event) => {
  await requireStudioOrAdmin(event)
  const body = await readBody<{ preset?: string; store?: string }>(event)
  const presetId = String(body?.preset ?? '').trim()
  const storeId = String(body?.store ?? getQuery(event).store ?? '').trim()

  if (!findPreset(presetId)) throw createError({ statusCode: 400, statusMessage: 'Preset không hợp lệ' })

  return applyPresetToStore(event, presetId, storeId)
})
