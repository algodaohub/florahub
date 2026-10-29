# Luồng thanh toán Cổng Thanh Toán SePay

## Tìm hiểu luồng thanh toán one-time và recurring trong Cổng thanh toán SePay, chọn mô hình tích hợp phù hợp cho website hoặc app của bạn.

---

**API Overview:**

API cổng thanh toán SePay hỗ trợ nhiều phương thức thanh toán bao gồm chuyển khoản ngân hàng qua QR code, NAPAS QR và thẻ quốc tế.

**Base URLs:**
- Production API: `https://pgapi.sepay.vn`
- Sandbox API: `https://pgapi-sandbox.sepay.vn`
- Production Checkout: `https://pay.sepay.vn`
- Sandbox Checkout: `https://pay-sandbox.sepay.vn`

**Xác thực:** Tất cả API sử dụng Basic Authentication với `merchant_id` và `secret_key`.


---

## Thanh toán một lần (One-time Payment)

Luồng thanh toán một lần cho phép khách hàng thanh toán ngay lập tức cho một đơn hàng cụ thể.

<Mermaid title="Trình tự xử lý thanh toán">
sequenceDiagram
  participant C as Khách hàng
  participant M as Website Merchant
  participant S as SePay Gateway
  participant B as Ngân hàng/Thẻ

  C->>M: 1. Chọn sản phẩm & thanh toán
  M->>M: 2. Tạo đơn hàng
  M->>M: 3. Tạo form checkout với signature
  M->>S: 4. POST /v1/checkout/init
  S->>S: 5. Xác thực signature
  S->>C: 6. Chuyển hướng đến trang thanh toán

  C->>S: 7. Chọn phương thức thanh toán
  S->>B: 8. Xử lý thanh toán
  B->>S: 9. Kết quả thanh toán

  alt Thanh toán thành công
      S->>M: 10a. Callback success_url
      S->>M: 11a. IPN notification
      S->>C: 12a. Chuyển hướng về trang thành công
  else Thanh toán thất bại
      S->>M: 10b. Callback error_url
 S->>C: 12b. Chuyển hướng về trang lỗi
  else Khách hàng hủy
      S->>M: 10c. Callback cancel_url
      S->>C: 11c. Chuyển hướng về trang hủy
  end

  M->>C: 13. Hiển thị kết quả cuối cùng
</Mermaid>

### Các bước chi tiết:

1. **Khách hàng chọn sản phẩm**: Thêm vào giỏ hàng và bấm "Thanh toán"
2. **Website tạo đơn hàng**: Lưu thông tin đơn hàng vào database
3. **Tạo form checkout**: Chuẩn bị dữ liệu và tạo signature HMAC-SHA256
4. **Gửi request đến SePay**: POST form đến endpoint `/v1/checkout/init`
5. **Xác thực signature**: SePay kiểm tra tính hợp lệ của chữ ký
6. **Chuyển hướng khách hàng**: Đến trang thanh toán của SePay
7. **Chọn phương thức thanh toán**: Thẻ, QR Banking, QR NAPAS
8. **Xử lý thanh toán**: SePay giao tiếp với ngân hàng/thẻ
9. **Nhận kết quả**: Từ hệ thống ngân hàng
10. **Callback về website**: Gọi các URL callback tương ứng
11. **IPN notification**: Thông báo kết quả thanh toán qua IPN
12. **Chuyển hướng khách hàng**: Về trang kết quả trên website
13. **Hiển thị kết quả**: Trang thành công/lỗi/hủy

***

## Thanh toán định kỳ (Recurring Payment)

<Callout type="info" title="Tính năng sắp ra mắt">
Thanh toán định kỳ hiện đang trong giai đoạn hoàn thiện và sẽ được phát hành trong thời gian tới.
Vui lòng theo dõi cập nhật từ SePay để biết thời điểm ra mắt chính thức.
</Callout>

---

## Luồng miễn phí trong FloraHub (VietQR + webhook + Open API)

Đây là luồng mặc định, **không phí cổng**:

- **QR động:** ảnh `img.vietqr.io` mang đúng số tiền và nội dung `ORD-XXXXXX` (6 ký tự cuối order id).
- **Xác nhận chính:** webhook biến động số dư `POST /api/webhooks/sepay` (HMAC hoặc API key); khớp
  `ORD` + mã đơn, đủ tiền → `payment_status = paid`.
- **Đối soát dự phòng:** SePay Open API (`bankaccounts/list`, `transactions/list`) tự chạy mỗi 20 giây khi
  khách đang mở trang đơn (SSE `GET /api/orders/<id>/stream`), throttle 20 giây/đơn; tôn trọng giới hạn
  3 req/s và `x-sepay-userapi-retry-after` khi gặp 429. Tích hợp/CLI có thể gọi thủ công
  `POST /api/orders/<id>/check-payment`.
- **Cập nhật realtime:** server cầu nối realtime PocketBase với trình duyệt qua SSE; khi record `orders`
  đổi (webhook, đối soát hoặc admin xác nhận), trang đơn nhận trạng thái mới ngay — không reload trang.
- **Chống trùng:** `orders.sepay_transaction_id`; webhook/reconcile gửi lại không đổi dữ liệu.
- **Bảo mật:** API token, webhook secret và merchant key lưu trong collection `payment_settings`
  (rule `null`, chỉ server đọc); public config chỉ trả cờ readiness.

## Triển khai trong FloraHub

- **Phương thức:** `payments.method = "sepay"` là **cổng hosted có phí**; bật bằng
  `payments.sepay.enabled` trong Store Studio. VietQR miễn phí dùng `payments.method = "qr"`.
- **Credentials (database):** nhập tại `/admin/payments` — merchant id/secret/env, IPN secret,
  public URL, API token và webhook key. Không lưu secret trong `store_configs.config` hay `.env`.
  Nâng cấp từ bản cũ: chạy `npm run pb:payments` một lần rồi comment các dòng `SEPAY_*` trong `.env`.
- **Tạo checkout:** `POST /api/orders/<id>/sepay-checkout` trả `{ action, fields }` đã ký; browser tự submit form
  sang `<checkout host>/v1/checkout/init`.
- **Chữ ký:** HMAC-SHA256, base64 của raw digest; chuỗi ký gồm các field có mặt theo đúng thứ tự
  `order_amount, merchant, currency, operation, order_description, order_invoice_number, customer_id,
  payment_method, success_url, error_url, cancel_url`, nối `key=value` bằng dấu phẩy, giá trị thô.
- **Invoice:** `ORD-<order id>-<suffix>` — dùng để IPN đối chiếu; suffix cho phép thanh toán lại.
- **Return URL:** `/orders/<id>?payment=success|error|cancel`; trang đơn tự poll nhanh khi vừa quay về.
- **IPN:** `POST /api/webhooks/sepay-ipn`, xác thực `X-Secret-Key`, chỉ xử lý `ORDER_PAID`, kiểm tra VND +
  `CAPTURED` + đúng số tiền, chống trùng theo `sepay_transaction_id`; luôn trả `{"success": true}` khi đã xử lý.
- **Phạm vi v1:** chỉ thanh toán một lần; nạp ví và recurring chưa hỗ trợ.