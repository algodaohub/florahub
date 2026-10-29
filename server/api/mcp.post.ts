import { getAgentProduct, searchAgentCatalog } from '~~/server/utils/agent'
import {
  addAgentCartItem,
  createAgentCart,
  createAgentOrder,
  getAgentCart,
  getAgentOrder,
  previewAgentOrder,
  removeAgentCartItem,
  updateAgentCartItem
} from '~~/server/utils/agent-commerce'

const SUPPORTED_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18', '2026-07-28']
const LATEST_VERSION = '2026-07-28'

const ORDER_WINDOW_MS = 10 * 60 * 1000
const ORDER_MAX = 5
const orderAttempts = new Map<string, { count: number; resetAt: number }>()

function checkOrderRate(event: any) {
  const key = String(getRequestHeader(event, 'x-forwarded-for') ?? getRequestHeader(event, 'host') ?? 'local')
    .split(',')[0]
    .trim()
  const now = Date.now()
  const entry = orderAttempts.get(key)
  if (!entry || entry.resetAt < now) {
    orderAttempts.set(key, { count: 1, resetAt: now + ORDER_WINDOW_MS })
    return
  }
  entry.count += 1
  if (entry.count > ORDER_MAX) {
    throw createError({ statusCode: 429, statusMessage: 'Quá nhiều đơn trong thời gian ngắn. Thử lại sau 10 phút.' })
  }
}

const TOOLS = [
  {
    name: 'search_catalog',
    title: 'Tìm sản phẩm FloraHub',
    description:
      'Tìm hoa và quà tặng đang bán tại FloraHub (Việt Nam, giá VND). Trả tên, giá, tồn kho, người bán, URL và variantId mặc định để thêm vào giỏ.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Từ khoá tiếng Việt, ví dụ "hoa hồng pastel"' },
        limit: { type: 'integer', minimum: 1, maximum: 24, description: 'Số kết quả, mặc định 10' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_product',
    title: 'Chi tiết sản phẩm',
    description: 'Lấy mô tả, giá, danh sách variant, FAQ và tồn kho của một sản phẩm FloraHub theo handle.',
    inputSchema: {
      type: 'object',
      properties: {
        handle: { type: 'string', description: 'Handle trong URL, ví dụ "hoa-hong-phan-pastel"' }
      },
      required: ['handle']
    }
  },
  {
    name: 'create_cart',
    title: 'Tạo giỏ hàng',
    description:
      'Tạo giỏ hàng mới. Trả cart_id — giữ bí mật, dùng cho các tool giỏ hàng và đặt đơn. Mỗi khách nên dùng một cart_id.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_cart',
    title: 'Xem giỏ hàng',
    description: 'Xem sản phẩm, số lượng và tạm tính trong giỏ.',
    inputSchema: {
      type: 'object',
      properties: { cart_id: { type: 'string' } },
      required: ['cart_id']
    }
  },
  {
    name: 'add_to_cart',
    title: 'Thêm vào giỏ',
    description: 'Thêm variant vào giỏ. Dùng variantId từ search_catalog hoặc get_product.',
    inputSchema: {
      type: 'object',
      properties: {
        cart_id: { type: 'string' },
        variant_id: { type: 'string' },
        quantity: { type: 'integer', minimum: 1, maximum: 99, description: 'Mặc định 1' }
      },
      required: ['cart_id', 'variant_id']
    }
  },
  {
    name: 'update_cart_item',
    title: 'Đổi số lượng',
    description: 'Đặt số lượng mới cho một dòng trong giỏ.',
    inputSchema: {
      type: 'object',
      properties: {
        cart_id: { type: 'string' },
        item_id: { type: 'string' },
        quantity: { type: 'integer', minimum: 1, maximum: 99 }
      },
      required: ['cart_id', 'item_id', 'quantity']
    }
  },
  {
    name: 'remove_cart_item',
    title: 'Xoá khỏi giỏ',
    description: 'Xoá một dòng khỏi giỏ.',
    inputSchema: {
      type: 'object',
      properties: {
        cart_id: { type: 'string' },
        item_id: { type: 'string' }
      },
      required: ['cart_id', 'item_id']
    }
  },
  {
    name: 'preview_order',
    title: 'Tính tiền đơn',
    description:
      'Tính tạm tính, giảm giá, phí giao và tổng tiền cuối. Gọi trước khi hỏi khách xác nhận. Trả payment.method = "qr" (VietQR miễn phí, tự xác nhận khi tiền về), "sepay" (cổng thanh toán có phí) hoặc "cod".',
    inputSchema: {
      type: 'object',
      properties: {
        cart_id: { type: 'string' },
        promo_code: { type: 'string' }
      },
      required: ['cart_id']
    }
  },
  {
    name: 'create_order',
    title: 'Đặt hàng',
    description:
      'Tạo đơn thật. Chỉ gọi sau khi khách đã xem preview_order và đồng ý người bán, sản phẩm, số lượng, tổng tiền và cách thanh toán. Bắt buộc confirm=true và expected_total đúng bằng tổng trong preview_order.',
    inputSchema: {
      type: 'object',
      properties: {
        cart_id: { type: 'string' },
        name: { type: 'string', description: 'Tên người nhận' },
        phone: { type: 'string' },
        email: { type: 'string' },
        address: { type: 'string', description: 'Địa chỉ giao đầy đủ' },
        note: { type: 'string' },
        promo_code: { type: 'string' },
        expected_total: { type: 'integer', description: 'Tổng tiền khách đã đồng ý, lấy từ preview_order' },
        confirm: { type: 'boolean', description: 'Phải là true' }
      },
      required: ['cart_id', 'name', 'phone', 'email', 'address', 'expected_total', 'confirm']
    }
  },
  {
    name: 'get_order',
    title: 'Tra đơn',
    description: 'Xem trạng thái đơn và hướng dẫn thanh toán. Cần đúng email đã đặt để tránh lộ đơn người khác.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['order_id', 'email']
    }
  }
]

type RpcBody = {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

function setCors(event: any) {
  setHeader(event, 'access-control-allow-origin', '*')
  setHeader(event, 'access-control-allow-methods', 'POST, OPTIONS')
  setHeader(event, 'access-control-allow-headers', 'content-type, mcp-protocol-version, mcp-session-id')
  setHeader(event, 'access-control-expose-headers', 'mcp-protocol-version')
}

function rpcOk(id: RpcBody['id'], result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

function textResult(id: RpcBody['id'], data: unknown, isError = false) {
  const text = typeof data === 'string' ? data : JSON.stringify(data)
  return rpcOk(id, {
    content: [{ type: 'text', text }],
    ...(typeof data === 'string' ? {} : { structuredContent: data }),
    isError
  })
}

function rpcError(id: RpcBody['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

export default defineEventHandler(async (event) => {
  setCors(event)
  setHeader(event, 'mcp-protocol-version', LATEST_VERSION)

  const body = await readBody<RpcBody>(event).catch(() => null)
  if (!body || typeof body.method !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Body JSON-RPC không hợp lệ' })
  }

  if (body.id === undefined) {
    setResponseStatus(event, 202)
    return null
  }

  const baseUrl = getRequestURL(event).origin

  if (body.method === 'initialize') {
    const requested = String(body.params?.protocolVersion ?? '')
    return rpcOk(body.id, {
      protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : LATEST_VERSION,
      capabilities: { tools: { listChanged: false } },
      instructions:
        'Catalog và giỏ hàng FloraHub. Chỉ tạo đơn bằng create_order sau khi khách xem preview_order và xác nhận tổng tiền. Không tự bịa địa chỉ hay thông tin thanh toán.',
      serverInfo: {
        name: 'florahub',
        title: 'FloraHub',
        version: '1.1.0',
        description: 'Tìm sản phẩm, giỏ hàng, đặt đơn và tra đơn FloraHub.'
      }
    })
  }

  if (body.method === 'ping') return rpcOk(body.id, {})

  if (body.method === 'tools/list') return rpcOk(body.id, { tools: TOOLS })

  if (body.method === 'resources/list') return rpcOk(body.id, { resources: [] })
  if (body.method === 'prompts/list') return rpcOk(body.id, { prompts: [] })

  if (body.method !== 'tools/call') {
    return rpcError(body.id, -32601, `Không hỗ trợ method "${body.method}"`)
  }

  const name = String(body.params?.name ?? '')
  const args = (body.params?.arguments ?? {}) as Record<string, unknown>

  try {
    if (name === 'search_catalog') {
      const query = String(args.query ?? '').trim().slice(0, 200)
      if (!query) return textResult(body.id, 'Thiếu tham số query.', true)
      const limit = Number(args.limit ?? 10) || 10
      const products = await searchAgentCatalog(query, baseUrl, limit)
      return textResult(body.id, { query, products, total: products.length })
    }

    if (name === 'get_product') {
      const handle = String(args.handle ?? '').trim().slice(0, 200)
      const product = handle ? await getAgentProduct(handle, baseUrl) : null
      if (!product) return textResult(body.id, `Không tìm thấy sản phẩm "${handle}".`, true)
      return textResult(body.id, product)
    }

    if (name === 'create_cart') {
      const cart = await createAgentCart()
      return textResult(body.id, { cart_id: cart.id, items: [], subtotal: 0, total: 0 })
    }

    if (name === 'get_cart') {
      return textResult(body.id, await getAgentCart(event, String(args.cart_id ?? '')))
    }

    if (name === 'add_to_cart') {
      const cart = await addAgentCartItem(
        event,
        String(args.cart_id ?? ''),
        String(args.variant_id ?? ''),
        Number(args.quantity ?? 1)
      )
      return textResult(body.id, cart)
    }

    if (name === 'update_cart_item') {
      const cart = await updateAgentCartItem(
        event,
        String(args.cart_id ?? ''),
        String(args.item_id ?? ''),
        Number(args.quantity ?? 1)
      )
      return textResult(body.id, cart)
    }

    if (name === 'remove_cart_item') {
      const cart = await removeAgentCartItem(event, String(args.cart_id ?? ''), String(args.item_id ?? ''))
      return textResult(body.id, cart)
    }

    if (name === 'preview_order') {
      const preview = await previewAgentOrder(event, String(args.cart_id ?? ''), String(args.promo_code ?? ''))
      return textResult(body.id, preview)
    }

    if (name === 'create_order') {
      checkOrderRate(event)
      const result = await createAgentOrder(event, {
        cartId: String(args.cart_id ?? ''),
        name: String(args.name ?? '').trim(),
        phone: String(args.phone ?? '').trim(),
        email: String(args.email ?? '').trim(),
        address: String(args.address ?? '').trim(),
        note: String(args.note ?? '').trim(),
        promoCode: String(args.promo_code ?? '').trim(),
        expectedTotal: Number(args.expected_total ?? 0),
        confirm: args.confirm === true
      })
      return textResult(body.id, result)
    }

    if (name === 'get_order') {
      const result = await getAgentOrder(event, String(args.order_id ?? ''), String(args.email ?? ''))
      if (!result) return textResult(body.id, 'Không tìm thấy đơn khớp mã đơn và email.', true)
      return textResult(body.id, result)
    }

    return rpcError(body.id, -32602, `Không có tool "${name}"`)
  } catch (error: any) {
    const message = error?.statusMessage || error?.message || 'Lỗi khi xử lý'
    return textResult(body.id, message, true)
  }
})
