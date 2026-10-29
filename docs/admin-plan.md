# Kế hoạch Admin FloraHub

> Quản trị **toàn bộ module** (sản phẩm, đơn hàng, khách hàng, nội dung, cấu hình…), layout **full width**, **tối ưu tốc độ tải**.
> Phần 1–10 là bản thiết kế đầy đủ. Phần 0 ghi lại **đúng những gì đã chạy được** để tránh nhầm tài liệu với code.

---

## 0. Trạng thái triển khai (28/10/2026)

**Đã xong (3 module đầu):**

| Module | Route | Ghi chú |
| --- | --- | --- |
| Đăng nhập | `/admin/login` | Layout riêng, không sidebar; rate limit 10 lần/15 phút |
| Đơn hàng | `/admin/orders`, `/admin/orders/[id]` | Lọc/tìm, đổi trạng thái + thanh toán, sửa giao hàng/ghi chú, chặn rời `completed` |
| Sản phẩm | `/admin/products`, `/admin/products/new`, `/admin/products/[id]` | CRUD sản phẩm + biến thể; 3 loại (vật lý/số/dịch vụ); upload 20 ảnh + 2 video, kéo thả, ảnh bìa, featured; SEO/AEO + highlights + FAQ |
| Danh mục | `/admin/categories` | CRUD danh mục, danh mục cha, ẩn/hiện, SEO; chặn xoá khi còn con/sản phẩm |
| Cửa hàng (Studio) | `/admin/storefront` | Port từ `/studio`: preset, màu, font, layout, SEO, thanh toán; `/studio` → 301 |

**Auth:** `users.role` (`customer | staff | admin`) đã có trong DB; `demo@florahub.vn` = `admin`.
Thêm field + backfill bằng `npm run pb:roles` (`--check` để xem trước, `--admin a@x.vn`, `--staff b@x.vn`).
`x-studio-key` vẫn được chấp nhận cho `/api/store/*` để không phá script CLI, nhưng UI không còn dùng.

**Hiệu năng đo trên bản production (`.output`, local):**

| Chỉ số | Admin | Storefront |
| --- | --- | --- |
| JS chunk / KB raw | 22 chunk ≈ 332 KB | 38 chunk ≈ 368 KB |
| CSS font (`@fontsource`) | **0** | 7 KB (chỉ nạp family đang dùng) |
| `woff2` | **0** | 6 file |
| Vant CSS/JS | **0** | tải khi mở sheet (dynamic import) |
| `/api/site` khi vào trang | **không gọi** | 1 lần |

**Chưa làm (giữ trong kế hoạch):** dashboard tổng quan riêng (hiện `/admin` chuyển thẳng `/admin/orders`),
các module còn lại ở mục 5, audit log, màn hình phân quyền staff, luồng tải file số phía khách hàng.

**Kiểm thử:** `npm run typecheck`, `npm run build`, đăng nhập đúng/sai role (200/403), API không token (401),
`/studio` → 301, mobile 390 px không tràn ngang. Media: upload ảnh/video thật, proxy `/media/*` +
`Range: bytes` → 206, kéo thả đổi `thumbnail`, xoá media trả thumbnail về ảnh đầu tiên. Danh mục: tạo
cha/con, chặn vòng lặp, chặn xoá khi còn con/sản phẩm. Sản phẩm số: upload tệp protected, tạo/sửa
`type` và kiểm tra SEO/AEO/JSON-LD trên trang chi tiết.

---

## 1. Mục tiêu & phạm vi

| Mục tiêu | Cách đo |
| --- | --- |
| Một chỗ quản trị tất cả dữ liệu đang có trong PocketBase | 22 collection đều có màn hình list + form (trừ bảng hệ thống chỉ đọc) |
| Full width, không bị khung storefront `shellWidth` | Admin dùng layout riêng, `max-width: none` |
| Tải nhanh | JS admin ≤ 150 KB gzip/route, dashboard API ≤ 300 ms, LCP ≤ 1.2 s (local) |
| An toàn | Mọi mutation đi qua `/api/admin/*` có kiểm tra role ở server, có audit log |
| Không phá storefront | Storefront giữ nguyên hành vi; admin tách chunk, tách layout, tách plugin |

**Ngoài phạm vi phase đầu:** luồng giao file số cho khách sau thanh toán (đã có upload/protected file trong admin), thanh toán, email/SMS.

---

## 2. Hiện trạng (số liệu thực tế)

| Hạng mục | Hiện tại | Vấn đề |
| --- | --- | --- |
| Auth admin | `x-studio-key` dùng chung (`server/utils/studio.ts`) | Không có danh tính, không phân quyền, key lộ là mất toàn bộ |
| Role người dùng | `users` **không có** field role | Không phân biệt khách / nhân viên / quản trị |
| UI admin | `pages/studio/index.vue` (~1 file), chỉ quản theme/store | Không CRUD được module nào khác |
| Layout | `layouts/default.vue` dùng `config.layout.shellWidth` (tối đa 1180px) | Admin bị bó hẹp, dính header/footer/bottom-nav storefront |
| Font | **34** import `@fontsource` trong `nuxt.config.ts` (5 family × latin+vietnamese × weight) | Tải toàn bộ font cho mọi trang, kể cả admin |
| `vant` | `<AddToCartSheet />` nằm trong `app.vue` → mọi route đều kéo Vant + CSS | Admin không cần Vant nhưng vẫn tải |
| `plugins/00.site.ts` | Chạy toàn cục, gọi `/api/site` | Admin không cần theme storefront nhưng vẫn chờ request |
| API admin | Chỉ 6 route `/api/store/*` | Không có CRUD chung, mỗi module sẽ phải viết tay 5 route |
| Danh sách | `pbListAll` tải hết trang | Bảng vài nghìn dòng sẽ chậm và nặng |
| Audit | Không có | Không biết ai sửa gì |

---

## 3. Nguyên tắc thiết kế

1. **Một cửa vào `/admin`**, không có UI quản trị thứ hai. `/studio` được chuyển thành `/admin/storefront` và redirect 301.
2. **Registry-driven CRUD**: khai báo resource một lần (collection, field, filter, quan hệ) → sinh list/form/API. Không viết tay 5 route × 20 module.
3. **Server là hàng rào thật**: middleware client chỉ để UX; mọi `/api/admin/*` tự kiểm tra role + validate field.
4. **Tách bundle theo vai trò**: admin không import component storefront, không import Vant, không load font trang trí.
5. **Đo trước – sửa sau**: mỗi phase có số đo bundle/API trước và sau.

---

## 4. Kiến trúc

### 4.1 Auth & phân quyền

**Thay `x-studio-key` bằng role trên `users`.**

```
users.role        select: customer | staff | admin   (default: customer)
users.permissions json: []        # chỉ dùng cho staff, vd ["orders","products"]
users.admin_note  text            # ghi chú nội bộ
```

Luồng đăng nhập:

```
POST /api/admin/login   { email, password }
  → PB auth-with-password
  → đọc record.role
  → role không phải staff/admin ⇒ 403
  → set cookie httpOnly `pb_token` (đã có) + `admin_hint` (role, exp) để UI biết
GET  /api/admin/me      → { user, role, permissions, resources[] }
```

`server/utils/admin.ts`:

```ts
export type AdminRole = 'customer' | 'staff' | 'admin'

export function requireAdmin(event, opts?: { resource?: string; action?: 'read' | 'write' })
// 1. đọc pb_token cookie (hoặc Authorization header cho CLI)
// 2. auth-refresh với PB, cache 60s theo hash(token) trong Map (tránh gọi PB mỗi request)
// 3. role phải là staff|admin
// 4. staff: resource phải nằm trong permissions
// 5. trả { user, role }
```

- **CSRF**: kiểm tra `origin`/`referer` cùng host cho mọi POST/PATCH/DELETE.
- **Cookie**: `httpOnly`, `sameSite: 'lax'`, `secure` khi production, path `/`.
- **Rate limit** đăng nhập: 10 lần/15 phút/IP (Map in-memory, đủ cho single node).
- **Bootstrap**: `npm run pb:roles` thêm field `users.role` + set `demo@florahub.vn` = `admin`; cấp thêm bằng `npm run pb:roles -- --admin a@x.vn,b@x.vn` (hoặc `--staff`).
- **Studio key**: giữ 1 phase làm fallback cho script CLI, đánh dấu deprecated, xoá ở Phase 5.

**Middleware** `middleware/admin.ts` (chỉ áp cho `pages/admin/**`, không global):

```ts
if (!to.path.startsWith('/admin') || to.path === '/admin/login') return
const { user, role } = useAdmin()
if (!user) return navigateTo(`/admin/login?redirect=${encodeURIComponent(to.fullPath)}`)
```

### 4.2 Route map

| Route | Màn hình | Nguồn dữ liệu |
| --- | --- | --- |
| `/admin/login` | Đăng nhập (layout blank, không sidebar) | `users` |
| `/admin` | Dashboard: doanh thu, đơn mới, tồn kho thấp, top SP | nhiều collection (song song + cache) |
| `/admin/orders` | Danh sách đơn: lọc status/payment/ngày, tìm email/mã | `orders` + expand `user` |
| `/admin/orders/[id]` | Chi tiết: items, thanh toán, đổi trạng thái, ghi chú | `orders`, `order_items` |
| `/admin/products` | Danh sách SP: tìm, lọc category/seller/status, tồn kho | `products` + `variants` |
| `/admin/products/new` · `/admin/products/[id]` | Form SP + tab biến thể / ảnh / thông số / options / xu hướng giá | 8 collection con |
| `/admin/categories` | CRUD danh mục + thứ tự | `categories` |
| `/admin/reviews` | Duyệt/xoá đánh giá | `reviews` |
| `/admin/flash-sales` | Chương trình + chọn item | `flash_sales`, `flash_sale_items` |
| `/admin/promotions` | Mã giảm giá | `promotions` |
| `/admin/banners` | Banner trang chủ + thứ tự | `banners` |
| `/admin/posts` | Bài viết (editor textarea/markdown) | `posts` |
| `/admin/customers` | Danh sách khách: chi tiêu, số đơn, trạng thái | `users`, `orders` |
| `/admin/customers/[id]` | Hồ sơ: đơn, địa chỉ, ví, thông báo | `addresses`, `wallets`, `wallet_transactions`, `notifications` |
| `/admin/carts` | Giỏ bỏ quên | `carts`, `cart_items` |
| `/admin/affiliates` | Cộng tác viên, click, hoa hồng | 3 collection |
| `/admin/sellers` | Nhà bán | `sellers` |
| `/admin/regions` | Khu vực/thuế | `regions` |
| `/admin/storefront` | **Chuyển từ `/studio`**: theme, preset, domain, layout, payment | `store_configs`, `settings` |
| `/admin/settings` | Cấu hình chung (ship, phí, affiliate rate, hotline) | `settings` |
| `/admin/staff` | Nhân sự & phân quyền (chỉ `admin`) | `users` |
| `/admin/locations` | Tỉnh/Phường (chỉ đọc + nút đồng bộ) | `provinces`, `wards` |
| `/admin/audit` | Nhật ký thao tác (chỉ `admin`) | `audit_logs` |

### 4.3 Layout admin (full width)

`layouts/admin.vue`:

```
┌─────────────────────────────────────────────────────────────┐
│ Topbar (h-14, sticky): logo nhỏ · breadcrumb · search · user │
├──────────────┬──────────────────────────────────────────────┤
│ Sidebar      │  <main class="w-full px-4 lg:px-6 py-5">     │
│ 240px        │    page content (max-width: none)            │
│ (thu gọn 64) │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- Bọc ngoài: `<div class="min-h-dvh w-full bg-surface text-ink">` — **không** dùng `shellWidth`.
- Sidebar nhóm: *Tổng quan · Bán hàng · Sản phẩm · Nội dung · Khách hàng · Tiếp thị · Cửa hàng · Hệ thống*.
- Mobile: sidebar thành drawer (`<dialog>` hoặc overlay tự viết), không kéo Vant.
- Desktop ≥1280px: bảng hiển thị đủ cột; dưới 1024px: cột phụ ẩn dần theo breakpoint (không dùng `overflow-x` toàn trang).
- `AdminTable.vue`: header sticky, skeleton 5 dòng, empty state, phân trang server-side, chọn nhiều + bulk action.
- `AdminForm.vue` + field components: `FieldText`, `FieldNumber`, `FieldSelect`, `FieldRelation` (search remote), `FieldDate`, `FieldSwitch`, `FieldJson`, `FieldImageUrl`.
- Design tokens riêng cho admin (`assets/css/admin.css`): chỉ dùng font hệ thống (hoặc Inter 400/500/600 latin+vietnamese — 6 file thay vì 34).

`pages/admin/**` đặt `definePageMeta({ layout: 'admin', middleware: 'admin' })` (hoặc `middleware: ['admin']` ở page cha qua route group).

### 4.4 API CRUD chung

**Registry** `server/admin/resources.ts`:

```ts
export type AdminField = {
  name: string
  label: string
  type: 'text' | 'number' | 'bool' | 'select' | 'date' | 'relation' | 'json' | 'textarea'
  required?: boolean
  options?: string[]
  relation?: { collection: string; label: string }
  readOnly?: boolean
  list?: boolean          // hiện ở bảng danh sách
  searchable?: boolean
  hidden?: boolean
}

export type AdminResource = {
  key: string             // 'orders'
  collection: string      // 'orders'
  label: string
  group: string
  icon: string
  idField?: string
  fields: AdminField[]
  listFields: string[]    // fields=... gửi PB, giảm payload
  searchFields: string[]
  defaultSort: string     // '-created_at'
  filters?: { name: string; type: 'select' | 'date' | 'text'; options?: string[] }[]
  expand?: string[]
  permissions?: { write?: AdminRole[] }
  transformIn?: (body: any) => any
  transformOut?: (record: any) => any
  hooks?: { beforeCreate?; afterUpdate? }
}

export const adminResources: Record<string, AdminResource>
```

**Routes** (Nitro, catch-all theo resource):

| Method | Path | Việc |
| --- | --- | --- |
| GET | `/api/admin/resources` | metadata cho sidebar + form (1 request, cache 5 phút) |
| GET | `/api/admin/[resource]` | list: `page`, `perPage`, `q`, `sort`, `filter[...]` → `pbListPage` với `fields`, `expand` |
| POST | `/api/admin/[resource]` | create (validate field theo registry) |
| GET | `/api/admin/[resource]/[id]` | detail |
| PATCH | `/api/admin/[resource]/[id]` | update (chỉ field khai báo) |
| DELETE | `/api/admin/[resource]/[id]` | delete |
| POST | `/api/admin/[resource]/bulk` | `{ ids, action: 'delete' \| 'patch', patch? }` |

**Custom routes** (không thuộc CRUD chung):

```
GET   /api/admin/dashboard            # số liệu tổng hợp
POST  /api/admin/orders/[id]/status   # đổi trạng thái + side-effect (hoàn kho, commission)
GET   /api/admin/customers/[id]       # gộp user + orders + wallet + addresses
GET   /api/admin/store/...            # giữ nguyên logic /api/store/*, đổi auth
POST  /api/admin/products/[id]/duplicate
GET   /api/admin/audit
```

**Quy ước list** (bắt buộc, để nhanh):

```ts
perPage mặc định 25 (max 100)
fields = registry.listFields.join(',')     // không trả description/body
expand chỉ quan hệ cần hiển thị
q → filter OR các searchFields, escape bằng pbQuote()
sort whitelist theo registry (chặn injection)
skipTotal=1 khi q đang gõ (chỉ lấy page hiện tại), bật total khi rời ô search
```

**Validate**: whitelist theo `fields`, ép kiểu number/bool/date, cắt độ dài text, kiểm tra relation id tồn tại (chỉ khi tạo/sửa), trả lỗi theo field để form highlight.

### 4.5 Audit log

Collection mới `audit_logs`:

```
user (relation users) | user_email (text) | role (text)
action (text: create|update|delete|login|status_change)
resource (text) | record_id (text)
diff (json) | ip (text) | user_agent (text) | created (date)
```

- Ghi trong `server/utils/audit.ts`, gọi sau mỗi mutation thành công; `event.waitUntil()` để không chặn response.
- `diff` chỉ lưu field thay đổi (before/after), **không** lưu password/token.
- Trang `/admin/audit` chỉ role `admin`, lọc theo user/resource/ngày.
- Giữ 90 ngày: script dọn `scripts/prune-audit.mjs` (chạy tay/cron).

---

## 5. Ma trận module

| Nhóm | Module | Collection | List | Form | Hành động đặc biệt |
| --- | --- | --- | --- | --- | --- |
| Tổng quan | Dashboard | nhiều | – | – | 6 thẻ số + 2 bảng gần đây |
| Bán hàng | Đơn hàng | `orders`, `order_items` | ✓ | ✓ | đổi trạng thái, huỷ + hoàn kho, in/xuất CSV |
| Bán hàng | Giỏ bỏ quên | `carts`, `cart_items` | ✓ | xoá | lọc `completed_at = null` + quá 24h |
| Sản phẩm | Sản phẩm | `products` | ✓ | ✓ | nhân bản, ẩn/hiện (`status`) |
| Sản phẩm | Biến thể | `variants` | ✓ (tab) | ✓ | tồn kho nhanh tại bảng |
| Sản phẩm | Media / Thông số / Options | `product_images`, `product_specs`, `product_options` | ✓ (tab) | ✓ | upload 20 ảnh + 2 video, kéo thả, featured, ảnh bìa tự động |
| Sản phẩm | Xu hướng giá/tồn | `price_trends`, `stock_trends` | ✓ (tab) | ✓ | nhập nhanh nhiều dòng |
| Sản phẩm | Danh mục | `categories` | ✓ | ✓ | kéo thả thứ tự |
| Sản phẩm | Đánh giá | `reviews` | ✓ | ✓ | duyệt/xoá, lọc theo sao |
| Nội dung | Banner | `banners` | ✓ | ✓ | bật/tắt, thứ tự |
| Nội dung | Bài viết | `posts` | ✓ | ✓ | preview link storefront |
| Nội dung | Flash sale | `flash_sales`, `flash_sale_items` | ✓ | ✓ | chọn SP/biến thể, giá sale |
| Nội dung | Khuyến mãi | `promotions` | ✓ | ✓ | bật/tắt theo thời gian |
| Khách hàng | Khách hàng | `users` | ✓ | ✓ | khoá/mở, đổi role (admin), xem tổng chi |
| Khách hàng | Địa chỉ | `addresses` | ✓ (tab) | ✓ | chỉ đọc phần tỉnh/phường |
| Khách hàng | Ví & giao dịch | `wallets`, `wallet_transactions` | ✓ (tab) | ✓ | cộng/trừ có lý do → audit |
| Khách hàng | Thông báo | `notifications` | ✓ (tab) | ✓ | gửi cho 1 hoặc nhiều user |
| Tiếp thị | Cộng tác viên | `affiliates` | ✓ | ✓ | duyệt, đổi `status` |
| Tiếp thị | Click / Hoa hồng | `affiliate_clicks`, `affiliate_commissions` | ✓ | – | lọc theo ngày |
| Cửa hàng | Giao diện | `store_configs` | ✓ | ✓ | **chuyển từ `/studio`**, giữ nguyên preset/domain/default |
| Cửa hàng | Cấu hình | `settings` | – | ✓ | ship, free-ship, affiliate rate, hotline, SEO |
| Cửa hàng | Nhà bán | `sellers` | ✓ | ✓ | rating, logo |
| Cửa hàng | Khu vực | `regions` | ✓ | ✓ | thuế |
| Hệ thống | Nhân sự | `users` | ✓ | ✓ | chỉ `admin` |
| Hệ thống | Địa giới | `provinces`, `wards` | ✓ | – | chỉ đọc + nút "đồng bộ" gọi script |
| Hệ thống | Nhật ký | `audit_logs` | ✓ | – | chỉ `admin` |

Ghi chú: `order_items`, `cart_items`, `flash_sale_items`… không có trang riêng — quản lý trong tab của bản ghi cha.

---

## 6. Hiệu năng

### 6.1 Ngân sách

| Chỉ số | Hiện tại (ước tính) | Mục tiêu admin |
| --- | --- | --- |
| CSS font toàn cục | 34 file `@fontsource` | 0 file font trên admin (system font); storefront chỉ nạp family đang dùng |
| JS route admin (gzip) | – | ≤ 150 KB |
| Vant trong bundle admin | có (qua `app.vue`) | 0 |
| Request khi mở admin | `/api/site` + auth + page | 2 (auth + page), `/api/site` bị bỏ |
| API list 25 dòng | `pbListAll` (có thể tải hết) | 1 request, ≤ 40 KB JSON |
| Dashboard API | chưa có | ≤ 300 ms, ≤ 8 query song song |
| LCP dashboard | – | ≤ 1.2 s local, ≤ 2.0 s 3G nhanh |

### 6.2 Hành động cụ thể

**A. Tách font (lớn nhất)**

- Bỏ 34 import khỏi `nuxt.config.css`.
- `assets/css/fonts-storefront.css` chỉ giữ family đang dùng cho theme mặc định; các family khác nạp động trong `layouts/default.vue` theo `config.typography`:

```ts
const fontLinks = computed(() => presetFontLinks(config.value.typography))
useHead({ link: fontLinks.value })   // preload + stylesheet theo family thực tế
```

- Admin dùng `font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto` — **không tải font ngoài**. Nếu cần đồng bộ thương hiệu: chỉ Inter 400/500/600 latin + vietnamese.
- Đo lại: `du -sh .nuxt/dist/client/_nuxt/*.css`, so sánh số request font trong Network.

**B. Bỏ Vant khỏi admin**

- Chuyển `<AddToCartSheet />` từ `app.vue` vào `layouts/default.vue`.
- `const AddToCartSheet = defineAsyncComponent(() => import('~/components/AddToCartSheet.vue'))` — chỉ tải khi mở sheet.
- `assets/css/vant.css` chuyển vào layout storefront (hoặc import trong chính component).
- Kết quả: admin không còn `vant` chunk; storefront giảm JS ở first load.

**C. Bỏ `/api/site` trên admin**

- `plugins/00.site.ts`: `if (useRoute().path.startsWith('/admin')) return`.
- `app.vue` tách phần theme/head sang `layouts/default.vue` (hoặc `useStorefrontHead()` composable chỉ gọi trong layout storefront). Admin dùng head tĩnh: title "FloraHub Admin", `robots: noindex`.

**D. Code-split & route rules**

```ts
routeRules: {
  '/admin/**': {
    ssr: true,
    headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' }
  },
  '/api/admin/**': { headers: { 'cache-control': 'no-store' } }
}
```

- `pages/admin/**` không import component storefront (`ProductCard`, `RegionPicker`…). Nếu cần picker tỉnh/phường, viết `AdminRegionSelect` nhẹ dùng `/api/locations/*`.
- Sidebar dùng `NuxtLink` mặc định; tắt prefetch cho mục nặng: `:prefetch="false"` trên nhóm chưa dùng (tránh 15 request đồng loạt lúc mở admin).
- Bảng > 100 dòng: phân trang server (25/50/100). Không render 1000 dòng.

**E. Server**

- List: `fields`, `perPage ≤ 100`, `skipTotal` khi đang gõ, `expand` tối thiểu.
- Dashboard: `Promise.all` cho 6 truy vấn; cache in-memory 20 s theo `storeId` (`useStorage('cache:admin:dashboard')`).
- Không N+1: dùng pattern batch của `server/utils/catalog.ts` (gom id → 1 query `id ?= "a" || id ?= "b"`).
- Ảnh thumbnail: thêm `?thumb=120x120` cho PB file; URL ngoài giữ nguyên.
- Nén: đảm bảo response JSON > 1 KB được nén (Nitro `compressPublicAssets` + reverse proxy).

**F. Đo lường**

- `npm run build` + `npx nuxi analyze` (hoặc script đọc `.nuxt/dist/client/_nuxt/*.js`).
- Script `scripts/check-bundle.mjs`: in top 20 chunk lớn nhất, fail nếu chunk admin > 160 KB.
- Lighthouse (headless Chrome CDP 9333) cho `/admin` và `/admin/products` trước/sau mỗi phase.
- `curl -w '%{time_total} %{size_download}'` cho `/api/admin/orders?perPage=25`.

---

## 7. Cấu trúc file

```
layouts/
  admin.vue                     # full width, sidebar + topbar
  default.vue                   # storefront (thêm font động, AddToCartSheet)
middleware/
  admin.ts                      # guard /admin
pages/admin/
  login.vue
  index.vue                     # dashboard
  orders/index.vue
  orders/[id].vue
  products/index.vue
  products/new.vue
  products/[id].vue
  categories.vue
  reviews.vue
  flash-sales/index.vue
  flash-sales/[id].vue
  promotions.vue
  banners.vue
  posts/index.vue
  posts/[id].vue
  customers/index.vue
  customers/[id].vue
  carts.vue
  affiliates.vue
  sellers.vue
  regions.vue
  storefront.vue               # ← port từ pages/studio/index.vue
  settings.vue
  staff.vue
  locations.vue
  audit.vue
components/admin/
  AdminShell.vue               # sidebar/topbar (dùng bởi layout)
  AdminTable.vue
  AdminToolbar.vue             # search + filter + bulk
  AdminForm.vue
  AdminField.vue
  AdminRelationPicker.vue
  AdminPagination.vue
  AdminStatCard.vue
  AdminEmpty.vue
  AdminConfirmDialog.vue
server/
  admin/
    resources.ts               # registry toàn bộ module
    fields.ts                  # helper khai báo field
  utils/
    admin.ts                   # requireAdmin, role cache, CSRF, rate limit
    admin-crud.ts              # list/get/create/update/delete/bulk
    audit.ts
  api/admin/
    resources.get.ts
    me.get.ts
    login.post.ts
    logout.post.ts
    dashboard.get.ts
    [resource]/index.get.ts
    [resource]/index.post.ts
    [resource]/[id].get.ts
    [resource]/[id].patch.ts
    [resource]/[id].delete.ts
    [resource]/bulk.post.ts
    orders/[id]/status.post.ts
    customers/[id].get.ts
    store/...                  # port từ /api/store/*
    audit.get.ts
composables/
  useAdmin.ts                  # session, role, resources, can()
  useAdminList.ts              # list state: page/q/sort/filter + fetch
scripts/
  migrate-admin-roles.mjs
  migrate-audit-log.mjs
  prune-audit.mjs
  check-bundle.mjs
assets/css/
  admin.css
  fonts-storefront.css
```

Xoá sau khi chuyển xong: `pages/studio/index.vue`, `server/api/store/*` (thay bằng `/api/admin/store/*`), `server/utils/studio.ts`.

---

## 8. Lộ trình

### Phase 0 — Nền móng (bắt buộc trước mọi module)

| Việc |验收 |
| --- | --- |
| Migration `users.role` + bootstrap admin | `npm run pb:roles` chạy idempotent, `demo@florahub.vn` là admin |
| `server/utils/admin.ts` + `/api/admin/login|me|logout` | Đăng nhập sai role → 403; cookie httpOnly; rate limit hoạt động |
| `middleware/admin.ts` + `/admin/login` | Vào `/admin` khi chưa login → redirect, `?redirect` quay lại đúng |
| `layouts/admin.vue` full width + sidebar + topbar | Ở 1440px nội dung dùng hết chiều ngang; mobile có drawer |
| `AdminTable` + `useAdminList` + CRUD factory + registry rỗng | List `orders` chạy phân trang, không tải toàn bộ |
| `audit_logs` + ghi log | Sửa 1 bản ghi → có dòng audit, không chứa token |
| Tách font + Vant + `/api/site` khỏi admin | Network `/admin`: 0 request font storefront, 0 chunk vant, 0 `/api/site` |
| `check-bundle.mjs` | In bảng chunk; baseline lưu vào `ADMIN_PERF.md` |

**Điều kiện thoát phase:** đăng nhập được, `/admin` trống nhưng full width, bundle đạt ngân sách, `npm run typecheck` pass.

### Phase 1 — Bán hàng (giá trị cao nhất)

- Dashboard (6 chỉ số + 2 bảng gần đây, `Promise.all` + cache 20 s).
- Đơn hàng: list (lọc status/payment/ngày/q), chi tiết, đổi trạng thái có side-effect (huỷ → hoàn kho, hoàn tất → commission), CSV.
- Khách hàng: list + hồ sơ (đơn, địa chỉ, ví).
- **Nghiệm thu:** 2.000 đơn giả lập, list 25 dòng < 300 ms; đổi trạng thái có audit; dashboard < 300 ms.

### Phase 2 — Sản phẩm

- Products list + form nhiều tab (biến thể, ảnh, thông số, options, xu hướng).
- Categories (kéo thứ tự), Reviews, Sellers, Regions.
- **Nghiệm thu:** tạo SP + 3 biến thể + ảnh trong 1 form không rời trang; list SP lọc theo category và tồn kho thấp.

### Phase 3 — Nội dung & khuyến mãi

- Banners, Posts, Flash sales (+ items), Promotions.
- **Nghiệm thu:** tạo flash sale 3 item, storefront hiển thị đúng ngay (không cần restart).

### Phase 4 — Khách hàng & tiếp thị

- Ví (cộng/trừ có lý do), notifications, addresses.
- Affiliates + clicks + commissions, carts bỏ quên.
- **Nghiệm thu:** cộng ví 100k → audit + số dư storefront đổi; lọc giỏ bỏ quên > 24h đúng.

### Phase 5 — Cửa hàng & hệ thống

- `/admin/storefront` port từ `/studio` (giữ nguyên: preset, domain, `is_default`, payment QR, cảnh báo store không live).
- `/admin/settings`, `/admin/staff`, `/admin/locations`, `/admin/audit`.
- Redirect `/studio` → `/admin/storefront`; xoá `x-studio-key`; cập nhật `STORE_STUDIO.md`.

### Ước lượng tương đối

| Phase | Khối lượng |
| --- | --- |
| 0 | L (nền móng, nhiều file mới) |
| 1 | L |
| 2 | L (form sản phẩm nhiều tab nhất) |
| 3 | M |
| 4 | M |
| 5 | M |

---

## 9. Rủi ro & câu hỏi cần chốt

| # | Câu hỏi | Đề xuất |
| --- | --- | --- |
| 1 | Dùng role trên `users` thay `x-studio-key`? | **Có** — key dùng chung không thể audit/phân quyền |
| 2 | Gộp `/studio` vào `/admin/storefront` và redirect? | **Có**, giữ redirect 301 để link cũ không chết |
| 3 | Thứ tự module ưu tiên? | Đơn hàng → Sản phẩm → Nội dung → Khách hàng → Cửa hàng |
| 4 | Admin quản **một store** hay **nhiều store** (`store_configs`)? | Phase 0–5: một store đang chọn (mặc định). Đa store: thêm `store` relation vào các collection — **cần quyết trước Phase 1** vì ảnh hưởng schema |
| 5 | Staff có cần phân quyền chi tiết đến từng field? | Không — chỉ theo resource (`permissions: ["orders","products"]`) |
| 6 | Ảnh: tiếp tục nhập URL hay upload file vào PB? | Giữ URL ở phase này; upload là phase riêng (cần `pb_hooks` + storage) |
| 7 | Có cần xuất Excel/CSV? | CSV cho đơn hàng + khách hàng ở Phase 1/4 |

### Rủi ro kỹ thuật

- **PB superuser token**: mọi mutation vẫn dùng token superuser ở server → validate field + whitelist là bắt buộc, không tin body từ client.
- **Role cache 60 s**: đổi quyền có độ trễ tối đa 1 phút — chấp nhận được; nút "thu hồi ngay" xoá cache theo user.
- **Đa store**: nếu chốt multi-store sau Phase 1, phải migrate thêm relation — chi phí tăng đáng kể.
- **Font động theo preset**: nếu preset đổi font, cần preload đúng để không nháy chữ (FOUT); dùng `display=swap` và fallback cùng metric.

---

## 10. Kiểm thử & nghiệm thu tổng

```bash
npm run typecheck
npm run pb:roles            # idempotent
node scripts/check-bundle.mjs

# API
curl -s -b /tmp/cj.txt 'http://localhost:4321/api/admin/orders?perPage=25' | jq '.items|length'
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:4321/api/admin/orders'   # 401 khi chưa login

# UI (headless Chrome CDP 9333)
# 1. login admin → /admin hiển thị dashboard full width
# 2. login customer → /admin redirect /admin/login
# 3. /studio → 301 /admin/storefront
# 4. Network: không có font storefront, không có chunk vant, không có /api/site
```

**Definition of Done chung cho mỗi module:** list có phân trang + tìm kiếm + lọc; form validate server; mutation có audit; empty/loading/error state; mobile 390px dùng được; `typecheck` pass.
