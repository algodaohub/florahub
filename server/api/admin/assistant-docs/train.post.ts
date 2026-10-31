import { pbCreate } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { readAiSettings } from '~~/server/utils/ai'
import { listTrainingDocs } from '~~/server/utils/assistant-docs'
import {
  TRAINING_EXAMPLES_COLLECTION,
  TOTAL_QA_CAP,
  generateQaPairs
} from '~~/server/utils/ai-training'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const docs = await listTrainingDocs()
  if (!docs.length) {
    throw createError({ statusCode: 400, statusMessage: 'Chưa có tài liệu nào được đánh dấu Training AI.' })
  }

  const ai = await readAiSettings()
  if (!ai.apiKey) {
    throw createError({ statusCode: 503, statusMessage: 'Chưa có API key AI. Lưu cấu hình tại tab AI trước.' })
  }
  const batch = new Date().toISOString().slice(0, 10)
  let created = 0
  const failedDocs: string[] = []

  for (const doc of docs) {
    if (created >= TOTAL_QA_CAP) break
    const maxPairs = Math.min(8, Math.max(3, Math.round(doc.content.length / 1500)), TOTAL_QA_CAP - created)
    const pairs = await generateQaPairs(ai, doc, maxPairs)
    if (!pairs.length) {
      failedDocs.push(doc.title)
      continue
    }
    for (const pair of pairs) {
      await pbCreate(TRAINING_EXAMPLES_COLLECTION, {
        question: pair.q,
        answer: pair.a,
        source: doc.title.slice(0, 200),
        batch
      })
      created += 1
    }
  }

  if (!created) {
    throw createError({
      statusCode: 502,
      statusMessage: `AI không sinh được cặp Q/A nào (${failedDocs.join(', ') || 'tất cả tài liệu'}). Kiểm tra cấu hình AI rồi thử lại.`
    })
  }

  return { created, batch, failed: failedDocs }
})
