import { requireAdminMutation } from '~~/server/utils/admin'
import { publicAiSettings, saveAiSettings, type AiProvider } from '~~/server/utils/ai'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const body = await readBody<Record<string, unknown>>(event)
  const saved = await saveAiSettings({
    provider: body?.provider as AiProvider | undefined,
    baseUrl: body?.baseUrl as string | undefined,
    model: body?.model as string | undefined,
    models: body?.models,
    apiKey: body?.apiKey as string | undefined
  })

  return publicAiSettings(saved)
})
