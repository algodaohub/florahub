import { requireAdmin } from '~~/server/utils/admin'
import { readAssistantBrief, listTrainingExamples } from '~~/server/utils/ai-training'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [items, brief] = await Promise.all([listTrainingExamples(), readAssistantBrief()])
  return { items, total: items.length, brief }
})
