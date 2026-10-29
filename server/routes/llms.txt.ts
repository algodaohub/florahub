import { getStoreConfig } from '~~/server/utils/store'

export default defineEventHandler(async (event) => {
  const baseUrl = getRequestURL(event).origin
  const { config } = await getStoreConfig(event)
  const brand = config.brand

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=300')

  return `# ${brand.name}

> ${brand.description || brand.tagline || 'Cửa hàng hoa và quà tặng tại Việt Nam.'}
> Giá niêm yết bằng VND. Khu vực giao hàng: Việt Nam.

## Dành cho agent

- [MCP server](${baseUrl}/api/mcp): JSON-RPC 2.0, POST, không cần đăng nhập. CORS mở. Tools:
  - \`search_catalog\` (query, limit): tìm sản phẩm, trả \`variantId\` mặc định.
  - \`get_product\` (handle): mô tả, giá, danh sách variant, tồn kho, FAQ.
  - \`create_cart\`: tạo giỏ, trả \`cart_id\`.
  - \`get_cart\` (cart_id), \`add_to_cart\` (cart_id, variant_id, quantity), \`update_cart_item\` (cart_id, item_id, quantity), \`remove_cart_item\` (cart_id, item_id).
  - \`preview_order\` (cart_id, promo_code?): tạm tính, giảm giá, phí giao, tổng tiền, cách thanh toán.
  - \`create_order\` (cart_id, name, phone, email, address, note?, promo_code?, expected_total, confirm): tạo đơn thật.
  - \`get_order\` (order_id, email): tra trạng thái và hướng dẫn thanh toán.
- [Catalog API](${baseUrl}/api/agent/catalog?q=hoa): GET JSON, tham số \`q\` và \`limit\` (1–24).
- [Trợ lý mua sắm](${baseUrl}/tro-ly): chat tư vấn cho khách hàng.

## Quy tắc đặt đơn

- \`cart_id\` là bí mật của một khách: không chia sẻ, không dùng chung giữa các khách.
- Luôn gọi \`preview_order\` rồi cho khách xem người bán, sản phẩm, số lượng, tổng tiền và cách thanh toán.
- Chỉ gọi \`create_order\` khi khách đã đồng ý: bắt buộc \`confirm: true\` và \`expected_total\` đúng bằng \`total\` của \`preview_order\`. Lệch tổng sẽ bị từ chối.
- Không tự bịa tên, số điện thoại, email hay địa chỉ. Thiếu thì hỏi khách.
- Mỗi IP tối đa 5 đơn / 10 phút.

## Thanh toán

- Cửa hàng nhận **VietQR miễn phí**, **cổng thanh toán SePay có phí** (thẻ quốc tế / VietQR / NAPAS) hoặc **thanh toán khi nhận hàng (COD)**.
- \`preview_order\` và \`create_order\` trả \`payment.method\`: \`qr\` (miễn phí, kèm \`qrUrl\`, số tài khoản, nội dung chuyển khoản), \`sepay\` (có phí, kèm \`payUrl\` khi đã tạo đơn) hoặc \`cod\`.
- Đơn QR ở trạng thái \`pending\` tới khi nhận đủ tiền; hệ thống tự cập nhật sang \`paid\` qua webhook SePay hoặc Open API khi khách chuyển đúng nội dung \`ORD-XXXXXX\`. Trang \`/orders/<id>\` nhận trạng thái realtime; tích hợp có thể gọi \`POST /api/orders/<id>/check-payment\` để đối soát thủ công.
- Đơn SePay ở trạng thái \`pending\` tới khi cổng thanh toán gửi IPN; khách mở \`payUrl\` để thanh toán online.

## Quy tắc dữ liệu

- Giá, tồn kho và URL lấy trực tiếp từ dữ liệu sản phẩm; không tự suy đoán.
- Link sản phẩm dạng ${baseUrl}/product/{handle}.
- Tra đơn phải khớp mã đơn **và** email người đặt; sai email sẽ không trả dữ liệu.
`
})
