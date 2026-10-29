import { createStore } from '~~/server/utils/store'
import { requireStudioOrAdmin } from '~~/server/utils/studio'
import { findPreset } from '~~/utils/store-presets'

export default defineEventHandler(async (event) => {
  await requireStudioOrAdmin(event)
  const body = await readBody<{ name?: string; domain?: string; preset?: string }>(event)

  const name = String(body?.name ?? '').trim()
  const domain = String(body?.domain ?? '').trim()
  const presetId = String(body?.preset ?? 'vuon-nha').trim()

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Nhập tên cửa hàng' })
  if (!findPreset(presetId)) throw createError({ statusCode: 400, statusMessage: 'Preset không hợp lệ' })

  const store = await createStore({ name, domain, preset: presetId })
  return { store }
})
