import { pbCreate, pbDeleteWhere, pbFirst, pbListAll, pbUpdate, type PbRecord } from './pocketbase'
import { callAi, type AiSettings } from './ai'
import type { AssistantDoc } from './assistant-docs'

export const TRAINING_EXAMPLES_COLLECTION = 'training_examples'
export const ASSISTANT_BRIEF_COLLECTION = 'assistant_brief'

export type TrainingExample = {
  id: string
  question: string
  answer: string
  source: string
  batch: string
  created: string
}

export type AssistantBrief = {
  content: string
  model: string
  updatedAt: string
}

const BRIEF_MAX_CHARS = 4000
const DOCS_INPUT_MAX_CHARS = 12000
const TOTAL_QA_CAP = 60

export const TRAINING_SYSTEM_PROMPT =
  'Bạn là trợ lý tư vấn hoa và quà tặng của FloraHub, nói tiếng Việt, thân thiện, ngắn gọn. ' +
  'Chỉ dùng thông tin được cung cấp; không bịa giá, phí giao, khuyến mãi hay thời gian giao.'

function toExample(record: PbRecord): TrainingExample {
  return {
    id: record.id,
    question: String(record.question ?? ''),
    answer: String(record.answer ?? ''),
    source: String(record.source ?? ''),
    batch: String(record.batch ?? ''),
    created: String(record.created ?? '')
  }
}

export async function listTrainingExamples(): Promise<TrainingExample[]> {
  const rows = await pbListAll<PbRecord>(TRAINING_EXAMPLES_COLLECTION, { sort: '-created' })
  return rows.map(toExample)
}

export async function clearTrainingExamples(): Promise<number> {
  return pbDeleteWhere(TRAINING_EXAMPLES_COLLECTION, 'question != ""')
}

export async function readAssistantBrief(): Promise<AssistantBrief | null> {
  try {
    const record = await pbFirst<PbRecord>(ASSISTANT_BRIEF_COLLECTION, { sort: '-updated' })
    if (!record) return null
    const content = String(record.content ?? '').trim()
    if (!content) return null
    return {
      content,
      model: String(record.model ?? ''),
      updatedAt: String(record.updated_at ?? record.updated ?? '')
    }
  } catch {
    return null
  }
}

export async function saveAssistantBrief(content: string, model: string): Promise<AssistantBrief> {
  const body = {
    content: content.slice(0, BRIEF_MAX_CHARS),
    model,
    updated_at: new Date().toISOString()
  }
  const current = await pbFirst<PbRecord>(ASSISTANT_BRIEF_COLLECTION, { sort: '-updated' })
  const saved = current
    ? await pbUpdate<PbRecord>(ASSISTANT_BRIEF_COLLECTION, current.id, body)
    : await pbCreate<PbRecord>(ASSISTANT_BRIEF_COLLECTION, body)
  return {
    content: String(saved.content ?? body.content),
    model: String(saved.model ?? model),
    updatedAt: String(saved.updated_at ?? body.updated_at)
  }
}

/** Bỏ code fence rồi lấy khối JSON đầu tiên dạng mảng. */
export function extractJsonArray(text: string): unknown[] | null {
  const cleaned = String(text ?? '')
    .replace(/```(?:json)?/gi, '')
    .trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function docsBlock(docs: AssistantDoc[], cap = DOCS_INPUT_MAX_CHARS) {
  let used = 0
  const parts: string[] = []
  for (const doc of docs) {
    const room = cap - used
    if (room < 200) break
    const content = doc.content.slice(0, room)
    parts.push(`### ${doc.title}\n${content}`)
    used += content.length
  }
  return parts.join('\n\n')
}

/** Chưng cất toàn bộ tài liệu training thành chỉ dẫn ngắn cho prompt trợ lý. */
export async function generateBrief(ai: AiSettings, docs: AssistantDoc[]): Promise<string> {
  const prompt = `Nhiệm vụ: chưng cất tài liệu của shop FloraHub thành chỉ dẫn ngắn cho trợ lý bán hàng.

Quy tắc:
- Tối đa 300 từ, dạng gạch đầu dòng.
- Chỉ giữ quy định, số liệu, quy trình có trong tài liệu; không thêm ý mới, không bình luận.
- Giữ nguyên số tiền, thời hạn, điều kiện.
- Trả lời bằng tiếng Việt, không markdown code fence.

TÀI LIỆU:
${docsBlock(docs)}

CHỈ DẪN:`

  const raw = await callAi(ai, prompt)
  const brief = raw.replace(/```/g, '').trim()
  if (!brief) {
    throw createError({ statusCode: 502, statusMessage: 'AI không trả về chỉ dẫn nào. Thử lại hoặc kiểm tra cấu hình AI.' })
  }
  return brief.slice(0, BRIEF_MAX_CHARS)
}

/** Sinh cặp Q/A từ MỘT tài liệu; lỗi AI hoặc JSON hỏng → trả rỗng, không chặn tài liệu khác. */
export async function generateQaPairs(ai: AiSettings, doc: AssistantDoc, maxPairs: number): Promise<Array<{ q: string; a: string }>> {
  const prompt = `Bạn tạo dữ liệu huấn luyện cho trợ lý mua hàng FloraHub.
Chỉ dựa vào tài liệu dưới đây, viết tối đa ${maxPairs} cặp question/answer tiếng Việt.
- question: câu hỏi khách thật sự có thể hỏi về nội dung tài liệu.
- answer: trả lời đúng theo tài liệu, 1-3 câu, giữ nguyên số liệu trong tài liệu, không bịa thêm.
Chỉ trả về JSON dạng [{"q":"...","a":"..."}], không giải thích ngoài JSON.

TÀI LIỆU "${doc.title}":
${doc.content.slice(0, DOCS_INPUT_MAX_CHARS)}
`

  let raw: string
  try {
    raw = await callAi(ai, prompt)
  } catch {
    return []
  }
  const array = extractJsonArray(raw)
  if (!array) return []
  return array
    .map((item: any) => ({
      q: String(item?.q ?? item?.question ?? '').trim().slice(0, 2000),
      a: String(item?.a ?? item?.answer ?? '').trim().slice(0, 4000)
    }))
    .filter((pair) => pair.q && pair.a)
    .slice(0, maxPairs)
}

export function trainingExamplesToJsonl(items: TrainingExample[]): string {
  return items
    .map((item) =>
      JSON.stringify({
        messages: [
          { role: 'system', content: TRAINING_SYSTEM_PROMPT },
          { role: 'user', content: item.question },
          { role: 'assistant', content: item.answer }
        ]
      })
    )
    .join('\n')
}

export { DOCS_INPUT_MAX_CHARS, TOTAL_QA_CAP }
