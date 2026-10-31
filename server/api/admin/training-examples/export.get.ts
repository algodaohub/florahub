import { requireAdmin } from '~~/server/utils/admin'
import { listTrainingExamples, trainingExamplesToJsonl } from '~~/server/utils/ai-training'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const items = await listTrainingExamples()
  setHeader(event, 'content-type', 'application/jsonl; charset=utf-8')
  setHeader(event, 'content-disposition', 'attachment; filename="florahub-training.jsonl"')
  return trainingExamplesToJsonl(items)
})
