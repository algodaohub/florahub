import { requireAdminMutation } from '~~/server/utils/admin'
import { isProductType, toFaq, toHighlights, toText } from '~~/server/utils/admin-data'
import { callAi, readAiSettings } from '~~/server/utils/ai'
import { listTrainingDocs, selectAssistantDocs } from '~~/server/utils/assistant-docs'
import { readAssistantBrief } from '~~/server/utils/ai-training'

type Generated = Record<string, unknown>

type Focus = 'content' | 'seo' | 'aeo' | 'geo'

const FOCUS_KEYS: Record<Focus, string[]> = {
  content: ['subtitle', 'description', 'highlights', 'faq'],
  seo: ['seoTitle', 'seoDescription', 'seoKeywords'],
  aeo: ['aeoSummary', 'faq'],
  geo: ['geoServiceAreas', 'aeoSummary']
}

const FOCUS_PROMPTS: Record<Focus, string> = {
  content: `Tạo nội dung bán hàng, trả về JSON với các key:
{
  "subtitle": "mô tả ngắn 1 dòng, tối đa 120 ký tự",
  "description": "mô tả chi tiết 2-4 đoạn, tối đa 1200 ký tự",
  "highlights": [{"title":"...", "description":"..."}] (3-6 điểm),
  "faq": [{"question":"...", "answer":"..."}] (4-6 câu)
}`,
  seo: `Tạo nội dung tối ưu công cụ tìm kiếm truyền thống (Google), trả về JSON với các key:
{
  "seoTitle": "tiêu đề SEO tối đa 60 ký tự, chứa từ khoá chính trước",
  "seoDescription": "meta description 140-160 ký tự, có từ khoá và lý do mua",
  "seoKeywords": "5-8 từ khoá tiếng Việt cách nhau bằng dấu phẩy"
}`,
  aeo: `Tạo nội dung tối ưu Answer Engine (Google AI Overview, ChatGPT, Gemini trích dẫn trực tiếp), trả về JSON với các key:
{
  "aeoSummary": "2-4 câu trả lời trực tiếp, tự chứa ngữ cảnh: sản phẩm là gì, dành cho ai, khác biệt chính, thời gian giao/nhận; tối đa 500 ký tự",
  "faq": [{"question":"...", "answer":"..."}] (3-5 câu hỏi khách thực sự hay hỏi, trả lời ngắn gọn đúng sự thật)
}`,
  geo: `Tạo nội dung tối ưu Generative/Local Engine cho cửa hàng FloraHub (khách hỏi AI "mua hoa ở đâu", "giao hoa nhanh"), trả về JSON với các key:
{
  "geoServiceAreas": "các quận/huyện/khu vực sản phẩm này phục vụ giao hàng hoặc triển khai, cách nhau dấu phẩy, tối đa 150 ký tự, chỉ nêu khu vực hợp lý với cửa hàng hoa nội thành",
  "aeoSummary": "2-4 câu nêu bật tính sẵn sàng địa phương: khu vực phục vụ, thời gian giao nhanh, điểm nhận diện của shop; tối đa 500 ký tự"
}`
}

function extractJson(raw: string): Generated {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw createError({ statusCode: 502, statusMessage: 'AI không trả về JSON hợp lệ' })
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Generated
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'AI trả về JSON không parse được' })
  }
}

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const body = await readBody<Record<string, unknown>>(event)
  const title = toText(body?.title, 160)
  if (!title) throw createError({ statusCode: 400, statusMessage: 'Nhập tên sản phẩm trước khi gen AI' })

  const settings = await readAiSettings()
  if (!settings.apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Chưa cấu hình AI. Mở /admin/ai để chọn model và lưu API key.'
    })
  }

  const rawFocus = String(body?.focus ?? 'content')
  const focus = (rawFocus in FOCUS_KEYS ? rawFocus : 'content') as Focus

  const type = isProductType(body?.type) ? body.type : 'physical'
  const categoryName = toText(body?.categoryName, 120)
  const sellerName = toText(body?.sellerName, 120)
  const model = toText(body?.model, 160) || undefined

  const [briefRecord, relatedDocs] = await Promise.all([
    readAssistantBrief(),
    listTrainingDocs().then((docs) => selectAssistantDocs(docs, title, 2, 2500))
  ])
  const shopContext = [
    briefRecord ? `CHỈ DẪN CHUNG:\n${briefRecord.content}` : '',
    relatedDocs.length ? `TÀI LIỆU LIÊN QUAN:\n${relatedDocs.map((doc) => `### ${doc.title}\n${doc.content}`).join('\n\n')}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')

  const existing = toText(body?.existingContext, 1500)

  const prompt = `Bạn là chuyên gia nội dung thương mại điện tử cho cửa hàng hoa và quà tặng FloraHub.
Thông tin sản phẩm:
- Tên sản phẩm: ${title}
- Loại: ${type === 'digital' ? 'sản phẩm số' : type === 'service' ? 'dịch vụ' : 'vật lý'}
- Danh mục: ${categoryName || 'hoa và quà tặng'}
- Nhà bán: ${sellerName || 'FloraHub'}
${existing ? `- Nội dung đã có (tham khảo, không lặp lại nguyên văn):\n${existing}` : ''}

BỐI CẢNH TỪ TÀI LIỆU CỦA CỬA HÀNG (giữ đúng giọng văn, chính sách, dịch vụ đi kèm; KHÔNG bịa thêm số liệu từ bối cảnh này):
${shopContext || '(chưa có tài liệu)'}

${FOCUS_PROMPTS[focus]}

Trả về DUY NHẤT một object JSON hợp lệ, không markdown, chỉ chứa các key yêu cầu.
Chỉ dùng thông tin hợp lý, không bịa số liệu cụ thể; nếu không chắc thì nói chung chung.`

  const raw = await callAi(settings, prompt, model)
  const generated = extractJson(raw)

  const result: Record<string, unknown> = {}
  if (FOCUS_KEYS[focus].includes('subtitle')) result.subtitle = toText(generated.subtitle, 200)
  if (FOCUS_KEYS[focus].includes('description')) result.description = toText(generated.description, 5000)
  if (FOCUS_KEYS[focus].includes('highlights')) result.highlights = toHighlights(generated.highlights)
  if (FOCUS_KEYS[focus].includes('faq')) result.faq = toFaq(generated.faq)
  if (FOCUS_KEYS[focus].includes('seoTitle')) result.seoTitle = toText(generated.seoTitle, 120)
  if (FOCUS_KEYS[focus].includes('seoDescription')) result.seoDescription = toText(generated.seoDescription, 320)
  if (FOCUS_KEYS[focus].includes('seoKeywords')) result.seoKeywords = toText(generated.seoKeywords, 300)
  if (FOCUS_KEYS[focus].includes('aeoSummary')) result.aeoSummary = toText(generated.aeoSummary, 1200)
  if (FOCUS_KEYS[focus].includes('geoServiceAreas')) result.geoServiceAreas = toText(generated.geoServiceAreas, 500)

  return { focus, ...result }
})
