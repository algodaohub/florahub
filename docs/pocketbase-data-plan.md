# PocketBase data layer

The application now reads and writes all store data through PocketBase. Prisma is kept only as the original seed source (`prisma/dev.db` + `prisma/seed.ts`); no runtime API uses Prisma anymore.

## Collections

| Collection | Source table | Purpose |
| --- | --- | --- |
| `users` | `User` | Auth accounts; thêm `role` (`customer` / `staff` / `admin`) cho khu quản trị |
| `addresses` | `Address` | Saved shipping addresses |
| `sellers`, `categories`, `products` | same | Catalog. `products` hỗ trợ 3 loại: `physical` / `digital` / `service` + SEO/AEO |
| `product_images`, `product_specs`, `product_options`, `product_option_values` | same | `product_images` là bảng media dùng chung: ảnh + video, `file`, `poster`, `is_featured`, `duration` |
| `variants`, `price_trends`, `stock_trends` | same | Pricing and stock history |
| `reviews` | `Review` | Product reviews |
| `regions`, `carts`, `cart_items` | same | Cart |
| `orders`, `order_items` | same | Orders + trạng thái thanh toán, mốc thời gian (`paid_at`, `completed_at`, …) và hoá đơn |
| `journal_entries` | — | Sổ nhật ký kép kế toán (mỗi bút toán 1 dòng Nợ/Có), admin-only |
| `accounting_settings` | — | Thông tin người bán trên hoá đơn (tên, MST, địa chỉ, ký hiệu/mẫu), admin-only |
| `promotions`, `banners`, `posts` | same | Merchandising and content |
| `flash_sales`, `flash_sale_items` | same | Flash sale |
| `affiliates`, `affiliate_clicks`, `affiliate_commissions` | same | Affiliate program |
| `wallets`, `wallet_transactions`, `notifications`, `settings` | existing | Account and site configuration |
| `provinces`, `wards`, `location_meta` | `server/assets/vn-locations.json` | Dữ liệu hành chính Việt Nam 2 cấp (34 tỉnh/thành, 3.321 phường/xã) |
| `ward_downgrade_rules` | `server/assets/ward-downgrade-rules.json` | Luật hạ cấp phường/xã mới → địa chỉ 3 cấp cũ mà Goship nhận (cả mã hành chính cũ + mã Goship) |

Catalog/content collections are publicly readable. Carts, orders, affiliates, promotions, and wallet data are admin-only; the Nuxt server accesses them with the PocketBase admin account.

## Vietnam locations (2 cấp, từ 01/07/2025)

Nguồn dữ liệu chuẩn: `provinces.open-api.vn/api/v2`, được bóc tách vào `server/assets/vn-locations.json`
(`npm run locations:sync` để tải lại, `npm run locations:check` để kiểm tra 34/3.321).

Dữ liệu lấy trực tiếp từ 2 endpoint danh mục (mỗi lần chạy chỉ 2 request):

- `GET /api/v2/p/` → 34 tỉnh/thành: `code`, `name`, `division_type`, `codename`, `phone_code`
- `GET /api/v2/w/` → 3.321 phường/xã/đặc khu: `code`, `name`, `division_type`, `codename`, `province_code`

JSON lưu `type` (đã chuẩn hoá từ `division_type`), `codename`, `phoneCode` và ghép sẵn wards vào từng tỉnh.
Script kiểm tra trùng mã tỉnh/phường trên toàn quốc và không ghi file nếu sai số lượng.
API còn có `GET /api/v2/w/{code}/to-legacies/` và `GET /api/v2/w/from-legacy/?legacy_name=...`
để tra phường cũ → phường mới (ví dụ “Bến Nghé” → “Phường Sài Gòn”).

```bash
npm run pb:locations        # đồng bộ dataset vào 3 collection provinces / wards / location_meta
npm run pb:locations:reset  # xoá dữ liệu cũ rồi import lại từ đầu
npm run rules:sync          # sinh luật hạ cấp toàn quốc (provinces.open-api.vn → snapshot Goship)
npm run rules:check         # kiểm tra file luật đã sinh (không gọi mạng)
npm run pb:rules            # tạo collection + upsert ward_downgrade_rules
npm run pb:rules:reset      # xoá dữ liệu luật cũ rồi nạp lại
npm run pb:orders           # thêm trường thanh toán (payment_method, payment_status) vào orders
npm run pb:store            # thêm is_default vào store_configs + chọn store mặc định
npm run pb:roles            # thêm users.role + cấp admin cho demo@florahub.vn
npm run pb:roles -- --check # chỉ xem thay đổi, không ghi
npm run pb:roles -- --admin a@x.vn,b@x.vn   # cấp thêm quyền quản trị
npm run pb:roles -- --staff c@x.vn          # cấp quyền nhân viên
npm run pb:products         # mô hình sản phẩm 3 loại + media + SEO/AEO + danh mục
npm run pb:products -- --check              # chỉ xem field còn thiếu
npm run pb:setup            # setup PocketBase + migrate Prisma + locations + luật hạ cấp
```

`pb:locations` tạo collection nếu chưa có, rồi upsert theo `code` (chạy lại chỉ đọc/so sánh nên rất nhanh).
API `/api/locations/*` đọc PocketBase và cache 5 phút; nếu PocketBase chưa có dữ liệu hoặc tạm thời
không kết nối được thì tự động dùng dataset đóng gói trong bundle (trường `resolvedBy` cho biết nguồn).

`addresses` vẫn lưu tên tỉnh/phường dạng text để tương thích dữ liệu cũ; form địa chỉ lấy danh mục
từ `provinces`/`wards` nên giá trị lưu xuống luôn theo chuẩn mới.

## Luật hạ cấp địa chỉ (2 cấp mới → 3 cấp Goship)

Giao diện khách dùng danh mục 2 cấp (`vn-locations.json`), còn Goship nhận 3 cấp cũ
(`server/assets/goship-locations.json`). Collection `ward_downgrade_rules` lưu quan hệ **ghi ngược**, mỗi dòng
là một cặp phường mới → phường cũ theo Goship:

- `new_*` — phường/tỉnh mới (mã 2 cấp dùng trên checkout).
- `new_province`, `new_ward` — relation tới `provinces`/`wards`; `pb:rules` backfill ID theo `code`
  (chạy `pb:locations` trước). Runtime vẫn lọc bằng `new_*_code` để không phải expand relation.
- `old_*` — mã hành chính cũ 2020–2025 (đối soát; Goship không có Quận 2/9/Thủ Đức nhưng có TP Thủ Đức).
- `goship_*` — mã 3 cấp hợp lệ Goship; vận chuyển chỉ dùng nhóm này.
- `is_primary` — đúng 1 dòng / phường mới, resolver tự chọn khi có nhiều đích.
- `active`, `source` (`legacy-api` | `manual`), `note`, `synced_at`.

Nguồn sinh (`npm run rules:sync`):

- `GET https://provinces.open-api.vn/api/v1/?depth=2` — 63 tỉnh + tên quận/huyện cũ.
- `GET https://provinces.open-api.vn/api/v2/w/{code}/to-legacies/` — phường mới → phường cũ kèm
  `district_code`/`province_code`.
- Snapshot Goship để khớp tên phường/quận và lấy mã `goship_*`.

Ngoại lệ thủ công: `scripts/lib/ward-downgrade-overrides.json` (mảng mã phường Goship, `remove`/`add`/
`targets`, hoặc `skip`). Kết quả commit ở `server/assets/ward-downgrade-rules.json`; `npm run pb:rules`
upsert theo `(new_ward_code, goship_ward_code)`. Runtime cache mỗi phường 5 phút nên cập nhật không cần
rebuild.

Collection `shipping_locations` cũ (cache danh mục Goship) đã xoá bằng migration
`1794100000_dropped_shipping_locations.js`.

## Migration

```bash
npm run pb:migrate
```

The script is idempotent: it creates missing collections/fields, then copies every row from `prisma/dev.db` into PocketBase. Existing PocketBase users are matched by email, so relations point at the real auth records. Every imported row stores its original Prisma id in `legacy_id`, which keeps old order links (`/orders/<old-id>`) and old cart cookies working.

No faker or generated records are used. The data copied is exactly what is already in SQLite.

## Admin

```
http://127.0.0.1:8091/_/
```

Credentials come from `.env` (`PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`).

## Admin API (Nuxt)

All routes below require an admin session cookie (`pb_token` after `POST /api/admin/login`) with
`users.role` = `staff` or `admin`. Mutations also check `Origin` when the header is present.
There is no separate PocketBase rule change: Nuxt talks to PocketBase with the admin account, so
these endpoints are the only surface exposed to browsers.

| Method | Route | Notes |
| --- | --- | --- |
| POST | `/api/admin/login` · `/api/admin/logout` | Rate limit 10/15 min; 403 nếu role `customer` |
| GET | `/api/admin/me` | Trả `{ user, role, permissions }` |
| GET | `/api/admin/orders` | `q`, `status`, `payment`, `from`, `to`, `page`, `perPage` (≤ 100); trả thêm `hasAffiliate`, `affiliateCode`, `taxInvoiceNumber` |
| GET/PATCH | `/api/admin/orders/[id]` | PATCH: status, paymentStatus, note, shipping* theo state machine (xem dưới). Trả `warning` nếu hạch toán lỗi |
| POST | `/api/admin/orders/[id]/refund` | `{ amount?, reason }`; chỉ đơn `paid` → `refunded`, ghi bút toán 5212 và huỷ hoá đơn khi hoàn toàn phần |
| POST | `/api/admin/orders/[id]/invoice` | `{ action: 'issue' \| 'cancel', reason? }`; cấp số tuần tự hoặc huỷ (giữ số) |
| GET | `/api/admin/orders/[id]/invoice` | Chi tiết hoá đơn GTGT: người bán (từ `accounting_settings`), người mua, dòng hàng, tổng/GTGT, trạng thái |
| GET | `/api/admin/orders/summary` | Đếm chờ xác nhận/chờ TT, doanh thu & đơn đã TT hôm nay, công nợ chờ thu |
| GET | `/api/admin/accounting` | `from`, `to`: tổng hợp sổ, bút toán, hoá đơn, thông tin người bán, `vatRate` |
| PUT | `/api/admin/accounting` | Lưu `accounting_settings` (chỉ role `admin`) |
| GET/POST | `/api/admin/products` | List có lọc + tạo sản phẩm |
| GET/PATCH/DELETE | `/api/admin/products/[id]` | DELETE chỉ role `admin` |
| POST | `/api/admin/products/[id]/variants` | Tạo biến thể |
| PATCH/DELETE | `/api/admin/variants/[id]` | Sửa/xoá biến thể |
| GET | `/api/admin/options` | Categories + sellers cho select |
| GET/PUT | `/api/admin/ai` | Cấu hình provider/model AI; `?models=1` lấy model khả dụng từ provider |
| POST | `/api/admin/products/ai-generate` | Gen SEO/AEO sản phẩm bằng model khách chọn |
| GET/POST | `/api/admin/assistant-docs` | Danh sách + thêm tài liệu tư vấn cho trợ lý |
| PATCH/DELETE | `/api/admin/assistant-docs/[id]` | Sửa/xoá tài liệu (chỉ role `admin`) |
| GET | `/api/admin/categories` · POST | List kèm `productCount` + tạo danh mục |
| PATCH/DELETE | `/api/admin/categories/[id]` | Xoá chỉ role `admin`; chặn khi còn danh mục con/sản phẩm |
| POST | `/api/admin/products/[id]/media` | Upload ảnh/video (multipart → PocketBase); tối đa 20 ảnh + 2 video |
| PUT | `/api/admin/products/[id]/media/order` | Lưu thứ tự kéo thả; ảnh đầu tiên thành `thumbnail` |
| PATCH/DELETE | `/api/admin/media/[id]` | Sửa `alt`, `isFeatured`, `duration`; xoá media |
| POST/DELETE | `/api/admin/products/[id]/digital-file` | Tệp sản phẩm số (protected, tối đa 50 MB) |
| GET | `/api/store/*` | Dùng chung: phiên admin hoặc header `x-studio-key` |

### Product model

`products` (18 field mở rộng) — `type`, `requires_shipping`, `weight_grams`, `seo_title`,
`seo_description`, `seo_keywords`, `canonical_url`, `aeo_summary`, `highlights` (JSON),
`faq` (JSON), `digital_file` (protected), `digital_download_limit`, `digital_expiry_days`,
`digital_license`, `service_duration`, `service_location`, `service_capacity`,
`service_booking_note`. `highlights` dạng `[{ title, description }]`, `faq` dạng
`[{ question, answer }]`; `type` mặc định `physical` cho dữ liệu cũ.

`categories` thêm `parent` (self relation), `description`, `seo_title`, `seo_description`,
`is_active`, `updated_at`. `product_images` thêm `type` (`image`/`video`), `file`, `poster`,
`is_featured`, `duration`; `url` không còn bắt buộc để media chỉ có file.

### Order lifecycle

Luật chuyển trạng thái nằm ở `utils/order-state.ts` (dùng chung client + server) và được server ép buộc
trong `PATCH /api/admin/orders/[id]`:

```
status   pending → confirmed | cancelled
         confirmed → shipping | cancelled
         shipping → completed        (completed / cancelled là trạng thái cuối)
payment  '' → pending | cod | paid
         pending → paid      cod → paid
         paid → refunded     (chỉ qua POST /refund — PATCH bị chặn)
```

- **Đơn đã `paid` không bao giờ quay về `pending`/`cod`/`''`.** Muốn trả tiền, dùng luồng Hoàn tiền.
- Huỷ đơn `paid` bị chặn (hoàn tiền trước); hoàn tất đơn chưa thu tiền (`pending`) bị chặn.
- Server tự ghi mốc `paid_at`, `completed_at`, `cancelled_at`, `refunded_at`; client không gửi các trường này.
- Sau mỗi thay đổi, server gọi `ensureOrderAccounting()`; lỗi hạch toán không chặn cập nhật — API trả thêm
  `warning` và có thể đồng bộ lại từ `/admin/accounting`.

### Kế toán (VAS 14, TT 200/2014 & TT 133/2016)

Giá bán là **giá đã bao gồm GTGT**. Lúc tạo đơn, `place-order.ts` chụp `tax_rate` (từ
`store.features.taxRate`) và tách thuế: `tax_total = round(total × rate / (100 + rate))`,
`net = total − tax_total`; `total` không đổi.

| Sự kiện | Nợ | Có | Ngày |
| --- | --- | --- | --- |
| Đơn hoàn tất (ghi nhận doanh thu) | 111 (COD) / 112 (QR, SePay, đã TT) / 131 (chưa thu) | 511 `net` + 3331 `tax_total` | `completed_at` |
| Hoàn tiền | 5212 `net hoàn` + 3331 `VAT hoàn` | 111/112 `refunded_amount` | `refunded_at` |

- Bút toán lưu trong `journal_entries` (`ref_type` = `sale` / `refund`), idempotent theo `(order, ref_type)`.
- Hoá đơn tự cấp số tuần tự theo năm `HD2026-000001` khi đơn `completed` (unique index chống trùng, retry
  6 lần). Huỷ hoá đơn **giữ số** và lưu lý do; xuất thay thế lấy số kế tiếp.
- Hồ sơ người bán (tên, MST, địa chỉ, ký hiệu/mẫu) lưu trong `accounting_settings`, sửa tại
  `/admin/accounting` (chỉ role `admin`).
- Chưa hạch toán giá vốn 632/156 vì hệ thống chưa có dữ liệu giá nhập; hoá đơn là sổ theo dõi nội bộ,
  phát hành hoá đơn điện tử cần nhà cung cấp được cấp phép.
- Xuất CSV (UTF-8 BOM, dấu `;`) cho sổ nhật ký, sổ hoá đơn và bảng kê bán ra PL 01-1/GTGT.

### AI model

Cấu hình tại `/admin/ai`, lưu trong collection `ai_settings` (admin-only, không lộ API key ra client).
`server/utils/ai.ts` đọc DB trước, chưa có bản ghi thì dùng `.env` (`AI_PROVIDER`, `AI_BASE_URL`,
`AI_MODEL`, `AI_MODELS`, `AI_API_KEY`). Máy cài mới mặc định 9router local
(`http://127.0.0.1:20128/v1`) và model `oc/deepseek-v4.1-flash-free`.

Danh sách model trong `ai_settings.models` là các model khách được chọn ở nút “Gen bằng AI”.
`GET /api/admin/ai?models=1` đọc `/models` của provider để gợi ý danh sách; provider không hỗ trợ
hoặc chưa có key thì giữ danh sách đã lưu.

### Trợ lý tư vấn

- Trang `/tro-ly` (storefront) — chat tư vấn tiếng Việt, tư vấn trước và chỉ hiện thẻ sản phẩm FloraHub khi thật sự khớp nhu cầu.
- `POST /api/assistant/chat` — body `{ message, history? }`; trả `{ reply, products, docs, aiUsed }`.
- Chỉ tìm trong catalog FloraHub (không gọi Shop/Shopify). Không khớp từ khoá thì `products` rỗng và trợ lý hỏi thêm dịp/ngân sách/màu.
- Khi AI chưa có key, endpoint trả lời theo mẫu dựa trên kết quả tìm được.
- Thẻ sản phẩm dùng `ProductCard` layout `row`: ảnh, tên, giá, nút thêm vào giỏ.

### Tài liệu tư vấn

- Collection `assistant_docs`: `title`, `content`, `tags`, `is_active`, `sort_order`, `updated_at`.
- Quản trị tại `/admin/assistant`. `server/utils/assistant-docs.ts` chọn tối đa 3 tài liệu theo từ khoá
  (title/tags/content), cắt còn ~4.500 ký tự rồi ghép vào prompt. Không khớp gì thì lấy tài liệu đầu tiên.
- Tài liệu là dữ liệu tham khảo: giá/tồn kho vẫn lấy từ `products`; prompt chặn chỉ dẫn nằm trong tài liệu.

### Điều hướng trợ lý

- `layout.assistantInHeader` (mặc định `true`) bật/tắt nút trợ lý ở header; chỉnh trong `/admin/storefront`.
- `layout.bottomNav.items` nhận thêm `assistant` để đặt trợ lý vào thanh điều hướng dưới.
- Tắt cả hai = ẩn lối vào, trang `/tro-ly` vẫn truy cập trực tiếp được.

### Agent & CLI

- `GET /llms.txt` — mô tả cửa hàng, endpoint agent, quy tắc đặt đơn và thanh toán.
- `POST /api/mcp` — MCP JSON-RPC 2.0 stateless (initialize, tools/list, tools/call, ping). CORS mở, không cần auth.
  - Đọc: `search_catalog`, `get_product` (trả kèm `variantId` / danh sách `variants`).
  - Giỏ: `create_cart`, `get_cart`, `add_to_cart`, `update_cart_item`, `remove_cart_item`.
  - Đơn: `preview_order`, `create_order`, `get_order`.
- `cart_id` là bearer token của một giỏ: ai có id là thao tác được. Không log, không chia sẻ.
- `create_order` chỉ chạy khi `confirm: true` và `expected_total` khớp đúng tổng server tính; lệch → 409 kèm tổng mới.
- `get_order` đòi khớp mã đơn **và** email; sai email trả null (không lộ đơn người khác).
- Rate limit đặt đơn: 5 đơn / 10 phút / IP (in-memory, một process; production nhiều instance nên chuyển sang Redis/CDN).
- Giỏ/đơn của agent dùng chung logic với web qua `server/utils/place-order.ts` (`priceOrder`, `placeOrder`); REST `POST /api/orders` chỉ là wrapper mỏng.
- Thanh toán: chỉ **VietQR** hoặc **COD** theo `config.payments` (`utils/payments.ts`). Không có cổng thẻ. Đơn QR bắt đầu ở `payment_status = pending`.
- `GET /api/agent/catalog?q=&limit=` — bản JSON đơn giản cho agent không dùng MCP.
- `npm run agent -- search "hoa hồng" --limit 5` · `product <handle>` · `chat "..." --shop`.
  CLI gọi HTTP API, đổi server bằng `FLORAHUB_URL`.
- AEO: trang sản phẩm đã có JSON-LD `Product` + `FAQPage`, dùng `seo_description`, `aeo_summary`, `highlights`, `faq`.


### Media

- Trình duyệt tải file lên Nuxt (`multipart`) → Nuxt dùng admin token đẩy binary sang PocketBase.
- URL trả về dạng `/media/product_images/{id}/{file}`; route `server/routes/media/[...path].get.ts`
  proxy same-origin, hỗ trợ `Range` cho video và cache `immutable`. PocketBase không cần mở public.
- Giới hạn: ảnh 10 MB, video 25 MB, 20 ảnh + 2 video/sản phẩm; file số 50 MB.
- Sau upload/xoá/sắp xếp, server đồng bộ `products.thumbnail` = URL ảnh đầu tiên (theo `sort_order`).

## Thanh toán tự động (SePay)

Webhook `POST /api/webhooks/sepay` nhận biến động số dư từ SePay và tự đánh dấu đơn `payment_status = paid`.

### 1. Cấu hình trên SePay

1. Thêm tài khoản ngân hàng nhận tiền tại https://my.sepay.vn/bankaccount (phải trùng số tài khoản đã nhập trong `/admin/storefront` → Thanh toán).
2. Vào https://my.sepay.vn/webhooks → **Thêm webhook**:
   - Sự kiện: **Có tiền vào**.
   - URL: `https://<domain>/api/webhooks/sepay` (production phải HTTPS).
   - Tài khoản: chọn đúng tài khoản ở bước 1.
   - Bảo mật: **HMAC-SHA256** (khuyến nghị) hoặc **API Key**.
3. Copy Secret Key / API Key ngay khi tạo — SePay chỉ hiện đầy đủ một lần.

### 2. Lưu khóa trong database

Vào `/admin/payments` → nhóm **VietQR miễn phí** và nhập:
- **Webhook secret (HMAC)** (khuyến nghị) hoặc **Webhook API key** — key SePay cấp khi tạo webhook.
- **SePay API token** + **API base URL** (`https://my.sepay.vn/userapi`) — dùng để đối soát giao dịch.

Khóa lưu trong collection `payment_settings` (mọi rule `null`: REST công khai không đọc/ghi được, chỉ
server dùng PB admin client). `/api/site` và `GET /api/store/config` chỉ trả cờ
`payments.qr.webhookReady` / `payments.qr.apiReady`; giao diện admin chỉ hiển thị 4 ký tự cuối.

Chưa có khóa → webhook trả `503`, đơn vẫn ở trạng thái chờ thanh toán.

`.env` chỉ dùng một lần khi nâng cấp từ bản cũ:

```bash
npm run pb:payments   # đọc SEPAY_* trong .env → ghi vào payment_settings
```

Sau đó comment toàn bộ dòng `SEPAY_*` trong `.env`; server không đọc các biến này nữa.

### 3. Mã đơn trong nội dung chuyển khoản

- Trang đơn hiển thị nội dung dạng `ORD-XXXXXX` (6 ký tự cuối của order id).
- Webhook chuẩn hoá nội dung (bỏ dấu, viết hoa) và tìm `ORD` + 6 ký tự, nên ngân hàng bỏ dấu gạch vẫn khớp.
- Trên SePay có thể đặt tiền tố mã thanh toán `ORD` để lọc giao dịch; không bắt buộc vì FloraHub tự tách mã.

### 4. Hành vi

- Chỉ xử lý `transferType = "in"`.
- Chống trùng: kiểm tra `orders.sepay_transaction_id` theo `id` giao dịch; webhook gửi lại trả `{"success": true}` mà không đổi gì.
- Chuyển thiếu tiền: giữ `pending`, ghi log server, không báo lỗi cho SePay.
- Khớp tiền: cập nhật `payment_status = paid`, `sepay_transaction_id`, `paid_at`. Trạng thái đơn (`status`) vẫn do shop xác nhận.
- Luôn trả HTTP 200 + `{"success": true}` cho giao dịch không xử lý được để SePay không retry vô ích.
- Trang `/orders/<id>` tự gọi lại mỗi 15 giây (4 giây khi vừa quay về từ cổng thanh toán) khi đơn QR/SePay chưa thanh toán.
- IP gửi webhook của SePay (whitelist nếu cần): `172.236.138.20`, `172.233.83.68`, `171.244.35.2`, `151.158.108.68`, `151.158.109.79`, `103.255.238.139`, `45.57.137.67`.

### 5. Kiểm thử

1. Trên trang webhook SePay bấm **Gửi thử** → nhận 200 và log `[sepay]`.
2. Hoặc chuyển khoản thật một khoản nhỏ với nội dung `ORD-XXXXXX`.
3. Kiểm tra đơn trong `/admin/orders`: badge chuyển sang **Đã thanh toán**.
4. Xem lịch sử gửi tại https://my.sepay.vn/webhookslog.

### 6. Đối soát giao dịch qua Open API

Webhook là nguồn xác nhận chính; Open API là lưới an toàn khi webhook trễ/mất và cho nút kiểm tra thủ công.

1. Lấy API token tại https://my.sepay.vn → **API** (giới hạn ~3 request/giây, 429 kèm
   `x-sepay-userapi-retry-after`) và lưu tại `/admin/payments`.
2. Bấm **Đồng bộ từ SePay** để lưu snapshot tài khoản ngân hàng (dùng để lọc giao dịch).
3. Trang đơn mở SSE `GET /api/orders/<id>/stream`: server cầu nối realtime PocketBase với trình duyệt và
   tự đối soát SePay mỗi 20 giây khi đơn còn `pending`; trạng thái mới được đẩy về ngay khi record đổi,
   không reload trang.

`POST /api/orders/<id>/check-payment` gọi `transactions/list`, khớp số tài khoản + số tiền + nội dung
`ORD...`, rồi mark `paid` idempotent theo `sepay_transaction_id`. Mỗi đơn được đối soát tối đa 1 lần/20 giây;
429 được chờ theo header rồi retry một lần. QR vẫn miễn phí — API chỉ đọc dữ liệu, không tạo giao dịch.
Endpoint này giữ cho tích hợp/CLI; giao diện không còn nút kiểm tra thủ công.

## Cổng thanh toán SePay (hosted checkout)

Khác với webhook biến động số dư ở trên: đây là **cổng thanh toán** — khách được chuyển sang
`pay.sepay.vn` để trả bằng thẻ quốc tế, VietQR hoặc NAPAS QR; SePay gọi IPN về server để xác nhận.
Hai luồng chạy song song và không thay thế nhau.

### 1. Cấu hình trên SePay

1. Tạo merchant tại https://my.sepay.vn → **Cổng thanh toán**, lấy `merchant_id` và `secret_key`
   (sandbox và production có credentials riêng).
2. Khai báo IPN URL: `https://<domain>/api/webhooks/sepay-ipn`.
3. Khai báo return URL nếu SePay yêu cầu; FloraHub tự gửi `success_url` / `error_url` / `cancel_url`
   trỏ về `/orders/<id>?payment=success|error|cancel`.

### 2. Cấu hình merchant trong database

Vào `/admin/payments` → nhóm **Cổng thanh toán SePay** và nhập `Merchant ID`, `Merchant secret key`,
môi trường (`sandbox` | `production`), tùy chọn `IPN secret` và `Public URL`. Cùng collection
`payment_settings` với webhook/API token; không có secret nào nằm trong `.env` hay config công khai.

Thiếu `Merchant ID`/`secret` → cổng thanh toán không sẵn sàng (`payments.sepay.ready = false`),
đơn mới tự lùi về VietQR/COD.

### 3. Bật trong Store Studio

`/admin/storefront` → **Thanh toán** → bật **Cổng SePay (có phí)** và chọn làm phương thức mặc định.
Tick/chọn phương thức được đồng bộ: chọn VietQR hay SePay làm mặc định sẽ tự bật công tắc tương ứng.
Cấu hình công khai chỉ lưu công tắc `payments.sepay.enabled`; credentials không bao giờ được trả ra client.

### 4. Hành vi

- `POST /api/orders/<id>/sepay-checkout` ký form (HMAC-SHA256, base64) và trả `action` + `fields`;
  browser tự submit form sang `/v1/checkout/init`.
- `order_invoice_number` dạng `ORD-<order id>-<suffix>`; suffix cho phép khách thử thanh toán lại.
- IPN `POST /api/webhooks/sepay-ipn` xác thực header `X-Secret-Key` (constant-time), chỉ xử lý
  `notification_type = ORDER_PAID`, kiểm tra VND + `order_status` + đúng số tiền.
- Chống trùng: đơn đã `paid` trả `{"success": true}`; ghi `sepay_transaction_id`, `sepay_order_id`, `paid_at`.
- Sai tiền tệ/trạng thái/số tiền: giữ `pending`, ghi log, vẫn trả HTTP 200 để tránh retry vô ích.
- Cột audit: `orders.sepay_invoice_number`, `orders.sepay_order_id` (PB migration tự chạy khi khởi động).

### 5. Kiểm thử

1. Dùng merchant sandbox (chọn môi trường **Sandbox** tại `/admin/payments`); chạy Nuxt qua HTTPS tunnel
   để SePay gọi được IPN/return URL.
2. Đặt đơn → thanh toán bằng thẻ test → quay về `/orders/<id>?payment=success`, đơn chuyển `paid`.
3. Giả lập IPN bằng curl: sai `X-Secret-Key` → 401; replay → 200 không đổi; lệch số tiền → 200 nhưng vẫn `pending`.

## Notes

- PocketBase record ids are new 15-character ids. Old Prisma ids remain in `legacy_id`.
- `created_at`/`updated_at`/`published_at` are explicit date fields so original timestamps survive the move.
- PocketBase auto-generated the migrations in `pb_migrations/` when the collections were created.
