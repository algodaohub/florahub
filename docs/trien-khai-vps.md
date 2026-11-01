# Triển khai FloraHub lên VPS (1 click)

Hướng dẫn cho người **không rành kỹ thuật**. Làm theo đúng thứ tự, mỗi bước chỉ cần copy–dán.

Kết quả: website bán hàng chạy trên tên miền riêng, có HTTPS miễn phí, tự khởi động lại khi VPS reboot.

---

## 1. Mua VPS (máy chủ)

Chọn **Ubuntu 22.04 hoặc 24.04**, cấu hình tối thiểu:


| Tài nguyên | Tối thiểu   | Nên dùng |
| ---------- | ----------- | -------- |
| RAM        | 1 GB (chật) | 2 GB     |
| CPU        | 1 vCPU      | 2 vCPU   |
| Ổ cứng     | 20 GB       | 40 GB    |


Nơi mua (đăng ký → tạo máy → chọn Ubuntu → nhận **IP** và **mật khẩu root** gửi qua email):

- [DigitalOcean (Quốc tế)](https://www.digitalocean.com/?refcode=4cbcb30f33e1&utm_campaign=Referral_Invite&utm_medium=Referral_Program)
- [Vietnix (Việt Nam)](https://portal.vietnix.vn/aff.php?aff=3807) 

> VPS ở Việt Nam truy cập nhanh hơn cho khách trong nước.

---

## 2. Mua tên miền + trỏ về VPS

Mua tên miền:

- Namecheap — [https://www.namecheap.com](https://www.namecheap.com)
- Tenten — [https://tenten.vn](https://tenten.vn)
- Mắt Bão — [https://matbao.net](https://matbao.net)
- PA Vietnam — [https://www.pavietnam.vn](https://www.pavietnam.vn)

Trỏ tên miền (khuyến nghị dùng **Cloudflare** miễn phí, có chống DDoS):

1. Đăng ký [https://dash.cloudflare.com](https://dash.cloudflare.com) → **Add site** → nhập tên miền.
2. Cloudflare cho 2 dãy **Nameserver** → dán vào trang quản lý tên miền (nơi mua).
3. Trong Cloudflare → **DNS** → thêm bản ghi:
   
   | Type | Name  | Content          | Proxy                 |
   | ---- | ----- | ---------------- | --------------------- |
   | A    | `@`   | *IP VPS của bạn* | Proxied (đám mây cam) |
   | A    | `www` | *IP VPS của bạn* | Proxied               |
   
4. Chờ 5–30 phút để DNS cập nhật.

> Nếu chưa có tên miền vẫn cài được: bỏ trống tên miền, dùng tạm địa chỉ IP.

---

## 3. Cài đặt (1 lệnh)

Kết nối VPS bằng **Terminal** (macOS) hoặc **PowerShell** (Windows):

```bash
ssh root@<IP_VPS>
```

Dán nguyên khối sau rồi Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/algodaohub/florahub/main/deploy/install.sh -o install.sh
sudo bash install.sh
```

Chương trình sẽ hỏi lần lượt:

- **Tên miền** — ví dụ `shopcuaban.com` (bỏ trống nếu chưa có, Enter để dùng IP).
- **Email quản trị** — email để đăng nhập `/admin`. Nhập email thật đang dùng.
- **Email/mật khẩu PocketBase** — Enter để dùng mặc định / mật khẩu ngẫu nhiên.
- **Khoá Studio** — Enter để tạo ngẫu nhiên.

Sau đó tự động: cài Node.js, PocketBase, tạo dữ liệu mẫu, build website, bật HTTPS. Mất khoảng **5–10 phút**.

Khi thấy khối `FloraHub đã cài xong` là xong. Mở:

- Cửa hàng: `https://shopcuaban.com`
- Quản trị: `https://shopcuaban.com/admin/login`

> Cuối quá trình cài, màn hình in ra **email + mật khẩu quản trị** — lưu lại để đăng nhập. Nên đổi mật khẩu ngay sau lần đầu.

---

## 4. Đăng ký các dịch vụ tích hợp

Cài xong website chạy được ngay, nhưng để **giao hàng** và **thanh toán** cần tài khoản bên thứ ba (đều miễn phí đăng ký):

### Vận chuyển — Goship

Lấy cước, tạo vận đơn, theo dõi giao hàng.

1. Đăng ký (link giới thiệu dự án): [https://shop.goship.io/login?ref=daolv](https://shop.goship.io/login?ref=daolv)
2. Lấy **API token**, **client id**, **client secret** và **địa chỉ lấy hàng (pickup)** trong trang quản trị Goship.
3. Nhập vào FloraHub tại **`/admin/shipping`**.

### Thanh toán — SePay

Xác nhận chuyển khoản tự động qua webhook (VietQR miễn phí phí cổng).

1. Đăng ký (link giới thiệu dự án): [https://my.sepay.vn/register?gcid=361](https://my.sepay.vn/register?gcid=361)
2. Kết nối tài khoản ngân hàng, lấy **API token** + **webhook secret**.
3. Nhập vào FloraHub tại **`/admin/payments`**.
4. Trong SePay, đặt Webhook URL: `https://shopcuaban.com/api/webhooks/sepay`

### Trợ lý AI (tuỳ chọn)

- OpenAI — [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Anthropic — [https://console.anthropic.com](https://console.anthropic.com)
- Nhập khoá tại **`/admin/ai`**.

> Bí mật được lưu trong PocketBase (chỉ server đọc), **không** ghi vào `.env`.

---

## 5. Cấu hình lần đầu

1. Đăng nhập `/admin/login` bằng email + mật khẩu in ra ở bước 3.
2. `/admin/settings` → nhập tên shop, logo, màu, thông tin liên hệ.
3. `/admin/shipping` → bật Goship, nhập token, địa chỉ lấy hàng, chính sách phí (markup, freeship).
4. `/admin/payments` → bật SePay/VietQR.
5. `/admin/products` → thêm sản phẩm.
6. Xoá tài khoản demo `demo@florahub.vn` nếu không cần.

---

## Cập nhật phiên bản mới

```bash
cd /opt/florahub
git pull
npm ci
npm run build
sudo systemctl restart florahub-web
```

## Sao lưu dữ liệu

Toàn bộ dữ liệu nằm trong `/opt/florahub/pb_data`. Sao lưu định kỳ:

```bash
tar czf ~/florahub-backup-$(date +%F).tar.gz -C /opt/florahub pb_data
```

## Lệnh kiểm tra khi có lỗi

```bash
sudo systemctl status florahub-web florahub-pocketbase caddy
sudo journalctl -u florahub-web -n 100 --no-pager
sudo journalctl -u florahub-pocketbase -n 100 --no-pager
```

## Câu hỏi thường gặp

**Build báo lỗi hết bộ nhớ (`JS heap out of memory`)?** VPS 1 GB không đủ. Nâng lên 2 GB, hoặc thêm swap:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

**HTTPS chưa hoạt động?** Kiểm tra DNS đã trỏ đúng IP chưa (bước 2). Caddy cần tên miền phân giải đúng mới xin được chứng chỉ.

**Goship/SePay báo sai khoá?** Kiểm tra lại token ở `/admin/shipping` và `/admin/payments`; đảm bảo webhook URL dùng `https://` và đúng tên miền, không có dấu `/` cuối.

---

## Hỗ trợ

- **Zalo / Hotline:** 0945245115 — [chat Zalo](https://zalo.me/0945245115)
- Đăng ký Goship/SePay qua link giới thiệu: [Goship](https://shop.goship.io/login?ref=daolv) · [SePay](https://my.sepay.vn/register?gcid=361)
- Đăng ký VPS qua link giới thiệu: [Vietnix (Việt Nam)](https://portal.vietnix.vn/aff.php?aff=3807) - [DigitalOcean (Quốc tế)](https://www.digitalocean.com/?refcode=4cbcb30f33e1&utm_campaign=Referral_Invite&utm_medium=Referral_Program)