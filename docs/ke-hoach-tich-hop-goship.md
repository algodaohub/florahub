# Kế hoạch tích hợp Goship và thay phí giao hàng phẳng bằng cước realtime

Tài liệu này là bản cập nhật của kế hoạch tích hợp **Goship** (https://doc.goship.io) vào FloraHub.
Thay đổi lớn so với bản trước:

- **Bỏ phí giao hàng phẳng** (`shippingFee` / `freeShippingThreshold`) khỏi luồng đặt hàng; cước được lấy
  realtime từ Goship theo địa chỉ lấy hàng, địa chỉ giao và kiện hàng.
- **Khách chủ động chọn vận chuyển** ở bước thanh toán (hãng + dịch vụ), hoặc cửa hàng tắt quyền chọn và để
  hệ thống tự chọn theo chiến lược cấu hình.
- Bổ sung **chính sách vận chuyển theo từng cửa hàng** trong `store_configs`, tách khỏi cấu hình kỹ thuật
  dùng chung trong `shipping_settings`.
- Bổ sung **báo giá có kiểm soát phía server** (`shipping_quotes`) để chống sửa phí và xử lý hết hạn giá.
- Bổ sung phần **nghiên cứu cách sàn lớn xử lý** và **ánh xạ địa chỉ 2 cấp sau 01/07/2025** sang danh mục
  của Goship.

**Chưa có mã nguồn nào được sửa cho tới khi kế hoạch này được duyệt.** Các số dòng chỉ là điểm tham chiếu
hiện tại, sẽ thay đổi khi code.

---

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu

1. **Một nguồn cước duy nhất:** mọi đơn có hàng vật lý lấy cước từ Goship tại thời điểm checkout; không còn
   dùng `shippingFee` phẳng.
2. **Khách chọn vận chuyển:** sau khi nhập đủ địa chỉ, khách thấy danh sách hãng/dịch vụ kèm giá, thời gian
   dự kiến và tỷ lệ giao thành công; khách chọn một option trước khi đặt hàng.
3. **Cửa hàng quyết định có cho chọn hay không:** một công tắc `allowCustomerChoice` trong cấu hình cửa hàng.
   Khi tắt, hệ thống tự chọn theo `autoStrategy` (rẻ nhất / nhanh nhất / hãng ưu tiên) và chỉ hiển thị kết quả.
4. **Server là nguồn sự thật:** phí, kiện hàng, option và mã rate đều do server tính và lưu; client chỉ gửi
   `quoteId` + `optionId`, không bao giờ gửi số tiền.
5. **Vẫn đặt được hàng khi Goship lỗi:** có chính sách dự phòng (phí phẳng dự phòng hoặc chặn) do cửa hàng
   cấu hình; không để lỗi API bên thứ ba làm sập checkout.
6. **Vận hành sau đặt hàng:** admin tạo vận đơn đúng hãng khách đã chọn, nhận webhook, đồng bộ trạng thái và
   đối soát cước thực tế.
7. **Bảo mật:** token/secret chỉ lưu trong PocketBase (`shipping_settings`, rule `null`); API công khai không
   trả hoặc log secret; webhook xác thực HMAC trên raw body.

### 1.2 Ngoài phạm vi giai đoạn 1

- Đa kho / nhiều địa chỉ lấy hàng (một pickup mặc định; nhiều kho ở giai đoạn 4).
- Chia một đơn thành nhiều kiện (một đơn = một kiện ở giai đoạn 1).
- In nhãn/phiếu gửi tại FloraHub (dùng phiếu của Goship/hãng).
- Tự động đối soát COD về ngân hàng (giai đoạn 3, cần kế toán chốt).
- Giao/hoàn một phần (`is_part_delivery`) — chỉ ghi nhận cờ, xử lý tay.
- Giao hoả tốc 2 giờ (`/ondemand-shipment`) — chỉ dùng tuyến thường trong giai đoạn 1.

---

## 2. Học từ các sàn lớn

### 2.1 Cách Shopee / Lazada / GHN xử lý

| Chủ đề | Cách các sàn lớn làm | Áp dụng cho FloraHub |
| --- | --- | --- |
| Thời điểm báo phí | Phí vận chuyển chỉ hiện sau khi có đủ địa chỉ giao (tỉnh/quận/phường) | Báo giá sau khi chọn tỉnh + phường/xã + số nhà; trước đó hiển thị "Tính khi thanh toán" |
| Quyền chọn | Người mua chọn phương thức (Nhanh / Tiết kiệm / Hoả tốc) kèm giá và thời gian dự kiến; sàn đặt mặc định một phương thức đề xuất | `allowCustomerChoice = true`: khách chọn hãng/dịch vụ; `false`: shop tự chọn |
| Cách tính cước | Theo tuyến lấy–giao, cân nặng thực và **cân nặng quy đổi** `D×R×C / 6000`; lấy giá trị lớn hơn | Gửi cả `weight` và `width/height/length`; để Goship quy đổi, đồng thời tính trước để hiển thị |
| Khai giá | Giá trị hàng dùng cho bảo hiểm/đền bù; một số hãng miễn phí khai giá dưới 1 triệu | `parcel.amount` = giá trị hàng sau giảm giá; cấu hình ngưỡng khai giá |
| Freeship | Ngưỡng miễn phí giao hàng áp lên **phí giao**, không phải giá hàng; shop vẫn trả hãng | Giữ `freeShippingThreshold` trong chính sách cửa hàng; khách trả 0, shop trả hãng |
| COD | Phí thu hộ có thể phụ thuộc số tiền COD; COD gồm tiền hàng + phí giao khách trả | `cod = merchandise + shipping khách trả`; gọi lại báo giá một lần nếu hãng tính phí COD |
| Khu vực không phục vụ | Báo "Không hỗ trợ giao hàng" thay vì tự ý thu phí | Trả `serviceable=false` + thông điệp; tuỳ chính sách cửa hàng chặn hoặc dùng phí dự phòng |
| Thay đổi sau báo giá | Đổi địa chỉ/phương thức/giỏ thì báo lại giá; giá có thời hạn | Quote có TTL, gắn hash giỏ hàng/địa chỉ; đổi bất kỳ thứ gì thì quote cũ bị vô hiệu |

Nguồn tham khảo chính:

- Shopee — [Chính sách vận chuyển](https://help.shopee.vn/4/article/77250-CH%C3%8DNH-S%C3%81CH-V%E1%BA%ACN-CHUY%E1%BB%82N-SHOPEE)
- Shopee — [Các phương thức vận chuyển](https://help.shopee.vn/4/article/79534-%5BV%E1%BA%ADn-chuy%E1%BB%83n%5D-Shopee-%C4%91ang-h%E1%BB%97-tr%E1%BB%A3-nh%E1%BB%AFng-ph%C6%B0%C6%A1ng-th%E1%BB%A9c-v%E1%BA%ADn-chuy%E1%BB%83n-n%C3%A0o)
- Lazada Seller Center — [Kích thước, cân nặng và cân nặng quy đổi](https://sellercenter.lazada.vn/helpcenter/s/faq/knowledge?categoryId=1000028670&m_station=faq&questionId=1000149572)
- GHN — [Cách tính phí vận chuyển Shopee](https://ghn.vn/blogs/tip-ban-hang/phi-van-chuyen-shopee)
- GHN — [Hỗ trợ địa chỉ 2 cấp từ 01/07/2025](https://ghn.vn/blogs/tin-tuc-ghn/giaohangnhanh-huong-dan-khach-hang-tao-don-hang-khi-ap-dung-don-vi-hanh-chinh-moi-vao-dia-chi-lay-giao-tra)

### 2.2 Nguyên tắc FloraHub chọn

1. **Không báo giá khi thiếu địa chỉ.** Trước đó chỉ hiển thị "Phí giao hàng tính ở bước thanh toán".
2. **Luôn có một option được chọn sẵn.** Mặc định theo `autoStrategy`; khách chỉ cần bấm đặt hàng nếu đồng ý.
3. **Không giấu phí.** Hiển thị giá trước và sau freeship, thời gian dự kiến, tỷ lệ giao thành công (nếu bật).
4. **Không tin client.** Mọi con số tính lại ở server từ giỏ hàng PocketBase và quote đã lưu.
5. **Không chặn bán hàng vì API lỗi** (trừ khi cửa hàng chọn chặn): dùng phí dự phòng và ghi chú rõ.
6. **Không hứa quá mức:** ghi "phí tạm tính, có thể thay đổi nếu kiện hàng thực tế khác" khi cần.

---

## 3. Tổng quan API Goship

### 3.1 Môi trường và xác thực

| Môi trường | API | Shop |
| --- | --- | --- |
| Sandbox | `https://sandbox.goship.io/api/v2` | `https://dev-shop.goship.io` |
| Production | `https://api.goship.io/api/v2` | `https://shop.goship.io` |

- Mọi request: `Authorization: Bearer <access_token>`. Token lấy từ dashboard Goship (hiệu lực dài hạn);
  `POST /login` (`username`, `password`, `client_id`, `client_secret`) chỉ là phương án dự phòng.
- Giới hạn **300 request/phút**, vượt trả **429**. Mọi call đi qua một hàng đợi tuần tự có throttle như
  `server/utils/sepay-api.ts` (350 ms/lần, retry 429 một lần, timeout 10 giây).
- Lỗi validation trả **422** kèm `data.errors` theo từng field; cần map sang tiếng Việt.

### 3.2 Endpoint dùng trong kế hoạch

| Method | Endpoint | Dùng để |
| --- | --- | --- |
| POST | `/rates` | Báo giá theo tuyến + kiện hàng (**bắt buộc trước khi tạo vận đơn**) |
| POST | `/shipments` | Tạo vận đơn (bất đồng bộ, luôn HTTP 200, kết quả thật qua webhook) |
| GET | `/shipments` | Danh sách vận đơn (phân trang `page`, `size`) |
| GET | `/shipments/search?code=` | Tra theo `id`, `order_id` hoặc `carrier_code` — dùng cho nút Đồng bộ |
| DELETE | `/shipments/{id}` | Huỷ vận đơn (không hỗ trợ sửa — huỷ rồi tạo lại) |
| GET / POST | `/webhooks` | Liệt kê / đăng ký webhook |
| DELETE | `/webhooks/{id}` | Xoá webhook |
| GET | `/cities` | Danh mục tỉnh/thành của Goship |
| GET | `/districts?city_id=` | Danh mục quận/huyện theo tỉnh |
| GET | `/districts/{code}/wards` | Danh mục phường/xã theo quận |
| GET | `/carriers` | Danh sách hãng (dùng cho cấu hình allowed/blocked) |

### 3.3 `/rates`

Request (rút gọn):

```json
{
  "shipment": {
    "address_from": { "district": "100100", "city": "100000" },
    "address_to": { "district": "100300", "city": "100000" },
    "parcel": { "cod": 500000, "amount": 500000, "width": 20, "height": 15, "length": 30, "weight": 800 }
  }
}
```

- `district`, `city` là **mã** lấy từ API City/District, không phải tên.
- `weight` = gram; `width/height/length` = cm.
- `cod` ảnh hưởng cước nếu hãng có phí thu hộ; `amount` là giá trị khai giá (bảo hiểm/đền bù).
- Goship tự áp **cân nặng quy đổi** nếu lớn hơn cân nặng khai báo:
  `D×R×C / trọng số quy đổi`, thường trọng số = 6000.

Response mỗi option gồm:

| Field | Ý nghĩa |
| --- | --- |
| `id` / `rate` | Mã rate dùng khi tạo vận đơn |
| `own_account` | `0` = bảng giá Goship, `1` = hợp đồng riêng của shop |
| `carrier_name` / `carrier_short_name` / `carrier_logo` | Hãng vận chuyển |
| `service` | Nhanh / Chậm / Tiết kiệm |
| `total_fee` | Phí tạm tính (đã gồm phụ phí, COD, bảo hiểm, vùng xa…) |
| `expected` | Thời gian dự kiến dạng chuỗi |
| `report.success_percent` / `return_percent` / `avg_time_delivery_format` | Hiệu suất hãng (chỉ có với `own_account = 0`) |
| `cod_fee` / `insurance_fee` / `remote_area_fee` / `return_fee` | Chi tiết phụ phí |
| `total_amount_shop` | Phần shop được hoàn/hỗ trợ (thường âm) |

### 3.4 `/shipments`

```json
{
  "shipment": {
    "rate": "<id từ /rates>",
    "payer": 1,
    "order_id": "<id đơn FloraHub>",
    "is_recall": 0,
    "address_from": { "name": "…", "phone": "…", "street": "…", "ward": "108", "district": "100900", "city": "100000" },
    "address_to":   { "name": "…", "phone": "…", "street": "…", "ward": "37", "district": "100300", "city": "100000" },
    "parcel": { "cod": 350000, "amount": 350000, "weight": 800, "width": 20, "height": 15, "length": 30, "metadata": {} }
  }
}
```

- `ward`, `district`, `city` là **mã** Goship.
- `payer`: `0` khách trả phí giao, `1` shop trả.
- Tạo vận đơn **bất đồng bộ**: HTTP 200 kể cả khi thất bại; lỗi thật nằm ở `carrier_error` hoặc webhook.
- Response có `id`, `shipment_status`, `tracking_number`, `carrier`, `carrier_short_name`, `sorting_code`,
  `amount_return_shop`.

### 3.5 Webhook

- Header `x-goship-hmac-sha256` = `base64(HMAC-SHA256(raw_body, client_secret))`.
- Phải đọc **raw body** trước khi JSON parse và so sánh bằng `timingSafeEqual`.
- Payload gồm `gcode`, `code`, `order_id`, `status`, `status_text`, `tracking_url`, `fee`, `cod`, `payer`,
  `is_return`, `is_part_delivery`, `is_lost`, `carrier_short_name`, `amount_return_shop`, `update_time`,
  `message`.
- Trả 200 khi đã ghi nhận; Goship retry sau 3 phút, bỏ sau 3 lần thất bại.

### 3.6 Mã trạng thái

| Mã | Ý nghĩa | Ảnh hưởng đơn FloraHub |
| --- | --- | --- |
| 900 | Đơn mới | Không đổi |
| 901 | Chờ lấy hàng | Không đổi |
| 903 / 904 | Đang giao / Đã lấy hàng | `confirmed → shipping` |
| 905 | Giao thành công | Chỉ `shipping → completed` khi thanh toán đã `paid` |
| 906 | Giao thất bại | Không đổi, gắn cảnh báo |
| 907 / 908 | Chuyển hoàn | Không tự huỷ, gắn cờ hoàn hàng |
| 913 | Hoàn thành | Như 905 |
| 914 | Đơn huỷ | Chỉ `cancelled` khi máy trạng thái cho phép |
| 1000 | Đơn lỗi | Gắn cảnh báo, cần admin xử lý |

---

## 4. Luồng nghiệp vụ

### 4.1 Checkout: báo giá và khách chọn vận chuyển

<Mermaid title="Báo giá và chọn vận chuyển ở checkout">
sequenceDiagram
  participant C as Khách
  participant F as FloraHub (Nuxt/Nitro)
  participant P as PocketBase
  participant G as Goship API

  C->>F: Nhập địa chỉ (tỉnh + phường/xã + số nhà)
  F->>P: Đọc giỏ hàng, sản phẩm, cân nặng, chính sách cửa hàng
  F->>F: Tính kiện hàng (chỉ hàng vật lý) + giá trị khai giá
  alt Địa chỉ 2 cấp cần ánh xạ
    F->>F: Resolve sang mã city/district/ward của Goship
  end
  F->>G: POST /rates (mã địa chỉ + parcel)
  G-->>F: Danh sách rate (hãng, dịch vụ, phí, ETA, report)
  F->>F: Lọc theo allowed/blocked carriers, áp markup, freeship
  F->>P: Lưu shipping_quotes (options snapshot, TTL, cart hash)
  F-->>C: quoteId + options (optionId, phí khách trả, ETA)
  C->>F: Chọn 1 option
  C->>F: POST /api/orders (quoteId + optionId + địa chỉ)
  F->>P: Xác thực quote, tính lại tổng, tạo đơn
  F-->>C: orderId + tổng tiền cuối cùng
</Mermaid>

### 4.2 Vận hành: tạo vận đơn và webhook

<Mermaid title="Tạo vận đơn và đồng bộ trạng thái">
sequenceDiagram
  participant A as Admin
  participant F as FloraHub
  participant G as Goship API
  participant H as Hãng vận chuyển

  A->>F: Mở đơn, bấm "Tạo vận đơn"
  F->>F: Kiểm tra trạng thái đơn, quote/rate còn hiệu lực
  alt Rate hết hạn
    F->>G: POST /rates lại
    G-->>F: Rate mới
    F-->>A: Chênh lệch phí, xác nhận (shop chịu hoặc liên hệ khách)
  end
  F->>G: POST /shipments (rate, payer=1, cod)
  G-->>F: 200 { id, tracking_number, carrier_error }
  F->>F: Lưu shipping_* + shipment_events
  F-->>A: Mã vận đơn + link tracking

  H->>G: Cập nhật trạng thái
  G->>F: POST /api/webhooks/goship (HMAC)
  F->>F: Verify HMAC, dedupe, ghi event, cập nhật shipping_*
  F->>F: Map trạng thái → orders.status (nếu auto_advance)
  F-->>G: 200
  F-->>A: Realtime cập nhật thẻ Vận chuyển
</Mermaid>

---

## 5. Kiến trúc trong FloraHub

```
Goship API
   ▲
   │ server/utils/goship.ts (HTTP client duy nhất: token, queue, retry, normalize)
   │
   ├── server/utils/shipping-settings.ts      (credential/pickup/parcel dùng chung, cache 30s)
   ├── server/utils/shipping-policy.ts        (chính sách theo store_configs, fallback, freeship)
   ├── server/utils/shipping-quote.ts         (tính kiện, gọi rate, lưu quote, validate quote)
   └── server/utils/shipping-address.ts       (ánh xạ địa chỉ 2 cấp → mã Goship)

Route công khai
   ├── GET  /api/shipping/config
   ├── POST /api/shipping/quote
   └── GET  /api/shipping/locations (chỉ khi cần chọn quận/huyện dự phòng)

Route admin
   ├── /api/admin/shipping-settings*
   └── /api/admin/orders/[id]/shipping/*

Webhook
   └── /api/webhooks/goship.post.ts ──▶ shipment_events + orders
```

Nguyên tắc phân lớp giống thanh toán:

- **Route handler** chỉ validate input, phân quyền, gọi util; không gọi Goship trực tiếp.
- **`goship.ts`** là nơi duy nhất giữ token và gọi HTTP.
- **`shipping-policy.ts`** đọc `store_configs.config.shipping`, không đụng secret.
- **`shipping-quote.ts`** là nơi duy nhất tính phí khách trả và tạo quote; checkout và tạo đơn dùng chung.

---

## 6. Mô hình dữ liệu

### 6.1 `shipping_settings` (dùng chung, rule `null`)

Migration `pb_migrations/1794000000_created_shipping_settings.js`.

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `scope` | text unique | `"default"` |
| `enabled` | bool | Công tắc kỹ thuật toàn hệ thống |
| `goship_access_token` | text 1000 | Token dashboard |
| `goship_client_id` | text 300 | Dùng cho `/login` dự phòng |
| `goship_client_secret` | text 300 | **Cũng là khoá HMAC webhook** |
| `goship_api_base_url` | text 300 | Allowlist: `api.goship.io`, `sandbox.goship.io`, `localhost` (dev) |
| `goship_webhook_id` | text 100 | Id webhook đã đăng ký |
| `goship_webhook_url` | text 300 | URL đã đăng ký (không phải secret) |
| `pickup_name` | text 120 | |
| `pickup_phone` | text 40 | |
| `pickup_street` | text 300 | Số nhà, đường |
| `pickup_ward` / `pickup_district` / `pickup_city` | text 120 | Tên hiển thị |
| `pickup_ward_code` / `pickup_district_code` / `pickup_city_code` | text 40 | **Mã Goship**, chọn từ API City/District |
| `default_weight` | number | Gram, dùng khi không tính được từ sản phẩm |
| `default_item_weight` | number | Gram/đơn vị khi sản phẩm thiếu `weight_grams` (mặc định 500) |
| `packaging_weight` | number | Gram bao bì cộng thêm (mặc định 100) |
| `default_length` / `default_width` / `default_height` | number | cm (mặc định 30/20/15) |
| `cod_enabled` | bool | Cho phép dùng COD |
| `auto_advance` | bool | Webhook tự chuyển trạng thái theo mục 13 |
| `quote_ttl_seconds` | number | 300–1800, mặc định 600 |
| `rate_cache_seconds` | number | Cache `/rates` theo tuyến/kiện, mặc định 45 |
| `quote_rate_limit_per_minute` | number | Mặc định 20/IP |
| `address_fallback` | select | `flat` \| `ask_district` \| `block` |
| `last_verified_at` | text | Lần test kết nối thành công gần nhất |

Không còn `fee_markup_percent` ở đây — markup/freeship là chính sách của từng cửa hàng.

### 6.2 Chính sách vận chuyển theo cửa hàng — `store_configs.config.shipping`

`store_configs` đã có field JSON `config` nên **không cần migration schema**; chỉ cần default + normalize.
Thêm type `StoreShippingPolicy` vào `types/store.ts` và `StoreConfig.shipping`.

```ts
export type StoreShippingPolicy = {
  enabled: boolean                 // dùng cước động cho cửa hàng này
  allowCustomerChoice: boolean     // khách được chọn hãng/dịch vụ
  autoStrategy: 'cheapest' | 'fastest' | 'preferred'
  preferredCarrier: string         // carrier_short_name khi strategy = 'preferred'
  maxOptions: number               // 1–6, mặc định 3
  allowedCarriers: string[]        // [] = tất cả
  blockedCarriers: string[]        // ưu tiên cao hơn allowed
  markupPercent: number            // phụ phí cộng vào phí trả khách (0–100)
  freeShippingThreshold: number    // 0 = tắt; áp lên phí khách trả
  fallbackBehavior: 'flat' | 'block'
  fallbackFee: number              // dùng khi Goship lỗi/chưa cấu hình
  showEta: boolean
  showSuccessRate: boolean
  absorbFeeDifference: boolean     // shop chịu chênh lệch khi cước thực tế cao hơn
}
```

Giá trị mặc định khi migrate từ cấu hình cũ:

- `enabled = true` nếu đã cấu hình Goship, ngược lại `false`.
- `allowCustomerChoice = true`.
- `autoStrategy = 'cheapest'`, `maxOptions = 3`.
- `markupPercent = 0`.
- `freeShippingThreshold = features.freeShippingThreshold` (giữ nguyên hành vi cũ).
- `fallbackBehavior = 'flat'`, `fallbackFee = features.shippingFee`.
- `showEta = true`, `showSuccessRate = false`, `absorbFeeDifference = true`.

Sau migration, `features.shippingFee` và `features.freeShippingThreshold` **bị bỏ khỏi UI và khỏi luồng
checkout**; dữ liệu cũ trong JSON có thể còn nhưng bị bỏ qua. Script `scripts/migrate-shipping-policy.mjs`
chỉ chạy một lần để ghi `shipping` vào mọi `store_configs`.

### 6.3 `shipping_quotes` (rule `null`)

Migration `pb_migrations/1794000300_created_shipping_quotes.js`.

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `cart_id` | text 40 | Cart đã tạo quote (không dùng relation để tránh xoá theo cart) |
| `cart_hash` | text 64 | SHA-256 của item ids + quantity + unit price + subtotal + discount |
| `session_hash` | text 64 | Cookie cart/session, chống dùng quote của người khác |
| `address_from` | json | Snapshot pickup (mã + tên) |
| `address_to` | json | Mã 2 cấp + mã Goship + tên + street |
| `parcel` | json | `weight`, `width/height/length`, `cod`, `amount`, `chargeableWeight` |
| `options` | json | Mảng option đã lọc, gồm `rateId`, hãng, dịch vụ, phí gốc, phí khách trả, ETA, report |
| `free_shipping_applied` | bool | |
| `free_shipping_threshold` | number | Snapshot ngưỡng lúc báo giá |
| `selected_option_id` | text 40 | Option khách chọn (nếu có) |
| `payment_method` | text 20 | Phương thức thanh toán lúc báo giá |
| `cod_amount` | number | COD dùng khi gọi rate |
| `status` | select | `active` \| `used` \| `expired` |
| `order` | relation → `orders` | Gắn khi đơn được tạo |
| `expires_at` | text | ISO |
| `created_at` | text | ISO |

Index khuyến nghị: `(session_hash, status, expires_at)`; dọn quote hết hạn > 7 ngày định kỳ (lazy delete khi
tạo quote mới hoặc script vận hành).

**Không trả `rateId` ra client.** Client chỉ nhận `optionId` (id ngẫu nhiên do server sinh, map nội bộ trong
`options`).

### 6.4 Bổ sung field vào `orders`

Migration `pb_migrations/1794000100_added_order_shipping.js`.

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `shipping_provider` | text 30 | `"goship"` |
| `shipping_quote_id` | text 40 | |
| `shipping_option_id` | text 40 | |
| `shipping_carrier` | text 60 | `carrier_short_name` |
| `shipping_carrier_name` | text 120 | |
| `shipping_service` | text 60 | Nhanh / Chậm / Tiết kiệm |
| `shipping_rate_id` | text 120 | Rate id (server-only; không trả public) |
| `shipping_shipment_id` | text 120 | Id vận đơn Goship |
| `shipping_code` | text 60 | `gcode`/`code` để tra cứu |
| `shipping_tracking_number` | text 120 | |
| `shipping_tracking_url` | text 400 | |
| `shipping_status_code` | number | 900–1000 |
| `shipping_status_text` | text 200 | |
| `shipping_fee_quoted` | number | Cước hãng báo lúc checkout (trước markup/freeship) |
| `shipping_fee_actual` | number | Cước thực tế từ vận đơn/webhook |
| `shipping_cod` | number | Tiền thu hộ gửi hãng |
| `shipping_payer` | number | `1` = shop trả hãng (mặc định) |
| `shipping_selected_manually` | bool | Khách tự chọn hay hệ thống tự chọn |
| `shipping_chargeable_weight` | number | Gram, để đối soát |
| `shipping_province_code` / `shipping_ward_code` | text 20 | Mã 2 cấp của FloraHub |
| `shipping_city_name` / `shipping_district_name` / `shipping_ward_name` | text 120 | Tên để tạo lại vận đơn |
| `shipping_city_code` / `shipping_district_code` / `shipping_ward_code_goship` | text 40 | Mã Goship đã resolve |
| `shipping_created_at` / `shipping_updated_at` | text | ISO |
| `shipping_returning` | bool | Cờ chuyển hoàn (907/908) |

`shipping_total` (đã có trong `orders`) tiếp tục là **số tiền khách trả cho vận chuyển** (sau markup và
freeship). `shipping_fee_quoted` là cước hãng; chênh lệch = markup hoặc phần shop chịu khi freeship.

Giữ `shipping_address` dạng text tự do (địa chỉ đầy đủ để in/đối chiếu), nhưng **phí luôn tính từ mã**, không
parse text.

### 6.5 `shipment_events` (rule `null`)

Migration `pb_migrations/1794000200_created_shipment_events.js` — nhật ký webhook, chống trùng.

| Field | Kiểu |
| --- | --- |
| `order` | relation → `orders` (cascade delete) |
| `provider` | text 30 (`goship`) |
| `code` | text 60 (`gcode`) |
| `status_code` | number |
| `status_text` | text 200 |
| `message` | text 500 |
| `event_time` | text (ISO từ `update_time`) |
| `raw` | json |
| `created` / `updated` | system |

Index khuyến nghị: `(order, code, status_code, event_time)`.

### 6.6 `ward_downgrade_rules` (ghi ngược địa chỉ, rule `null`)

Giao diện khách dùng danh mục **2 cấp mới** (`server/assets/vn-locations.json`: 34 tỉnh, 3.321 phường/xã sau
01/07/2025), còn Goship nhận **3 cấp cũ** (63 tỉnh, 713 quận/huyện, 11.623 phường/xã). Collection lưu luật
**hạ cấp**: một phường mới → một hoặc nhiều đích cũ, mỗi dòng chứa **cả** mã hành chính cũ (79/769/26815)
**và** mã Goship hợp lệ (700000/720300/12659). Vận chuyển chỉ dùng mã `goship_*`.

Schema nằm trong `scripts/lib/location-collections.mjs`
(`wardDowngradeRulesCollection(provinceCollectionId, wardCollectionId)`); collection do script quản lý như
`provinces`/`wards` — tạo/upsert bằng `npm run pb:rules`, không khai báo lại trong migration. Script resolve
ID tỉnh/phường theo `code` để backfill relation, nên chạy `pb:locations` trước `pb:rules`. Migration
`1795000000_updated_ward_downgrade_rules.js` chỉ thêm field cho database mới.

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `new_province`, `new_ward` | relation | Trỏ `provinces`/`wards` (PB record id); giữ `new_*_code` để resolver lọc trực tiếp |
| `new_province_code`, `new_province_name` | text, required | Tỉnh mới, vd `56` / `Tỉnh Khánh Hòa` |
| `new_ward_code`, `new_ward_name` | text, required | Phường mới, vd `22366` / `Phường Nha Trang` |
| `old_province_code`, `old_province_name` | text | Mã hành chính cũ, vd `79` / `Thành phố Hồ Chí Minh` |
| `old_district_code`, `old_district_name` | text | Vd `769` / `Thành phố Thủ Đức` |
| `old_ward_code`, `old_ward_name` | text | Vd `26815` / `Phường Linh Chiểu` |
| `goship_city_code`, `goship_city_name` | text, required | Vd `700000` / `Hồ Chí Minh` |
| `goship_district_code`, `goship_district_name` | text, required | Vd `720300` / `Thành phố Thủ Đức` |
| `goship_ward_code`, `goship_ward_name` | text, required | Vd `12659` / `Phường Linh Chiểu` |
| `is_primary` | bool | Đúng 1 dòng / phường mới — tự chọn khi có nhiều đích |
| `active` | bool | Bật/tắt luật |
| `source` | text | `legacy-api` \| `manual` |
| `note` | text | Ghi chú override / fallback tên phường |
| `synced_at` | text | ISO lần sinh gần nhất |

Index thường trên `new_ward_code`; unique trên `(new_ward_code, goship_ward_code)`.

Ví dụ thật: phường mới `26824` (Phường Thủ Đức, TP.HCM) hạ cấp về 5 phường cũ trong `720300`:

| new_ward | old (admin) | Goship |
| --- | --- | --- |
| 26824 Phường Thủ Đức | 79/769/26815 Linh Chiểu | 700000/720300/12659 (primary) |
| 26824 Phường Thủ Đức | 79/769/26818 Linh Tây | 700000/720300/12660 |
| 26824 Phường Thủ Đức | 79/769/26821 Linh Đông | 700000/720300/12661 |
| 26824 Phường Thủ Đức | 79/769/26824 Bình Thọ | 700000/720300/12668 |
| 26824 Phường Thủ Đức | 79/769/26827 Trường Thọ | 700000/720300/12640 |

Goship **không có** Quận 2/Quận 9/Quận Thủ Đức (danh mục đã qua 2020), nên luật lưu cả mã hành chính cũ để
đối soát và mã Goship để tính phí/tạo vận đơn.

Collection cache `shipping_locations` cũ đã xoá bằng `pb_migrations/1794100000_dropped_shipping_locations.js`
(chỉ là cache; runtime đọc snapshot + `ward_downgrade_rules`). Public route `GET /api/shipping/locations` vẫn
trả `{ type, items, meta }` từ snapshot cho form địa chỉ lấy hàng của admin và lựa chọn quận dự phòng.

### 6.7 Mã địa chỉ trên `addresses`

Migration `pb_migrations/1794000500_added_address_codes.js` (tuỳ chọn, có thể để trống và backfill).

- Thêm `city_code` (text 20), `ward_code` (text 20) vào `addresses`.
- Backfill bằng cách match `city`/`ward` với `server/assets/vn-locations.json`; địa chỉ không match được đánh
  dấu để người dùng chọn lại.
- Cập nhật type `Address` (`types/index.ts:235`) và API tài khoản địa chỉ.
- `AddressRegionFields.vue` phát thêm `update:cityCode` / `update:wardCode` (hiện chỉ phát tên, dòng 15-18,
  119-120, 136-140).

Không có mã địa chỉ thì không thể báo giá chính xác; đây là điều kiện bắt buộc của luồng mới.

---

## 7. Địa chỉ 2 cấp của FloraHub và danh mục 3 cấp của Goship

### 7.1 Vấn đề

- FloraHub thu **tỉnh/thành + phường/xã/đặc khu** (2 cấp, sau 01/07/2025), lưu trong
  `server/assets/vn-locations.json` (34 tỉnh, 3321 phường/xã), **không có quận/huyện**.
- Goship `/rates` bắt buộc `district` + `city`; `/shipments` bắt buộc `ward` + `district` + `city` — đều là
  **mã riêng của Goship** (ví dụ city `100000`, district `100300`, ward `37`).
- GHN (một hãng trên Goship) đã hỗ trợ địa chỉ 2 cấp từ 01/07/2025, nhưng danh mục của Goship có thể vẫn là
  3 cấp cũ. Phải kiểm chứng bằng sandbox trước khi code.

### 7.2 Phase 0 — spike quyết định

1. Gọi `/cities`, `/districts?city_id=`, `/districts/{code}/wards` trên sandbox.
2. So sánh tên tỉnh/phường với `vn-locations.json`:
   - Có tên phường/xã mới (sau sáp nhập) không?
   - Mã tỉnh có khớp mã 2 cấp không?
   - District có còn tồn tại hay đã gộp?
3. Kết luận một trong ba hướng:

| Kết quả | Hướng xử lý |
| --- | --- |
| **A. Goship đã có danh mục mới** | Match trực tiếp theo tên trong cùng tỉnh; lấy `city_code`, `ward_code`; suy ra `district_code` từ bản ghi ward (nếu API trả) |
| **B. Goship vẫn 3 cấp cũ** | Build `server/assets/goship-address-map.json`: mã phường mới → danh sách phường cũ → quận cũ; nếu tất cả phường cũ cùng một quận thì resolve tự động; nếu nhiều quận thì trả `districtOptions` để khách chọn |
| **C. Không thể ánh xạ** | Trả `addressResolution = 'unresolved'`; áp `address_fallback` (`flat` → phí dự phòng + shop xác nhận; `ask_district` → khách chọn quận/huyện từ danh mục Goship; `block` → báo chưa hỗ trợ) |

### 7.3 Định dạng mapping (hướng B)

```json
{
  "province": {
    "79": { "goshipCityCode": "100000", "name": "TP. Hồ Chí Minh" }
  },
  "wards": {
    "26734": {
      "goshipCityCode": "100000",
      "districtOptions": [
        { "code": "100300", "name": "Quận 1", "wardCode": "37" }
      ],
      "status": "resolved"
    },
    "26735": {
      "goshipCityCode": "100000",
      "districtOptions": [
        { "code": "100300", "name": "Quận 1", "wardCode": "38" },
        { "code": "100700", "name": "Quận 3", "wardCode": "42" }
      ],
      "status": "ambiguous"
    }
  }
}
```

- File sinh một lần bằng script từ dữ liệu sáp nhập 2025 + danh mục cũ; **không sinh lúc runtime**.
- `status: resolved` → tự động; `ambiguous` → khách chọn 1 trong `districtOptions` (UI nhỏ ngay dưới địa chỉ);
  `unresolved` → theo `address_fallback`.
- Lưu cả mã 2 cấp và mã Goship đã resolve vào quote/order để không phải resolve lại khi tạo vận đơn.
- Hiện trạng triển khai (10/2026): dùng bảng `ward_downgrade_rules` (§6.6) thay cho so khớp tên. Script
  `npm run rules:sync` sinh toàn quốc từ `provinces.open-api.vn/api/v2/w/{code}/to-legacies/` + tên quận cũ
  (`/api/v1/?depth=2`), khớp với snapshot Goship; `npm run pb:rules` nạp lên PocketBase. `resolveCustomerAddress`
  chỉ tra phường mới theo mã (hoặc tên chuẩn hoá khớp chính xác) rồi hạ cấp — không còn `sameName`/so chuỗi con.

### 7.4 Địa chỉ lấy hàng của admin

Admin chọn trực tiếp từ danh mục Goship (`/cities` → `/districts` → `/wards`) trong tab "Lấy hàng & đóng gói".
Không cần ánh xạ cho đầu gửi; lưu đủ mã vào `shipping_settings`.

### 7.5 UI khi địa chỉ mơ hồ

- Nếu `ambiguous`: hiển thị select "Quận/huyện giao hàng (theo hãng vận chuyển)" với 2–3 lựa chọn; bắt buộc
  chọn trước khi báo giá.
- Nếu `unresolved` và `address_fallback = 'flat'`: vẫn cho đặt với phí dự phòng, ghi rõ "Phí giao tạm tính,
  shop sẽ xác nhận lại".
- Không hiển thị chi tiết mapping cho khách; chỉ tên quận/huyện.

---

## 8. Tính kiện hàng và giá

### 8.1 Kiện hàng

Chỉ tính **hàng vật lý**:

- `product.type = 'physical'` và `requires_shipping !== false`.
- Sản phẩm số/dịch vụ bị loại khỏi kiện.
- Giỏ chỉ có hàng số/dịch vụ → **bỏ bước vận chuyển**, phí = 0, đơn ghi "Không cần giao hàng".
- Giỏ hỗn hợp → chỉ tính phần vật lý; hiển thị ghi chú "Phí giao chỉ áp dụng cho N sản phẩm vật lý".

Cân nặng:

```
actualWeight = Σ max(product.weight_grams, default_item_weight) × quantity
             + packaging_weight
```

- Sản phẩm hiện có `weight_grams` (0–1.000.000, mặc định 0) từ migration `1793300000_updated_product_model.js`.
- Nếu `weight_grams = 0` → dùng `default_item_weight` (500 g) và ghi cảnh báo cho admin trong chi tiết đơn.
- Kích thước giai đoạn 1: dùng `default_length/width/height` của `shipping_settings` (sản phẩm chưa có
  dimensions). Giai đoạn 4 mới thêm dimensions theo sản phẩm/kiện.

Cân nặng quy đổi để hiển thị và đối soát:

```
volumetricWeight = (length × width × height) / 6000  (gram)
chargeableWeight = max(actualWeight, volumetricWeight)
```

Vẫn gửi cả `weight` thực và `width/height/length` cho Goship; Goship tự quyết định theo quy định từng hãng.

### 8.2 Giá trị khai giá và COD

- `amount` (khai giá) = `subtotal − discount` (giá trị hàng, không gồm phí giao).
- Cấu hình ngưỡng khai giá toàn phần: mặc định khai đủ dưới 1.000.000đ; trên ngưỡng có thể khai một phần
  (giai đoạn 4). Giai đoạn 1 khai đủ để được bồi thường.
- `cod`:
  - Nếu phương thức thanh toán không phải COD → `0`.
  - Nếu COD → `subtotal − discount + phí khách trả`.
  - Vì `cod` có thể làm tăng cước, sau khi khách chọn option ở chế độ COD, server gọi lại `/rates` **một lần**
    với `cod` cuối cùng; nếu phí đổi > 1.000đ thì trả quote mới và yêu cầu khách xác nhận lại.
- COD không áp dụng cho đơn chỉ có hàng số/dịch vụ.

### 8.3 Phí khách trả

```
carrierFee   = option.total_fee
markedUpFee  = round(carrierFee × (1 + markupPercent / 100))
netMerch     = subtotal − discount
freeShip     = freeShippingThreshold > 0 && netMerch >= freeShippingThreshold
customerFee  = freeShip ? 0 : markedUpFee
shippingTotal = customerFee
```

- Ngưỡng freeship tính trên **giá trị hàng sau giảm giá**, trước phí giao (giống phần lớn sàn).
- Khi freeship: khách trả 0, shop vẫn trả hãng (`payer = 1`); phần chênh vào chi phí bán hàng.
- `shipping_total` lưu `customerFee`; `shipping_fee_quoted` lưu `carrierFee`.
- Không làm tròn lên bậc nghìn ở server; hiển thị dùng `formatVnd`.

### 8.4 Ai trả phí cho hãng

Giai đoạn 1 **luôn dùng `payer = 1` (shop trả hãng)** cho mọi đơn:

- Khách trả phí ship cho shop qua tổng đơn (prepaid hoặc COD).
- Shop thanh toán cước cho hãng theo bảng giá/đối soát.
- COD thu hộ = tiền hàng + phí ship khách trả; hãng chuyển lại toàn bộ COD.
- Cách này giữ dòng tiền và kế toán rõ ràng, tránh trường hợp hãng thu phí ship trực tiếp từ khách nhưng
  shop vẫn ghi nhận doanh thu ship.

Cho phép `payer = 0` là tuỳ chọn giai đoạn 4 nếu shop muốn hãng thu phí ship trực tiếp.

### 8.5 Dự phòng khi Goship không dùng được

Điều kiện: `shipping_settings.enabled = false`, thiếu token, cửa hàng tắt `shipping.enabled`, Goship 429/5xx
quá số lần, hoặc địa chỉ `unresolved`.

| `fallbackBehavior` | Hành vi |
| --- | --- |
| `flat` (khuyến nghị) | Dùng `fallbackFee`; nếu `0` thì miễn phí; hiển thị "Phí giao tạm tính, shop xác nhận khi giao" |
| `block` | Không cho đặt hàng; báo "Hiện chưa thể tính phí giao đến khu vực này, vui lòng liên hệ shop" |

- Quote dự phòng vẫn được lưu (`options: [{ source: 'fallback' }]`) để đơn có dấu vết.
- Không tự ý dùng phí của hãng khác hoặc phí cũ đã cache quá hạn.

---

## 9. Checkout mới

### 9.1 Bố cục

Trang `pages/checkout.vue` hiện là một trang (đơn hàng → địa chỉ → ghi chú → tổng kết). Thêm **khối Vận
chuyển** ngay sau phần địa chỉ và trước ghi chú/thanh toán:

1. **Đơn hàng của bạn** (giữ nguyên).
2. **Thông tin nhận hàng** (giữ nguyên; bổ sung mã tỉnh/phường).
3. **Phương thức vận chuyển** (mới):
   - Chưa đủ địa chỉ: "Nhập địa chỉ để xem phí giao hàng".
   - Đang lấy giá: skeleton 2–3 dòng, không chặn nhập liệu.
   - Có giá + `allowCustomerChoice = true`: danh sách radio card.
   - Có giá + `allowCustomerChoice = false`: một card "Shop chọn hãng giao tối ưu" kèm hãng/dịch vụ/giá.
   - Không phục vụ / lỗi: thông điệp + nút "Thử lại" + (nếu `flat`) phí dự phòng.
4. **Mã giảm giá** (giữ nguyên).
5. **Ghi chú** (giữ nguyên).
6. **Tóm tắt thanh toán**: tạm tính, giảm giá, phí giao, tổng; sticky bar mobile cập nhật theo option.

### 9.2 Card vận chuyển

Mỗi option hiển thị:

- Tên hãng + `service` (ví dụ "Giao Hàng Nhanh · Nhanh").
- Giá khách trả (hoặc "Miễn phí" nếu freeship) + giá gốc gạch ngang khi có markup/freeship.
- ETA từ `expected` (nếu `showEta`).
- Tỷ lệ giao thành công từ `report.success_percent` (nếu `showSuccessRate`; chỉ có với `own_account = 0`).
- Badge: **Rẻ nhất**, **Nhanh nhất**, **Shop đề xuất**.
- Ghi chú "Đã gồm phí thu hộ" khi COD.

Sắp xếp mặc định: option theo `autoStrategy` lên đầu, sau đó giá tăng dần; chỉ hiển thị tối đa
`maxOptions`, có nút "Xem thêm" nếu còn.

Không dùng logo remote của Goship ở giai đoạn 1 (CSP/latency); dùng monogram chữ cái hoặc badge text. Logo
chỉ thêm khi được phép và bundle nội bộ.

### 9.3 Khi nào báo lại giá

| Thay đổi | Hành động |
| --- | --- |
| Đổi tỉnh/phường/số nhà | Debounce 500 ms → gọi quote mới |
| Thêm/bớt sản phẩm, đổi số lượng | Quote mới (cart hash đổi) |
| Áp/xoá mã giảm giá | Quote mới nếu mã làm đổi ngưỡng freeship |
| Đổi phương thức thanh toán (nếu sau này có chọn) | Quote mới vì COD ảnh hưởng cước |
| Chọn option khác | Không gọi lại API; cập nhật tổng từ option đã có |
| Quote hết hạn | Tự báo lại; nếu giá đổi → hiện thông báo xác nhận |

Giữ option đã chọn nếu vẫn tồn tại trong quote mới (theo `carrier + service`); nếu không còn, chọn option
đề xuất và hiện ghi chú "Hãng đã chọn không còn khả dụng, đã chuyển sang …".

### 9.4 Trạng thái và lỗi

- `serviceable = false`: hiển thị "Chưa hỗ trợ giao đến khu vực này"; nếu `fallbackBehavior = 'flat'` vẫn cho
  đặt với phí dự phòng, ngược lại disable nút đặt hàng.
- Quote lỗi mạng: giữ tổng cũ? **Không** — hiển thị "Chưa tính được phí giao" và disable đặt hàng cho đến khi
  có quote hoặc fallback.
- Quote bị rate-limit: server trả quote dự phòng (nếu `flat`) thay vì lỗi 429 cho người dùng.
- Giỏ chỉ có hàng số: ẩn khối vận chuyển, tổng không có phí giao.

### 9.5 Submit

`pages/checkout.vue` gửi thêm:

```ts
{
  ...form,                 // name, email, phone, address (đã ghép), note
  promoCode,
  itemIds,
  shippingQuoteId: quote.id,
  shippingOptionId: selectedOptionId,
  cityCode: guestAddress.cityCode,   // hoặc selectedAddress.cityCode
  wardCode: guestAddress.wardCode,
  districtCode: districtChoice ?? null
}
```

Server không nhận `shippingFee`, `total`, `weight` từ client.

Nếu server trả `409` với `code = SHIPPING_QUOTE_EXPIRED | SHIPPING_QUOTE_STALE`:

1. Gọi lại quote.
2. Nếu phí không đổi → tự động gửi lại một lần.
3. Nếu phí đổi → hiện thông báo "Phí giao đã cập nhật từ X thành Y" và yêu cầu khách bấm đặt hàng lại.

### 9.6 Khách đã đăng nhập và khách vãng lai

- **Đã đăng nhập:** địa chỉ đã lưu cần có `city_code`/`ward_code`; nếu thiếu, yêu cầu chọn lại (hiển thị
  "Địa chỉ cũ, vui lòng chọn lại phường/xã"). Sửa `AddressRegionFields` để phát mã.
- **Vãng lai:** thêm `cityCode`/`wardCode` vào `guestAddress`; ghép chuỗi địa chỉ như hiện tại
  (`line1, ward, city`).
- Quote gắn `session_hash` từ cookie `cart_id`; không cho dùng quote của session khác.

### 9.7 Các trang khác

- `server/utils/cart.ts:139-142`: bỏ tính phí phẳng; trả `shipping: null`, `shippingPending: true`,
  `shippingPolicy` (ngưỡng freeship, bật/tắt) để UI hiển thị "Tính khi thanh toán".
- Trang giỏ hàng và mini-cart: dòng phí giao hiển thị "Tính khi thanh toán"; tổng tạm tính không gồm ship.
- `pages/product/[handle].vue:82-85`: banner freeship dùng ngưỡng từ policy; ẩn nếu `enabled = false`.
- `composables/useSite.ts:28-29` và `server/utils/site.ts:53-54,92-93`: thay `shippingFee` bằng object
  `shippingPolicy` công khai (không secret).

---

## 10. Bảo mật và chống lạm dụng

### 10.1 Secret

- Token, `client_secret`, webhook secret chỉ trong `shipping_settings` (rule `null`).
- `GET /api/admin/shipping-settings` trả `{ has, hint: '••••last4' }` cho secret; field không nhạy cảm trả đầy đủ.
- Không log token/secret; log webhook chỉ `orderId`, `status`, `code`.
- `goship_api_base_url` allowlist như `allowedApiBaseUrl()` của payment settings; chỉ HTTPS trừ localhost.
- `pickup_phone`, `pickup_street` không trả qua API công khai.

### 10.2 Quote không bị sửa

- Server đọc giỏ từ PocketBase, không nhận item/giá từ client (trừ `itemIds` để lọc đúng giỏ đang thanh toán).
- `cart_hash` gồm item ids, quantity, unit price, subtotal, discount; bất kỳ thay đổi nào cũng làm quote cũ
  không hợp lệ.
- `session_hash` chống dùng quote của người khác.
- Client chỉ thấy `optionId`; `rateId` nằm server-side.
- Khi tạo đơn, server tính lại `subtotal`, `discount`, `shippingTotal` từ dữ liệu hiện tại và đối chiếu quote.
- Quote chỉ dùng một lần (`status = used`); dùng lại → 409.

### 10.3 Rate limit và cache

- `/api/shipping/quote`: tối đa 20 request/phút/IP và 10/phút/cart; vượt → trả quote dự phòng (nếu `flat`)
  hoặc 429 có thông điệp.
- Cache rate theo key `(pickup codes, destination codes, chargeable weight làm tròn 100g, amount bucket,
  cod bucket, payer)` trong `rate_cache_seconds` (45 giây) để chống bấm liên tục.
- Hàng đợi outbound dùng chung cho cả checkout và admin; ưu tiên admin (nếu cần) bằng hàng đợi riêng.
- Không cache quote chứa thông tin cá nhân quá TTL; quote là server-side, client không đọc lại.

### 10.4 Webhook

- `readRawBody` trước khi parse; HMAC `timingSafeEqual`; sai → 401.
- Nếu raw-body fail, thử lại với `JSON.stringify(parsed)` để tương thích một số mẫu Goship.
- Dedupe theo `(order, code, status_code, event_time)`; ghi `raw`.
- Không tìm thấy đơn → vẫn trả 200 để tránh retry vô ích.
- Chỉ trả 5xx khi lỗi hệ thống thật.

---

## 11. Server modules

### 11.1 `server/utils/shipping-settings.ts`

Sao chép cấu trúc `payment-settings.ts`:

- Hằng: `SHIPPING_SETTINGS_COLLECTION`, `SHIPPING_SETTINGS_SCOPE = 'default'`, base URL sandbox/production,
  `CACHE_TTL = 30_000`, `MAX_FIELD_LENGTH = 4000` cho access token.
- `readShippingSettings()` — cache + in-flight dedupe; trả default an toàn nếu chưa migrate.
- `publicShippingSettings()` — mask secret; `readiness = { api, webhook, pickup, policy }`.
- `saveShippingSettings(input)` — merge (`undefined` giữ, `''` xoá); chặn sớm field quá dài.
- `invalidateShippingSettings()`.
- `saveShippingConnectionState()` — chỉ ghi `goship_webhook_id`/`goship_webhook_url`.

### 11.2 `server/utils/shipping-policy.ts`

- `readStoreShippingPolicy(event | config)` — normalize từ `store_configs.config.shipping`, fallback từ
  `features.shippingFee`/`freeShippingThreshold` nếu chưa migrate.
- `publicShippingPolicy(policy, settings)` — chỉ field công khai:
  `{ enabled, allowCustomerChoice, freeShippingThreshold, fallbackBehavior, codEnabled, showEta, showSuccessRate }`.
- `computeCustomerFee(policy, carrierFee, netMerch)` — markup + freeship.
- `chooseOption(policy, options)` — áp `autoStrategy`, allowed/blocked, `maxOptions`.
- `resolveFallback(policy, settings)` — trả quote dự phòng hoặc lỗi chặn.

### 11.3 `server/utils/goship.ts`

```ts
const MIN_INTERVAL_MS = 350
const REQUEST_TIMEOUT_MS = 10_000
const TOKEN_TTL_MS = 5 * 60_000

async function call(path: string, options: { method?, body?, query? })
```

- Thiếu token → `503` "Chưa cấu hình Goship trong /admin/shipping".
- Hàng đợi promise + `lastRequestAt`; retry 429 một lần (đọc `Retry-After`, tối đa 5 giây).
- Map lỗi: 401/403 → token bị từ chối; 422 → message từ `data.errors` (mảng hoặc object) / `exception`, log
  đỏ server-side; còn lại → 502.
- Hàm nghiệp vụ:
  - `getRates(input)` — normalize option, bỏ field không cần, giữ `rateId` server-side.
  - `createShipment(order, rateId)`.
  - `getShipment(code)`, `cancelShipment(id)`.
  - `registerWebhook(url)`, `deleteWebhook(id)`.
  - `listCities()`, `listCarriers()`.

Không cache `/rates` lâu; cache ngắn theo key ở mục 10.3.

### 11.4 `server/utils/shipping-quote.ts`

```ts
buildParcel(cart, settings): { items, actualWeight, chargeableWeight, dims, amount, cod }
resolveAddress(input, settings): { cityCode, districtCode, wardCode, resolution, districtOptions? }
createQuote(event, { cart, itemIds, address, paymentMethod }): Quote
validateQuote(event, { quoteId, optionId, cart, itemIds, address, subtotal, discount }): Quote
```

- Chỉ tính item vật lý; trả `mode: 'none'` nếu không có.
- Áp `allowedCarriers`, `blockedCarriers`, `autoStrategy`, `maxOptions`.
- Sinh `optionId` ngẫu nhiên (ví dụ `opt_` + 12 ký tự) và lưu map trong `options`.
- Lưu quote + trả DTO cho client (không `rateId`, không pickup).
- `validateQuote` kiểm tra: tồn tại, `status=active`, chưa hết hạn, `session_hash`, `cart_hash`, option tồn tại,
  địa chỉ khớp, subtotal/discount khớp. Sai → `409` kèm `code`.
- Đánh dấu `used` ngay sau khi tạo đơn thành công.

### 11.5 `server/utils/shipping-address.ts`, `ward-downgrade.ts` và `goship-catalog.ts`

- `server/utils/goship-catalog.ts` — import tĩnh `server/assets/goship-locations.json`, dựng Map theo tỉnh/quận;
  export `catalogCities()`, `catalogDistricts(cityCode)`, `catalogWards(districtCode)`, `catalogMeta()`.
  Trả `null` khi parent chưa có trong snapshot.
- `getGoshipCities/Districts/Wards` — chỉ đọc snapshot (`Districts/Wards` trả `[]` khi `null`); không cache DB,
  không gọi Goship.
- `server/utils/ward-downgrade.ts`:
  - `rulesForWard(wardCode)` — đọc `ward_downgrade_rules` với filter `active = true && new_ward_code = …`,
    cache theo phường TTL 5 phút; lỗi PocketBase → `null` (không ném).
  - `resolveWardDowngrade({ wardCode, provinceCode?, districtCode? })` — không có luật → `null`;
    `districtCode` (khách chọn từ UI ambiguous) lọc theo `goship_district_code`, không khớp thì bỏ lọc;
    một dòng / có `is_primary` / chỉ còn một quận → `resolved`; nhiều quận chưa có primary → `ambiguous` +
    `districtOptions` (tái dùng UI chọn quận hiện có).
- `resolveCustomerAddress({ cityCode?, cityName?, wardCode?, wardName?, districtCode? })` — tìm tỉnh theo mã
  (hoặc tên chuẩn hoá khớp chính xác), phường theo mã (hoặc tên chuẩn hoá khớp chính xác — chỉ để tương thích
  địa chỉ text cũ), rồi gọi `resolveWardDowngrade`; trả `resolved | ambiguous | unresolved`.
- `validatePickup(settings)`, `pickupAddressForShipment(settings)`, `rateAddressFromPickup(settings)`.

### 11.6 `server/utils/order-shipping.ts`

Hàm dùng chung cho webhook và route admin:

- `applyShipmentToOrder(order, shipment)` — cập nhật `shipping_*`, tính chênh lệch, ghi event.
- `advanceOrderStatus(order, statusCode, settings, actor)` — áp mapping mục 13 qua helper trạng thái.
- `reconcileFee(order, actualFee)` — cập nhật `shipping_fee_actual`, cờ chênh lệch.

---

## 12. API routes

### 12.1 Công khai

| Route | Chức năng |
| --- | --- |
| `GET /api/shipping/config` | Chính sách công khai của cửa hàng (không secret, không pickup) |
| `POST /api/shipping/quote` | Tạo quote server-side; trả `quoteId`, options, trạng thái địa chỉ |
| `GET /api/shipping/locations?type=districts&city=…` | Danh mục từ snapshot; trả `{ type, items, meta }` (`cities`, `districts?city=`, `wards?district=`), dùng khi khách chọn quận/huyện dự phòng và cho form admin |
| `POST /api/webhooks/goship` | Webhook HMAC |

`POST /api/shipping/quote` request:

```json
{
  "cityCode": "79",
  "wardCode": "26734",
  "districtCode": null,
  "street": "12 Nguyễn Huệ",
  "itemIds": ["ci_…"],
  "paymentMethod": "cod"
}
```

Response:

```json
{
  "quoteId": "sq_9f3…",
  "expiresAt": "2026-10-28T09:15:00.000Z",
  "mode": "live",
  "serviceable": true,
  "requiresChoice": true,
  "selectedOptionId": "opt_a1b2c3",
  "address": {
    "resolution": "resolved",
    "city": "TP. Hồ Chí Minh",
    "district": "Quận 1",
    "ward": "Phường Sài Gòn",
    "districtOptions": []
  },
  "parcel": { "actualWeight": 800, "chargeableWeight": 800, "length": 30, "width": 20, "height": 15 },
  "freeShipping": { "applied": false, "threshold": 500000, "remaining": 120000 },
  "options": [
    {
      "id": "opt_a1b2c3",
      "carrier": "ghn",
      "carrierName": "Giao Hàng Nhanh",
      "service": "Nhanh",
      "fee": 32000,
      "feeOriginal": 32000,
      "customerFee": 32000,
      "eta": "Dự kiến giao 2 ngày",
      "successRate": 97.2,
      "badges": ["cheapest", "recommended"],
      "ownAccount": false,
      "codFee": 0
    }
  ],
  "fallback": null
}
```

Khi dự phòng:

```json
{
  "quoteId": "sq_…",
  "mode": "fallback",
  "serviceable": false,
  "requiresChoice": false,
  "selectedOptionId": "opt_fallback",
  "options": [
    { "id": "opt_fallback", "carrier": "shop", "carrierName": "Shop tự sắp xếp", "service": "Tiêu chuẩn", "fee": 30000, "customerFee": 30000, "eta": "", "badges": ["fallback"] }
  ]
}
```

### 12.2 Admin

| Route | Quyền | Chức năng |
| --- | --- | --- |
| `GET /api/admin/shipping-settings` | `requireAdmin` | Cấu hình mask + readiness + policy |
| `PUT /api/admin/shipping-settings` | `requireAdminMutation({ adminOnly: true })` | Lưu cấu hình kỹ thuật |
| `PUT /api/admin/shipping-settings/policy` | adminOnly | Lưu chính sách cửa hàng vào `store_configs` |
| `POST /api/admin/shipping-settings/test` | adminOnly | Gọi `/cities` hoặc `/webhooks` để xác nhận token |
| `POST /api/admin/shipping-settings/register-webhook` | adminOnly | Đăng ký `https://<domain>/api/webhooks/goship` |
| `GET /api/admin/shipping-settings/carriers` | adminOnly | Danh sách hãng từ Goship |
| `POST /api/admin/orders/[id]/shipping/quote` | adminOnly | Báo giá lại cho đơn (khi rate hết hạn) |
| `POST /api/admin/orders/[id]/shipping` | adminOnly | Tạo vận đơn với `rateId`/quote đã chọn |
| `POST /api/admin/orders/[id]/shipping/sync` | adminOnly | Tra `GET /shipments/search?code=` và cập nhật |
| `POST /api/admin/orders/[id]/shipping/cancel` | adminOnly | Huỷ vận đơn; không đổi `payment_status` |

Response admin không bao giờ trả token/secret hay `rateId` cho UI không cần thiết.

### 12.3 Webhook `server/api/webhooks/goship.post.ts`

1. `readRawBody(event, 'utf8')` → rỗng trả 400.
2. Verify HMAC; sai → 401.
3. Parse; tìm đơn theo `order_id`; không thấy → trả `{ success: true }`.
4. Dedupe; ghi `shipment_events`.
5. Cập nhật `orders.shipping_*` qua `applyShipmentToOrder`.
6. Nếu `auto_advance` → mapping mục 13.
7. Trả `{ success: true }`; chỉ 5xx khi lỗi hệ thống.

---

## 13. Mapping trạng thái — tôn trọng máy trạng thái hiện có

`utils/order-state.ts` chỉ cho `pending → confirmed → shipping → completed` và nhánh `cancelled`. Webhook không
được nhảy cóc.

| Goship | Điều kiện | Hành động |
| --- | --- | --- |
| 903 / 904 | `status = confirmed` | `status = shipping`, ghi `shipping_updated_at` |
| 905 / 913 | `status = shipping` **và** `payment_status = paid` | `status = completed` |
| 905 / 913 | `payment_status ∈ {pending, cod}` | Chỉ ghi `shipping_status_*` + cảnh báo "Hãng báo đã giao, chưa xác nhận thanh toán" |
| 906 | — | Chỉ ghi event + `shipping_status_text`, không đổi đơn |
| 907 / 908 | — | `shipping_returning = true`, cảnh báo; không tự `cancelled`, không đụng `payment_status` |
| 914 | `canCancelOrder(status)` và `payment_status ≠ paid` | `status = cancelled`, `cancelled_at`; nếu `paid` chỉ ghi event + cảnh báo |
| 1000 | — | Ghi event, cảnh báo trên thẻ Vận chuyển |

**COD:** khi 905/913 và `payment_method = cod` và `payment_status ∈ {cod, pending}`:

- Giai đoạn 2: nếu `shipping_cod > 0` và carrier báo đã thu → gợi ý admin xác nhận thu tiền; không tự đặt
  `paid` ở giai đoạn 1.
- Giai đoạn 3: có thể tự `cod → paid` theo cấu hình, kèm `paid_at`; sau đó mới `completed`.
- Tuyệt đối không đưa `paid → pending`; hoàn tiền vẫn qua chức năng Hoàn tiền hiện có.
- Mọi thay đổi trạng thái đi qua `canSetOrderStatus`/`canSetPaymentStatus` trong
  `server/api/admin/orders/[id].patch.ts`.

---

## 14. Giao diện admin

### 14.1 `/admin/shipping`

- `pages/admin/shipping.vue` — 6 dòng, giống `pages/admin/payments.vue`:
  `definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Vận chuyển' })`.
- `components/admin/ShippingSettingsPanel.vue` — mô phỏng `PaymentSettingsPanel.vue`, dùng
  `useRequestFetch()` khi gọi API nội bộ.
- Thẻ đầu: 4 chấm trạng thái **API / Webhook / Địa chỉ lấy hàng / Chính sách**, nút **Kiểm tra kết nối**.

**Tab 1 — Kết nối Goship:** base URL (sandbox/production), access token, client id/secret, lưu; hướng dẫn lấy
token và liên hệ `info@goship.io` cho production. Secret dạng `••••last4`; ô trống = giữ, chuỗi rỗng = xoá.

**Tab 2 — Lấy hàng & đóng gói:** địa chỉ lấy hàng chọn từ danh mục Goship (tỉnh → quận → phường) + số nhà;
khối lượng/kích thước mặc định; `default_item_weight`, `packaging_weight`; bật COD; `quote_ttl_seconds`;
`rate_cache_seconds`.

**Tab 3 — Chính sách cửa hàng:**
- Công tắc **Cho phép khách chọn vận chuyển** (mô tả rõ hệ quả).
- Khi tắt: chọn `autoStrategy` (Rẻ nhất / Nhanh nhất / Hãng ưu tiên) + hãng ưu tiên.
- Số option tối đa; danh sách hãng cho phép/chặn (tải từ `/carriers`).
- Phụ phí `markupPercent`; ngưỡng freeship; hiển thị ETA/tỷ lệ giao thành công.
- Hành vi dự phòng (`flat` + phí, hoặc `block`); `absorbFeeDifference`.
- Nút **Xem trước checkout** (mở tab mới với dữ liệu mẫu) nếu khả thi.
- Ghi chú: các field `shippingFee`/`freeShippingThreshold` cũ đã được chuyển vào đây.

**Tab 4 — Webhook:** URL webhook để copy, nút Đăng ký/Xoá webhook, trạng thái `goship_webhook_id`,
bật/tắt `auto_advance`. Không còn khối "Danh mục địa chỉ"/nút "Đồng bộ danh mục" — danh mục hạ cấp được
quản lý bằng script (xem §14.5).

Thêm mục **Vận chuyển** vào `layouts/admin.vue` ngay sau **Thanh toán** (`/admin/shipping`, icon xe tải).

### 14.2 Thẻ "Vận chuyển" trong chi tiết đơn

Chèn sau card **"Giao hàng & ghi chú"** (~`pages/admin/orders/[id].vue:435`), trước **"Thanh toán"**.

**Chưa tạo vận đơn:**

- Địa chỉ giao + mã đã resolve; cảnh báo nếu thiếu mã hoặc `resolution != resolved`.
- Hiển thị hãng/dịch vụ khách đã chọn, phí khách trả, cước hãng, COD, cân nặng tính toán.
- Nếu quote/rate hết hạn: nút **Báo giá lại**; hiển thị chênh lệch so với phí đã thu.
- Nút **Tạo vận đơn** (dùng đúng rate đã chọn nếu còn hiệu lực).
- Chặn khi đơn `cancelled`, đã có `shipping_shipment_id`, hoặc thiếu mã địa chỉ.

**Đã tạo:**

- Badge trạng thái (màu theo nhóm 901/903/905/906/907/914), mã vận đơn + link tracking, hãng, dịch vụ.
- Phí khách trả (`shipping_total`) vs cước hãng (`shipping_fee_quoted`) vs cước thực tế
  (`shipping_fee_actual`); badge chênh lệch; COD.
- Nút **Đồng bộ**, **Huỷ vận đơn** (confirm; không đổi thanh toán), **Tạo lại** sau khi huỷ.
- Timeline `shipment_events` gần nhất (5 dòng).
- Khi webhook cập nhật: dùng realtime hiện có (`server/utils/pb-realtime.ts` + SSE); nếu chưa gắn được SSE cho
  orders thì poll 20 giây.

**Đổi hãng sau khi khách đã chọn:**

- Cho phép nếu chênh lệch ≤ ngưỡng hoặc `absorbFeeDifference = true` (shop chịu).
- Nếu vượt ngưỡng và đơn đã thanh toán: cảnh báo, yêu cầu liên hệ khách; không tự thu thêm.
- Nếu đơn chưa thanh toán/COD: có thể báo giá lại và cập nhật trước khi tạo vận đơn.

### 14.3 Danh sách đơn

- `pages/admin/orders/index.vue`: thêm dòng nhỏ dưới badge: hãng + `shipping_status_text` (ẩn nếu chưa có).
- Bộ lọc nhanh: **Chưa tạo vận đơn**, **Đang giao**, **Chuyển hoàn** (client-side).
- Không đổi cột Thanh toán (nhãn VietQR vừa chỉnh).

### 14.4 Storefront editor

- `components/admin/StorefrontEditor.vue:773,777`: bỏ hai field phí ship phẳng/ngưỡng freeship; thay bằng liên
  kết "Cấu hình vận chuyển" trỏ `/admin/shipping`.
- `utils/store-presets.ts:63-64`: bỏ hai giá trị khỏi preset; thêm `shipping` mặc định nếu cần.
- `utils/store-config.ts:134-135`: normalize `shipping` policy; giữ đọc legacy để không vỡ dữ liệu cũ.

### 14.5 Vận hành luật hạ cấp địa chỉ (`rules:sync` → `rules:check` → `pb:rules`)

Luật ghi ngược sống trong PocketBase (`ward_downgrade_rules`), sinh từ nguồn công khai và ghép với snapshot
Goship. Không cần rebuild/redeploy khi cập nhật luật; mỗi phường được cache 5 phút.

| | Snapshot Goship | Luật hạ cấp |
| --- | --- | --- |
| Thao tác | `npm run goship:locations` | `npm run rules:sync` → `npm run rules:check` → `npm run pb:rules` |
| Nguồn | API Goship `/cities`/`/districts`/`/wards` | `provinces.open-api.vn` (`/api/v1/?depth=2` + `/api/v2/w/{code}/to-legacies/`) |
| Nơi lưu | `server/assets/goship-locations.json` (bundle) | `server/assets/ward-downgrade-rules.json` (commit) + PocketBase |
| Dùng khi | Kiểm tra mã địa chỉ, seed, form lấy hàng | Báo giá/tạo vận đơn từ địa chỉ 2 cấp |
| Cần rebuild | Có — import tĩnh vào server bundle | Không |

**Quy trình cập nhật luật**

1. Chạy `npm run rules:sync`. Script tải 3.321 phường mới (concurrency 4, cache ở `scripts/.cache`, retry
   429/5xx) và ghi atomic `server/assets/ward-downgrade-rules.json` — lỗi giữa chừng giữ nguyên file cũ.
   Chạy thử một tỉnh: `node scripts/sync-ward-downgrade-rules.mjs --province 79`.
2. Sửa ngoại lệ trong `scripts/lib/ward-downgrade-overrides.json` nếu cần: mảng mã phường Goship (thay thế
   toàn bộ đích), hoặc `{ "remove": [...], "add": [...], "targets": [...] }`, hoặc `{ "skip": true }`.
   Override thắng kết quả tự khớp.
3. Chạy `npm run rules:check` — mọi phường phải có ≥1 luật (trừ `skip`), đúng 1 `is_primary`, `goship_*`
   tồn tại đúng cha trong snapshot, không trùng `(new_ward_code, goship_ward_code)`.
4. Commit file JSON, rồi chạy `npm run pb:rules` (upsert theo `(new_ward_code, goship_ward_code)`, xoá dòng
   thừa). Dùng `npm run pb:rules:reset` khi muốn nạp lại từ đầu.
5. Không cần restart server: `rulesForWard` tự đọc lại sau TTL 5 phút/phường; khởi động lại chỉ để xoá cache
   sớm hơn.

**Cách script chọn đích**

- Ghép chuỗi cũ: tỉnh → quận → phường theo tên chuẩn hoá (bỏ dấu, bỏ tiền tố hành chính, bỏ `huyện đảo`,
  so khớp dạng thu gọn cho biến thể như Sapa/sa pa, Krông A Na/Krông Ana).
- Quận trùng tên (vd Hoa Lư huyện/thành phố, Hồng Ngự huyện/thành phố): ưu tiên cùng loại đơn vị, rồi đến
  quận chứa phường cũ; còn mơ hồ → báo cáo.
- Phường cũ không còn trong Goship (xã sáp nhập 2023–2024): chọn phường gần tên nhất **cùng quận** và ghi
  `note` để rà soát — quận mới là khoá tính phí.
- Đặc khu không có dữ liệu legacy (Hoàng Sa, Cồn Cỏ): `skip` trong override; Lý Sơn, Côn Đảo, Bạch Long Vĩ
  dùng `targets` chỉ định.
- `is_primary`: ưu tiên phường cũ trùng tên phường mới; nếu không, quận có nhiều dòng nhất rồi mã phường cũ
  nhỏ nhất. Đúng 1 primary / phường mới.

Snapshot Goship vẫn giữ quy trình cũ (`npm run goship:locations` → `goship:locations:check` → commit →
rebuild) vì là import tĩnh; dùng để kiểm tra mã và làm nguồn cho form địa chỉ lấy hàng.

---

## 15. Kế toán (cần chốt trước khi code giai đoạn 3)

- **Doanh thu vận chuyển:** `shipping_total` (khách trả) là một khoản thu; cần kế toán xác nhận hạch toán
  chung với doanh thu bán hàng hay tách dòng. Phí vận chuyển chịu VAT theo quy định dịch vụ vận tải.
- **Chi phí vận chuyển:** `shipping_fee_actual` khi `payer = 1` → chi phí bán hàng (TK 641) hoặc giá vốn tuỳ
  chính sách.
- **Freeship:** khách trả 0, shop trả hãng → toàn bộ cước là chi phí; không ghi doanh thu vận chuyển.
- **Markup:** chênh lệch giữa `shipping_total` và `shipping_fee_quoted` là doanh thu/điều chỉnh; cần tài khoản
  riêng để đối soát.
- **Chênh lệch cước thực tế:** `shipping_fee_actual - shipping_fee_quoted`; mặc định shop chịu
  (`absorbFeeDifference`), ghi nhận chi phí; nếu thu thêm khách thì phải có chứng từ/điều chỉnh đơn.
- **COD:** tiền hãng chuyển về = COD − phí hãng (nếu đối trừ) ± điều chỉnh; đối soát theo `invoice` của Goship
  (`amount_return_shop`). Giai đoạn 3 mới tự động nhập.
- `ensureOrderAccounting` hiện chạy khi `completed`/`refunded`; webhook 905 chỉ đặt `completed` khi `paid`,
  nên không tạo bút toán sớm. Đảm bảo idempotent theo `order`.

---

## 16. Lộ trình triển khai

### Phase 0 — Spike sandbox (1–2 ngày, bắt buộc)

1. Tạo tài khoản sandbox; lấy token; gọi `/cities`, `/districts`, `/wards`, `/carriers`.
2. Kiểm tra danh mục địa chỉ có phường/xã mới hay không; quyết định hướng A/B/C ở mục 7.
3. Gọi `/rates` với 3 tuyến (nội thành, liên tỉnh, vùng xa) và 3 mức cân nặng; kiểm tra:
   - `cod` có làm đổi `total_fee` không.
   - `report` có dữ liệu không.
   - `own_account` có rate hợp đồng không.
4. Tạo `/shipments` sandbox; đăng ký webhook; xác nhận payload/HMAC.
5. Kiểm tra rate id sống bao lâu (tạo vận đơn sau 5/15/30 phút).
6. Ghi kết quả vào tài liệu quyết định; nếu hướng B, chuẩn bị script sinh mapping.

**Điều kiện qua Phase 0:** biết chắc cách lấy mã địa chỉ cho 34 tỉnh/3321 phường và có ít nhất một tuyến báo
giá + tạo vận đơn thành công trên sandbox.

### Phase 1 — Checkout động + chính sách cửa hàng (bắt buộc)

1. Migrations: `shipping_settings`, `shipping_quotes`, field `shipping_*` trên `orders`, mã địa chỉ trên
   `addresses`; collection `ward_downgrade_rules` do script quản lý (`npm run pb:rules`), không khai báo
   trong migration.
2. `server/utils/shipping-settings.ts`, `shipping-policy.ts`, `goship.ts`, `shipping-address.ts`,
   `shipping-quote.ts`.
3. Public routes: `/api/shipping/config`, `/api/shipping/quote`, `/api/shipping/locations`.
4. Checkout: thêm mã địa chỉ, khối vận chuyển, chọn option, quote lại, submit kèm `quoteId`/`optionId`.
5. Server-authoritative: sửa `priceOrder`/`placeOrder` dùng quote + fallback; bỏ phí phẳng.
6. Cart/product/site: bỏ phí phẳng, hiển thị "tính khi thanh toán"; banner freeship theo policy.
7. Admin `/admin/shipping` 4 tab (kết nối, pickup/parcel, chính sách, webhook) + nav.
8. Data migration `scripts/migrate-shipping-policy.mjs`; backfill mã địa chỉ.
9. Bật/tắt dần bằng `shipping.enabled`; cửa hàng chưa cấu hình Goship dùng fallback phí cũ.

**Điều kiện hoàn thành:** khách đặt được đơn với cước sandbox; đổi địa chỉ/giỏ thì giá đổi; gửi phí giả từ
client không có tác dụng; quote hết hạn bị chặn; cửa hàng tắt chọn vẫn đặt được; typecheck xanh.

### Phase 2 — Vận đơn + webhook + admin

1. Routes admin: quote lại, tạo, sync, cancel.
2. Webhook + `shipment_events` + mapping trạng thái.
3. Thẻ Vận chuyển trong chi tiết đơn; badge/filter danh sách.
4. Realtime/poll; nút đồng bộ thủ công.
5. Xử lý rate hết hạn và chênh lệch cước.

**Điều kiện hoàn thành:** tạo được vận đơn sandbox từ đơn thật; webhook 903/905/914 chạy đúng; huỷ vận đơn
không đụng thanh toán; gửi webhook lặp không nhân đôi event.

### Phase 3 — COD & kế toán

- Chính sách `cod → paid` sau khi hãng xác nhận thu; `paid_at`.
- Bút toán doanh thu/chi phí vận chuyển sau khi kế toán chốt.
- Đối soát COD theo `invoice`/`amount_return_shop` (nhập tay trước, tự động sau).

### Phase 4 — Tối ưu

- Dimensions theo sản phẩm/kiện; đóng gói nhiều kiện.
- Tự tạo vận đơn khi đơn `confirmed` (nếu bật), kèm kiểm tra rate.
- Cache danh mục dài hạn; job làm mới; theo dõi tỷ lệ giao theo hãng.
- Nhiều kho lấy hàng; `payer = 0`; khai giá một phần; bảo hiểm; logo hãng bundle.

---

## 17. Kiểm thử và xác minh

1. **Typecheck:** `npm run typecheck` → exit 0 sau mỗi phase.
2. **Sandbox end-to-end:**
   - Quote tuyến nội thành/liên tỉnh; so khớp phí hiển thị với `total_fee`.
   - Tạo đơn với option rẻ nhất và option nhanh nhất; kiểm tra `shipping_*` được ghi đúng.
   - Webhook 903 → `shipping`; 905 với đơn `paid` → `completed`; 905 với COD → không `completed`.
   - Webhook 914 trên đơn `paid` → không huỷ, có cảnh báo.
   - Gửi webhook sai chữ ký → 401; lặp → không nhân đôi event.
3. **Chống sửa phí:**
   - Gửi `shippingFee`/`total` giả trong body → server bỏ qua.
   - Dùng `optionId` không thuộc quote → 400/409.
   - Dùng quote của cart/session khác → 409.
   - Sửa giỏ sau khi quote → 409 `SHIPPING_QUOTE_STALE`.
   - Quote hết hạn → 409 `SHIPPING_QUOTE_EXPIRED`; UI báo lại giá.
   - Dùng lại quote đã tạo đơn → 409.
4. **Biên:**
   - Giỏ chỉ có hàng số → không có phí giao, không gọi Goship.
   - Giỏ hỗn hợp → chỉ tính hàng vật lý.
   - Sản phẩm thiếu `weight_grams` → dùng `default_item_weight`, có cảnh báo.
   - Freeship đúng ngưỡng; ngưỡng tính sau giảm giá.
   - COD: `cod` đúng, cước COD được tính lại; `payer = 1`.
   - Rate limit: bấm liên tục → dùng cache/dự phòng, không lỗi 500.
   - Goship timeout/429 → fallback `flat` hoặc `block` đúng cấu hình.
   - Địa chỉ `ambiguous` → hiện chọn quận; `unresolved` → fallback.
   - Luật hạ cấp: `npm run rules:check` exit 0; `26824` → `700000/720300/12659` (primary), `22366` →
     `650000/650100`; địa chỉ Khánh Hòa không bị tra nhầm Hà Tĩnh; phường không có luật → `unresolved`.
5. **UI:** chụp qua CDP tại `http://127.0.0.1:4321` (cookie admin thuộc `127.0.0.1`):
   - Checkout desktop + mobile: trước khi có địa chỉ, đang tải, có option, chọn option, freeship, fallback.
   - Khách vãng lai + đã đăng nhập; địa chỉ cũ thiếu mã.
   - `/admin/shipping` 4 tab desktop + mobile.
   - Thẻ Vận chuyển ở 3 trạng thái; danh sách có badge.
6. **Hồi quy:**
   - SePay/VietQR không đổi; `paid` không quay về `pending`.
   - Máy trạng thái đơn không bị nhảy cóc.
   - Giỏ/thêm sản phẩm/checkout cũ (khi cửa hàng tắt động) vẫn hoạt động.
   - Product page/banner freeship đúng policy.
7. **Hiệu năng:** quote p95 < 2.5 giây trong điều kiện bình thường; hàng đợi không làm nghẽn admin.
8. **Kế toán:** đối chiếu tay một đơn prepaid, một đơn freeship, một đơn COD trước khi bật production.

---

## 18. Rủi ro và cách giảm thiểu

| Rủi ro | Ảnh hưởng | Giảm thiểu |
| --- | --- | --- |
| Danh mục Goship vẫn 3 cấp, không khớp địa chỉ 2 cấp | Không báo giá được | Luật `ward_downgrade_rules` sinh toàn quốc + `rules:check`; chọn quận khi mơ hồ; fallback phí |
| Địa chỉ đã lưu thiếu mã | Khách cũ không đặt được | Backfill theo tên; yêu cầu chọn lại; không chặn xem đơn |
| Rate id hết hạn giữa checkout và tạo vận đơn | Tạo vận đơn lỗi/giá đổi | Quote TTL 10 phút; khi tạo đơn kiểm tra; báo giá lại + shop chịu chênh lệch |
| Giá Goship thay đổi liên tục | Khách thấy giá nhảy | Cache 45 giây; chỉ báo lại khi input đổi; thông báo khi giá đổi |
| 300 request/phút dùng chung | Checkout bị 429 | Hàng đợi, cache theo tuyến, rate limit IP/cart, ưu tiên admin |
| Goship downtime | Không đặt được | Fallback phí phẳng + ghi chú; cho phép shop chọn chặn |
| Thu thiếu cước (actual > quoted) | Lỗ | `absorbFeeDifference` + cảnh báo; điều chỉnh giá/markup |
| Thu thừa cước | Mất uy tín | Đối soát `shipping_fee_actual`; hoàn phần chênh nếu chính sách cho phép |
| COD vòng lặp (phí ship phụ thuộc COD) | Sai phí | Tính COD từ merchandise + phí; gọi lại rate một lần; chấp nhận sai số nhỏ |
| Logo hãng remote bị CSP chặn | UI vỡ | Không dùng logo giai đoạn 1; bundle sau |
| Một đơn nhiều kiện | Không tạo được | Giai đoạn 1 một kiện; cảnh báo nếu vượt giới hạn hãng; tách đơn thủ công |
| Webhook trễ/mất | Trạng thái đơn sai | Nút Đồng bộ + poll; job đối soát đơn `shipping` |
| Webhook replay/trùng | Nhân đôi event/bút toán | Dedupe theo key; cập nhật idempotent |
| Lộ secret qua log/response | Bảo mật | Mask, allowlist, không log; test rò rỉ trước production |
| Quote dùng chéo session | Gian lận phí | `session_hash` + `cart_hash` + one-time |
| Hàng số bị tính phí | Khách bực | Lọc theo `type`/`requires_shipping`; test riêng |
| Kế toán chưa chốt | Sai sổ | Chỉ bật COD/accounting sau khi kế toán duyệt |

---

## 19. Câu hỏi cần chốt trước khi code

1. **Kết quả Phase 0:** Goship đã có danh mục 2 cấp chưa? Nếu chưa, chấp nhận mapping + chọn quận khi mơ hồ
   hay yêu cầu khách chọn quận từ đầu?
2. **Mặc định `allowCustomerChoice`:** bật cho tất cả cửa hàng (khuyến nghị) hay tắt để shop tự chọn?
3. **Fallback khi Goship lỗi:** `flat` + phí dự phòng (khuyến nghị) hay `block`?
4. **Ngưỡng freeship:** tính trên giá trị hàng sau giảm giá (khuyến nghị) hay trước giảm giá? Có áp riêng
   theo hãng không (giai đoạn 4)?
5. **905 với COD:** chờ admin xác nhận thu tiền (giai đoạn 1) hay tự `cod → paid` (giai đoạn 3)?
6. **Chênh lệch cước thực tế:** shop chịu toàn bộ (khuyến nghị) hay thu thêm khách?
7. **Khai giá:** luôn khai đủ giá trị hàng hay có ngưỡng (ví dụ > 1 triệu chỉ khai một phần)?
8. **Quote TTL:** 10 phút (khuyến nghị) hay ngắn/dài hơn? Có cần gia hạn khi khách đang nhập?
9. **Số option hiển thị:** 3 (khuyến nghị) hay 5? Có nhóm theo hãng không?
10. **Hiển thị tỷ lệ giao thành công:** bật mặc định hay chỉ admin bật?
11. **Logo hãng:** dùng monogram giai đoạn 1 (khuyến nghị) hay xin phép bundle logo?
12. **Nhiều kho lấy hàng:** có cần ngay không, hay một pickup mặc định?
13. **Kế toán:** xác nhận hạch toán doanh thu/chi phí vận chuyển, VAT, xử lý freeship và chênh lệch.
14. **Địa chỉ đã lưu:** chấp nhận yêu cầu khách chọn lại phường/xã một lần khi thiếu mã?
15. **Đơn chỉ có hàng số/dịch vụ:** có cần bước "phương thức nhận hàng" (email/link) thay cho vận chuyển
    không?

---

## 20. Nguồn tham khảo

**Goship**

- [Rate API](https://doc.goship.io/api/shipment/rate)
- [Shipment API](https://doc.goship.io/api/shipment/shipment)
- [District API](https://doc.goship.io/api/shipment/district)
- [City API](https://doc.goship.io/api/shipment/city)
- [Webhooks](https://doc.goship.io/api/shipment/webhooks)
- [Webhook Reference](https://doc.goship.io/api/shipment/webhook-reference)
- [Shipment status](https://doc.goship.io/api/shipment/shipment-status-code)
- [Rate limits](https://doc.goship.io/api/ratelimit)

**Sàn thương mại điện tử và hãng vận chuyển**

- [Shopee — Chính sách vận chuyển](https://help.shopee.vn/4/article/77250-CH%C3%8DNH-S%C3%81CH-V%E1%BA%ACN-CHUY%E1%BB%82N-SHOPEE)
- [Shopee — Các phương thức vận chuyển](https://help.shopee.vn/4/article/79534-%5BV%E1%BA%ADn-chuy%E1%BB%83n%5D-Shopee-%C4%91ang-h%E1%BB%97-tr%E1%BB%A3-nh%E1%BB%AFng-ph%C6%B0%C6%A1ng-th%E1%BB%A9c-v%E1%BA%ADn-chuy%E1%BB%83n-n%C3%A0o)
- [Lazada Seller Center — Kích thước, cân nặng, cân nặng quy đổi](https://sellercenter.lazada.vn/helpcenter/s/faq/knowledge?categoryId=1000028670&m_station=faq&questionId=1000149572)
- [GHN — Cách tính phí vận chuyển Shopee](https://ghn.vn/blogs/tip-ban-hang/phi-van-chuyen-shopee)
- [GHN — Tạo đơn với địa chỉ 2 cấp từ 01/07/2025](https://ghn.vn/blogs/tin-tuc-ghn/giaohangnhanh-huong-dan-khach-hang-tao-don-hang-khi-ap-dung-don-vi-hanh-chinh-moi-vao-dia-chi-lay-giao-tra)
