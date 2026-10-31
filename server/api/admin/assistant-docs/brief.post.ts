import { requireAdminMutation } from '~~/server/utils/admin'
import { readAiSettings } from '~~/server/utils/ai'
import { listTrainingDocs } from '~~/server/utils/assistant-docs'
import { generateBrief, saveAssistantBrief } from '~~/server/utils/ai-training'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const docs = await listTrainingDocs()
  if (!docs.length) {
    throw createError({ statusCode: 400, statusMessage: 'Chưa có tài liệu nào được đánh dấu Training AI.' })
  }

  const ai = await readAiSettings()
  const content = await generateBrief(ai, docs)
  const brief = await saveAssistantBrief(content, ai.model)

  return { brief }
})
