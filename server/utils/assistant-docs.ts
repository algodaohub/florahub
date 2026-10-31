import { pbListAll, type PbRecord } from './pocketbase'

export type AssistantDoc = {
  id: string
  title: string
  content: string
  tags: string
  sortOrder: number
}

export type AdminAssistantDoc = AssistantDoc & {
  isActive: boolean
  forTraining: boolean
  updatedAt: string
}

export function toAdminDoc(record: PbRecord): AdminAssistantDoc {
  return {
    id: record.id,
    title: String(record.title ?? ''),
    content: String(record.content ?? ''),
    tags: String(record.tags ?? ''),
    isActive: record.is_active !== false,
    forTraining: record.for_training === true,
    sortOrder: Number(record.sort_order ?? 0),
    updatedAt: String(record.updated_at ?? record.updated ?? '')
  }
}

type DocRecord = PbRecord & {
  title?: string
  content?: string
  tags?: string
  is_active?: boolean
  sort_order?: number
}

export function normalizeDocText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function rowToDoc(row: DocRecord): AssistantDoc {
  return {
    id: row.id,
    title: String(row.title ?? ''),
    content: String(row.content ?? ''),
    tags: String(row.tags ?? ''),
    sortOrder: Number(row.sort_order ?? 0)
  }
}

/** Tài liệu tư vấn đang bật. Collection chưa migrate → trả rỗng, trợ lý vẫn chạy. */
export async function listAssistantDocs(): Promise<AssistantDoc[]> {
  try {
    const rows = await pbListAll<DocRecord>('assistant_docs', {
      filter: 'is_active = true',
      sort: 'sort_order,title'
    })
    return rows.map(rowToDoc)
  } catch {
    return []
  }
}

/** Tài liệu được đánh dấu huấn luyện AI (bất kể đang bật hay tắt). */
export async function listTrainingDocs(): Promise<AssistantDoc[]> {
  try {
    const rows = await pbListAll<DocRecord>('assistant_docs', {
      filter: 'for_training = true',
      sort: 'sort_order,title'
    })
    return rows.map(rowToDoc)
  } catch {
    return []
  }
}

/**
 * Chọn tài liệu liên quan theo từ khoá (không dùng embedding) và cắt theo ngân sách ký tự.
 * Không khớp gì → lấy tài liệu đầu tiên để vẫn có chính sách chung.
 */
export function selectAssistantDocs(docs: AssistantDoc[], query: string, limit = 3, maxChars = 4500) {
  const needle = normalizeDocText(query)
  const tokens = [...new Set(needle.split(/[^a-z0-9]+/).filter((token) => token.length > 1))]

  const scored = docs.map((doc) => {
    const title = normalizeDocText(doc.title)
    const tags = normalizeDocText(doc.tags)
    const content = normalizeDocText(doc.content)
    let score = title.includes(needle) ? 6 : 0
    for (const token of tokens) {
      if (title.includes(token)) score += 4
      if (tags.includes(token)) score += 3
      if (content.includes(token)) score += 1
    }
    return { doc, score }
  })

  const relevant = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score)
  const picked = (relevant.length ? relevant : scored).slice(0, limit).map((item) => item.doc)

  const result: Array<{ title: string; content: string }> = []
  let used = 0
  for (const doc of picked) {
    const room = maxChars - used
    if (room < 200) break
    const content = doc.content.slice(0, Math.min(1500, room))
    result.push({ title: doc.title, content })
    used += content.length
  }
  return result
}
