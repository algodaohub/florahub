# Store Studio — cấu hình website A–Z trong database

Một nền tảng, nhiều cửa hàng. Toàn bộ giao diện (màu sắc, tone, font, bo góc, bố cục,
header, bottom nav, hero, SEO, phí giao hàng, tính năng…) được lưu trong PocketBase và
render **ngay ở lần đầu** (SSR), không cần build lại.

## 1. Kiến trúc

```c
store_configs (PocketBase: JSON config)
        │
        ▼
server/utils/store.ts      resolve theo domain → chuẩn hoá + cache 10s
        │
        ├── GET /api/site            → SiteSettings cũ + config (tương thích toàn app)
        ▼
plugins/00.site.ts  →  useState('store-config')
        │
        ▼
app.vue  →  <html style="--color-primary:…;--radius-card:…">
        │
        ▼
Tailwind + CSS components dùng var(--…)  →  render đúng ngay byte đầu tiên
```

- Không có FOUC: CSS variables nằm trong **style attribute của `<html>`** (SSR), nên luôn
  thắng thứ tự stylesheet.
- Toàn bộ token màu/bo góc/font đều đi qua CSS variables (`assets/css/main.css`,
  `tailwind.config.ts`).
- Config được cache 10 giây theo host; mọi thao tác ghi sẽ xoá cache.

## 2. Mở Studio

```
/admin/storefront
```

- Vào từ sidebar **Cửa hàng** trong `/admin`; `/studio` cũ tự redirect **301** sang đây.
- Không còn ô nhập key: quyền ghi lấy từ **phiên đăng nhập admin** (`users.role` = `staff`/`admin`).
- `x-studio-key` (env `NUXT_STUDIO_KEY`) vẫn được `/api/store/*` chấp nhận cho script/CLI cũ,
  nhưng không cần cho UI và sẽ bị bỏ ở phase sau.

Trong Studio (nằm trong layout admin full width) có:

| Nhóm | Nội dung |
| --- | --- |
| Cửa hàng | Danh sách store, tạo store mới **1 click** từ preset, chọn store để sửa |
| Preset | 6 bộ giao diện dựng sẵn (Vườn nhà, Hồng pastel, Tối giản, Sang trọng, Nhiệt đới, Mộng mơ) |
| Màu sắc | 11 token: primary/dark/soft, accent/soft, paper/paper-deep, ink, muted, hairline, discount |
| Kiểu chữ | Font tiêu đề/nội dung (Lora, Playfair Display, Be Vietnam Pro, Inter, Nunito), độ đậm, giãn chữ |
| Hình khối | Bo góc thẻ/nút/ô nhập/ảnh, mức đổ bóng |
| Bố cục | Kiểu header (classic / centered / minimal), số cột sản phẩm, kiểu thẻ, độ rộng khung, lề, tagline, announcement bar, bottom nav (bật/tắt + thứ tự mục), footer |
| Nội dung | Hero trang chủ (nhãn, tiêu đề, mô tả, CTA, ảnh) |
| Nhận diện & SEO | Logo, favicon, mô tả, hotline, email, địa chỉ, title template, keywords, OG image |
| Thương mại | Tiền tệ, locale, phí giao hàng, ngưỡng freeship, thuế, % hoa hồng CTV, bật/tắt affiliate, ví, đánh giá, flash sale, yêu thích, tra cứu đơn |
| Thanh toán | Phương thức mặc định (QR / COD), ngân hàng, số tài khoản, chủ tài khoản, mẫu VietQR |

Bên phải là **preview trực tiếp**: mọi thay đổi đổ vào CSS variables của khung xem trước,
bấm **Lưu & áp dụng** mới ghi DB.

Trong Studio:

- Header luôn hiển thị **Đang phát** — store đang phục vụ host hiện tại — kèm badge **mặc định**
  và link **Xem cửa hàng ↗**.
- Mỗi preset có nút **Áp dụng & lưu**: đổi theme + ghi DB trong 1 click (không cần nhớ bấm Lưu).
- Nếu đang sửa một store không phát trên host hiện tại, Studio hiện cảnh báo và nút
  **Đặt làm cửa hàng mặc định**. Lưu store phụ không làm đổi storefront đang chạy.
- Tab storefront đang mở tự nhận theme mới qua `localStorage` event — không cần F5.
- Có thay đổi chưa lưu thì Studio hỏi lại khi chuyển store hoặc rời trang.

### Thanh toán

- `payments.method` là phương thức mặc định cho **đơn hàng mới** (`qr` = VietQR miễn phí,
  `sepay` = cổng SePay có phí, hoặc `cod`). Tick/chọn phương thức được đồng bộ hai chiều.
- `payments.qr` gồm `bankId` (BIN 6 số hoặc mã ngân hàng như `VCB`), `bankName`, `accountNo`,
  `accountName`, `template` (`compact2` / `compact` / `qr_only` / `print`) và công tắc `enabled`.
- Đơn được tạo với `payment_method` + `payment_status`; mã QR sinh từ VietQR
  (`img.vietqr.io`) theo số tiền và nội dung `ORD-XXXXXX`.
- Đơn QR tự chuyển `paid` khi webhook SePay báo tiền về hoặc khi Open API đối soát thấy giao dịch.
  Trang đơn cập nhật realtime qua SSE (server cầu nối PocketBase) — không tải lại trang, không cần nút
  kiểm tra thủ công.
- Nếu chọn QR nhưng chưa nhập ngân hàng/số tài khoản, hệ thống tự lùi về **COD** để tránh
  hiển thị mã QR không dùng được.
- `payments.sepay.enabled` bật **Cổng thanh toán SePay** (hosted checkout: thẻ quốc tế, VietQR,
  NAPAS) — **có thu phí mỗi giao dịch**. Merchant credentials lưu trong database, nhập tại
  `/admin/payments`; không lưu vào config công khai.
  Đơn SePay ở trạng thái `pending` tới khi IPN `/api/webhooks/sepay-ipn` xác nhận.
- Cờ readiness (`qr.webhookReady`, `qr.apiReady`, `sepay.ready`) do server inject lúc trả config,
  không ghi vào DB. Thiếu key thì hệ thống tự lùi về QR/COD và tab Thanh toán hiện cảnh báo.
- Thêm trường thanh toán vào collection `orders` trên database đang chạy: `npm run pb:orders`.

## 3. Tạo cửa hàng mới trong 1 click

1. `/admin/storefront` → **+ Cửa hàng mới**
2. Nhập tên + domain (để trống nếu là store mặc định) + chọn preset
3. **Tạo 1 click**

Store mới nhận trọn bộ config của preset; sau đó chỉnh tiếp và Lưu.

## 4. Nhiều domain trên cùng một nền tảng

Mỗi request được resolve theo thứ tự **cố định**:

1. Store có `domain` khớp chính xác host (`hoamay.vn` → chỉ áp dụng khi request tới host đó)
2. Store được đánh dấu `is_default = true` (★ trong Studio)
3. Store có `domain = ""` (tương thích dữ liệu cũ)
4. Không có store nào → suy ra config từ bảng `settings` cũ (tương thích ngược)

Thứ tự này **không phụ thuộc thời điểm ghi**, nên sửa/lưu một store không còn làm storefront
"nhảy" sang store khác. Trước đây store mặc định là bản ghi domain rỗng mới cập nhật nhất —
đó là lý do cập nhật theme đôi khi không thấy đổi.

- Chỉ nên có **một** store `is_default`. Studio hiển thị badge ★, cảnh báo khi đang sửa store
  không phát trên host hiện tại và cho phép **Đặt làm mặc định** trong 1 click.
- Nhiều store cùng `domain = ""` vẫn hợp lệ, nhưng chỉ store mặc định được phát → gán domain
  riêng cho các store còn lại.
- Thêm trường `is_default` vào database đang chạy và chọn store mặc định:

```bash
npm run pb:store                                     # tự chọn store đang được resolve
npm run pb:store -- --default <store_id>             # chỉ định store mặc định
```

Host được đọc từ `X-Forwarded-Host` / `Host`, đã chuẩn hoá (bỏ port, `www.`). Vì vậy chỉ cần
trỏ nhiều domain về cùng một instance (Nginx/Caddy/Cloudflare) là xong — không cần deploy riêng.

## 5. API

| Method | Endpoint | Ghi chú |
| --- | --- | --- |
| GET | `/api/site` | SiteSettings cũ + `{ config, store, resolvedBy }` (không cache) |
| GET | `/api/store/config` | Config theo host hiện tại; `?store=<id>` để lấy theo id |
| PUT | `/api/store/config` | Ghi đè một phần (deep merge) + `name` / `domain` / `preset` / `isDefault`; `?store=<id>` |
| GET | `/api/store/presets` | Danh sách preset + swatches |
| GET | `/api/store` | Danh sách store, store mặc định đứng đầu |
| POST | `/api/store/default` | Đặt store làm mặc định: `{ "store": "<id>" }` |
| POST | `/api/store/apply-preset` | Áp preset cho `store` (hoặc store hiện tại) |
| POST | `/api/store/scaffold` | Tạo store mới từ preset |

Các route ghi yêu cầu **một trong hai**: phiên admin (`pb_token` cookie, role `staff`/`admin`)
hoặc header `x-studio-key` (legacy). Không có cả hai → 401; role `customer` → 403.

Ví dụ:

```bash
# Cách 1 — phiên admin (cookie lấy từ /api/admin/login)
curl -X PUT http://localhost:4321/api/store/config \
  -b admin-cookies.txt \
  -H 'content-type: application/json' \
  -d '{"config":{"colors":{"primary":"#C2708B"},"layout":{"productGridColumns":2}}}'

# Cách 2 — script CLI cũ
curl -X PUT http://localhost:4321/api/store/config \
  -H 'content-type: application/json' \
  -H 'x-studio-key: florahub-studio' \
  -d '{"config":{"colors":{"primary":"#C2708B"},"layout":{"productGridColumns":2}}}'
```

## 6. Cấu trúc config

```ts
{
  brand: { name, tagline, description, logoUrl, faviconUrl, hotline, email, address },
  tone: 'am-ap' | 'sang-trong' | 'toi-gian' | 'tuoi-tre' | 'pastel' | 'nong-nghiep',
  colors: { primary, primaryDark, primarySoft, onPrimary, accent, accentSoft,
            paper, paperDeep, ink, muted, hairline, discount },
  typography: { displayFont, bodyFont, displayWeight, headingTracking },
  shape: { cardRadius, buttonRadius, inputRadius, imageRadius, shadow },
  layout: {
    shellWidth, gutter, headerStyle, showTagline,
    announcement: { enabled, text, href },
    productGridColumns, productCardStyle,
    bottomNav: { enabled, items: ['home','categories','cart','account'] },
    footer: { enabled, text }
  },
  features: { affiliate, wallet, reviews, flashSale, wishlist, trackOrder,
              currency, locale, shippingFee, freeShippingThreshold, taxRate,
              affiliateCommissionRate },
  seo: { titleTemplate, description, keywords, ogImage },
  content: { hero: { enabled, eyebrow, title, subtitle, ctaLabel, ctaHref, image } }
}
```

Mọi giá trị khi đọc đều được `normalizeConfig` (clamp số, kiểm tra hex, whitelist enum),
nên dữ liệu bẩn trong DB không làm vỡ giao diện.

`features.taxRate` (%) là thuế GTGT dùng cho kế toán. Giá bán được hiểu là **đã bao gồm thuế**, nên
tổng đơn không đổi; khi đặt đơn hệ thống tách `tax_total = round(total × taxRate / (100 + taxRate))`
và lưu `tax_rate`/`tax_total` vào đơn. Đặt 0 nghĩa là không chịu thuế. Sổ nhật ký, hoá đơn và bảng kê
bán ra xem tại `/admin/accounting`.

## 7. Thêm preset mới

`utils/store-presets.ts` → thêm vào mảng `seeds`:

```ts
{
  id: 'mua-he',
  name: 'Mùa hè',
  description: '…',
  swatches: ['#0EA5A4', '#F97316', '#FFF7ED', '#1C1917'],
  tone: 'tuoi-tre',
  colors: { … },
  typography: { displayFont: 'nunito', bodyFont: 'nunito', displayWeight: 700, headingTracking: '0em' },
  shape: { cardRadius: 22, buttonRadius: 999, inputRadius: 999, imageRadius: 20, shadow: 'soft' }
}
```

Preset xuất hiện ngay trong Studio và ở API `/api/store/presets`.

## 8. Biến môi trường

```bash
NUXT_STUDIO_KEY=doi-key-nay        # fallback cho script CLI (UI dùng phiên admin)
ADMIN_EMAILS=demo@florahub.vn      # chỉ dùng khi users.role chưa được migrate
POCKETBASE_URL=http://127.0.0.1:8091
```

Cấp quyền vào Studio cho tài khoản: `npm run pb:roles -- --admin ban@x.vn` (hoặc `--staff`).

Migration tạo bảng: `pb_migrations/1792990000_created_store_configs.js`
(collection `store_configs`, đọc công khai, ghi qua server bằng admin token).

## 9. Giới hạn hiện tại

- Sản phẩm, danh mục, banner, đơn hàng… vẫn là dữ liệu dùng chung cho mọi store. Muốn tách
  dữ liệu theo store cần thêm cột `store` vào các collection và filter theo store id —
  phần giao diện/cấu hình đã sẵn sàng cho bước đó.
- Ảnh banner/hero là ảnh tĩnh nên không đổi màu theo theme; nên chuẩn bị ảnh trung tính
  hoặc upload ảnh riêng cho từng store.
- Preview trong Studio dùng CSS variables giống storefront, nhưng không phải iframe: một số
  khác biệt rất nhỏ về font rendering có thể thấy khi so trực tiếp.
