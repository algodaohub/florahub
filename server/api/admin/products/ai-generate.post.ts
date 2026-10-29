import { requireAdminMutation } from '~~/server/utils/admin'
import { isProductType, toFaq, toHighlights, toText } from '~~/server/utils/admin-data'
import { callAi, readAiSettings } from '~~/server/utils/ai'

type Generated = {
  subtitle?: string
  description?: string
  highlights?: unknown
  faq?: unknown
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string
  aeoSummary?: string
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

  const type = isProductType(body?.type) ? body.type : 'physical'
  const categoryName = toText(body?.categoryName, 120)
  const sellerName = toText(body?.sellerName, 120)
  const model = toText(body?.model, 160) || undefined

  const prompt = `Bạn là chuyên gia SEO/AEO cho cửa hàng hoa và quà tặng FloraHub.
Hãy tạo nội dung sản phẩm bằng tiếng Việt cho:
- Tên sản phẩm: ${title}
- Loại: ${type === 'digital' ? 'sản phẩm số' : type === 'service' ? 'dịch vụ' : 'vật lý'}
- Danh mục: ${categoryName || 'hoa và quà tặng'}
- Nhà bán: ${sellerName || 'FloraHub'}

Trả về DUY NHẤT một object JSON hợp lệ, không markdown, với các key:
{
  "subtitle": "mô tả ngắn 1 dòng, tối đa 120 ký tự",
  "description": "mô tả chi tiết 2-4 đoạn, tối đa 1200 ký tự",
  "highlights": [{"title":"...", "description":"..."}] (3-6 điểm),
  "faq": [{"question":"...", "answer":"..."}] (4-6 câu),
  "seoTitle": "tiêu đề SEO tối đa 60 ký tự",
  "seoDescription": "meta description 140-160 ký tự",
  "seoKeywords": "5-8 từ khoá cách nhau bằng dấu phẩy",
  "aeoSummary": "2-4 câu trả lời trực tiếp cho AI, tối đa 500 ký tự"
}
Chỉ dùng thông tin hợp lý, không bịa số liệu cụ thể; nếu không chắc thì nói chung chung.`

  const raw = await callAi(settings, prompt, model)
  const generated = extractJson(raw)

  return {
    subtitle: toText(generated.subtitle, 200),
    description: toText(generated.description, 5000),
    highlights: toHighlights(generated.highlights),
    faq: toFaq(generated.faq),
    seoTitle: toText(generated.seoTitle, 120),
    seoDescription: toText(generated.seoDescription, 320),
    seoKeywords: toText(generated.seoKeywords, 300),
    aeoSummary: toText(generated.aeoSummary, 1200)
  }
})
