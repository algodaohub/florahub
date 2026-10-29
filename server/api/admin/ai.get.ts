import { requireAdmin } from '~~/server/utils/admin'
import { listAiModels, publicAiSettings, readAiSettings } from '~~/server/utils/ai'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const settings = await readAiSettings()
  const wantsModels = String(getQuery(event).models ?? '') === '1'
  const availableModels = wantsModels ? await listAiModels(settings) : settings.models

  return publicAiSettings(settings, availableModels)
})
