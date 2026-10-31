import { requireAdminMutation } from '~~/server/utils/admin'
import { clearTrainingExamples } from '~~/server/utils/ai-training'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const cleared = await clearTrainingExamples()
  return { cleared }
})
