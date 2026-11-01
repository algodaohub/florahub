#!/usr/bin/env bash
# FloraHub — cài đặt 1 click lên VPS Ubuntu/Debian.
# Chạy:  sudo bash install.sh
#
# Cài: Node.js 22, PocketBase, web (Nuxt/Nitro), Caddy (HTTPS tự động).
# Bao gồm: PocketBase + schema + dữ liệu demo, đồng bộ địa chỉ VN.
#
# Ghi đè bằng biến môi trường: FLORAHUB_DIR, FLORAHUB_REPO, FLORAHUB_PORT,
# POCKETBASE_VERSION, FLORAHUB_DOMAIN, ADMIN_EMAILS, FLORAHUB_NONINTERACTIVE=1

set -euo pipefail

# ---------------------------------------------------------------------------
# Cấu hình mặc định
# ---------------------------------------------------------------------------
REPO_URL="${FLORAHUB_REPO:-https://github.com/algodaohub/florahub.git}"
APP_DIR="${FLORAHUB_DIR:-/opt/florahub}"
WEB_PORT="${FLORAHUB_PORT:-3000}"
PB_HOST="127.0.0.1"
PB_PORT="8091"
PB_VERSION="${POCKETBASE_VERSION:-0.22.22}"
NODE_MAJOR="${NODE_MAJOR:-22}"

DOMAIN="${FLORAHUB_DOMAIN:-}"
ADMIN_EMAIL="${ADMIN_EMAILS:-}"
PB_ADMIN_EMAIL="${PB_ADMIN_EMAIL:-admin@florahub.local}"
PB_ADMIN_PASSWORD="${PB_ADMIN_PASSWORD:-}"
STUDIO_KEY="${NUXT_STUDIO_KEY:-}"

say() { printf '\033[1;32m→\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✖\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Kiểm tra môi trường
# ---------------------------------------------------------------------------
[ "$(id -u)" -eq 0 ] || die "Cần chạy bằng root: sudo bash install.sh"
command -v apt-get >/dev/null || die "Chỉ hỗ trợ Ubuntu/Debian (apt-get)."

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64 | amd64) PB_ARCH="amd64" ;;
  aarch64 | arm64) PB_ARCH="arm64" ;;
  *) die "Kiến trúc CPU chưa hỗ trợ: $ARCH" ;;
esac

# ---------------------------------------------------------------------------
# Hỏi thông tin (bỏ qua nếu FLORAHUB_NONINTERACTIVE=1 hoặc đã có biến môi trường)
# ---------------------------------------------------------------------------
ask() { # $1=biến $2=nhãn $3=mặc định
  local cur; eval "cur=\${$1:-}"
  if [ -n "$cur" ]; then return; fi
  if [ "${FLORAHUB_NONINTERACTIVE:-0}" = "1" ]; then eval "$1=\"$3\""; return; fi
  local ans
  read -r -p "$2 [$3]: " ans </dev/tty || true
  eval "$1=\"${ans:-$3}\""
}
ask_required() {
  local cur; eval "cur=\${$1:-}"
  if [ -n "$cur" ]; then return; fi
  if [ "${FLORAHUB_NONINTERACTIVE:-0}" = "1" ]; then die "Thiếu biến $1"; fi
  local ans
  while [ -z "${ans:-}" ]; do read -r -p "$2: " ans </dev/tty || true; done
  eval "$1=\"$ans\""
}
ask_secret() {
  local cur; eval "cur=\${$1:-}"
  if [ -n "$cur" ]; then return; fi
  local ans
  if [ "${FLORAHUB_NONINTERACTIVE:-0}" = "1" ]; then eval "$1=\"$(openssl rand -base64 18)\""; return; fi
  read -r -s -p "$2: " ans </dev/tty; echo
  [ -n "$ans" ] || ans="$(openssl rand -base64 18)"
  eval "$1=\"$ans\""
}

say "FloraHub — cài đặt VPS"
ask        DOMAIN            "Tên miền (bỏ trống nếu chưa có, dùng IP)"   ""
ask_required ADMIN_EMAIL     "Email quản trị (đăng nhập /admin)"          ""
ask        PB_ADMIN_EMAIL    "Email quản trị PocketBase"                  "admin@florahub.local"
ask_secret PB_ADMIN_PASSWORD "Mật khẩu PocketBase (Enter = tạo ngẫu nhiên)" ""
ask_secret STUDIO_KEY        "Khoá Studio (Enter = tạo ngẫu nhiên)"       ""

# ---------------------------------------------------------------------------
# Cài gói hệ thống
# ---------------------------------------------------------------------------
say "Cài gói hệ thống…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git unzip ca-certificates gpg openssl

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  say "Cài Node.js $NODE_MAJOR…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  say "Cài Caddy (HTTPS tự động)…"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# ---------------------------------------------------------------------------
# Lấy mã nguồn
# ---------------------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  say "Cập nhật mã nguồn tại $APP_DIR…"
  git -C "$APP_DIR" pull --ff-only
else
  say "Tải mã nguồn về $APP_DIR…"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ---------------------------------------------------------------------------
# PocketBase binary (Linux)
# ---------------------------------------------------------------------------
if [ ! -x bin/pocketbase ]; then
  say "Tải PocketBase v$PB_VERSION ($PB_ARCH)…"
  mkdir -p bin
  tmp="$(mktemp -d)"
  curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" -o "$tmp/pb.zip"
  unzip -oq "$tmp/pb.zip" -d "$tmp/pb"
  install -m 0755 "$tmp/pb/pocketbase" bin/pocketbase
  rm -rf "$tmp"
fi

# ---------------------------------------------------------------------------
# .env
# ---------------------------------------------------------------------------
say "Ghi cấu hình .env…"
if [ -n "$DOMAIN" ]; then SERVER_URL="https://$DOMAIN"; else SERVER_URL="http://localhost:${WEB_PORT}"; fi
cat > .env <<EOF
POCKETBASE_URL='http://${PB_HOST}:${PB_PORT}'
PB_ADMIN_EMAIL='${PB_ADMIN_EMAIL}'
PB_ADMIN_PASSWORD='${PB_ADMIN_PASSWORD}'
ADMIN_EMAILS='${ADMIN_EMAIL}'
NUXT_STUDIO_KEY='${STUDIO_KEY}'
FLORAHUB_URL='${SERVER_URL}'
AI_PROVIDER='openai'
AI_BASE_URL='https://api.openai.com/v1'
AI_MODEL='gpt-4o-mini'
AI_API_KEY=''
EOF
chmod 600 .env

# ---------------------------------------------------------------------------
# Phụ thuộc Node
# ---------------------------------------------------------------------------
say "Cài phụ thuộc Node (npm ci)…"
npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Tạo admin PocketBase + service
# ---------------------------------------------------------------------------
say "Tạo tài khoản PocketBase…"
mkdir -p pb_data
./bin/pocketbase --dir pb_data admin create "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" >/dev/null 2>&1 || true

say "Tạo service PocketBase…"
cat > /etc/systemd/system/florahub-pocketbase.service <<EOF
[Unit]
Description=FloraHub PocketBase
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=${APP_DIR}/bin/pocketbase serve --http=${PB_HOST}:${PB_PORT} --dir=${APP_DIR}/pb_data
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now florahub-pocketbase

say "Khởi tạo schema + dữ liệu mẫu…"
set -a; . ./.env; set +a
node scripts/setup-pocketbase.mjs
node scripts/sync-pocketbase-locations.mjs
node scripts/sync-pocketbase-ward-rules.mjs

# Tạo tài khoản đăng nhập web cho email quản trị (quyền admin nhờ ADMIN_EMAILS).
say "Tạo tài khoản quản trị web…"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | cut -c1-14)}"
export ADMIN_PASSWORD
node - <<'NODE'
;(async () => {
  const base = String(process.env.POCKETBASE_URL || '').replace(/\/$/, '')
  const email = String(process.env.ADMIN_EMAILS || '').trim().toLowerCase()
  const json = async (path, init) => {
    const res = await fetch(base + path, init)
    return { ok: res.ok, data: await res.json().catch(() => ({})) }
  }
  const auth = await json('/api/admins/auth-with-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: process.env.PB_ADMIN_EMAIL,
      password: process.env.PB_ADMIN_PASSWORD
    })
  })
  if (!auth.data.token) {
    console.log('! Không tạo được tài khoản quản trị (đăng nhập PocketBase thất bại). Tạo thủ công tại /register.')
    return
  }
  const token = auth.data.token
  const filter = encodeURIComponent(`email='${email}'`)
  const existing = await json(`/api/collections/users/records?filter=${filter}&perPage=1`, {
    headers: { Authorization: token }
  })
  if ((existing.data.totalItems || 0) > 0) {
    console.log('→ Tài khoản quản trị đã tồn tại, bỏ qua')
    return
  }
  const created = await json('/api/collections/users/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({
      email,
      password: process.env.ADMIN_PASSWORD,
      passwordConfirm: process.env.ADMIN_PASSWORD,
      first_name: 'Quản',
      last_name: 'trị',
      phone: '0900000000',
      emailVisibility: true,
      verified: true
    })
  })
  console.log(created.ok ? '→ Đã tạo tài khoản quản trị web' : `! Không tạo được tài khoản: ${created.data.message || ''}`)
})().catch((error) => console.log(`! Lỗi tạo tài khoản quản trị: ${error?.message || error}`))
NODE

# ---------------------------------------------------------------------------
# Build web
# ---------------------------------------------------------------------------
say "Build website (có thể mất vài phút)…"
npm run build

say "Tạo service web…"
cat > /etc/systemd/system/florahub-web.service <<EOF
[Unit]
Description=FloraHub web (Nuxt/Nitro)
After=network.target florahub-pocketbase.service
Wants=florahub-pocketbase.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
Environment=NODE_ENV=production
Environment=HOST=${PB_HOST}
Environment=PORT=${WEB_PORT}
Environment=NUXT_STUDIO_KEY=${STUDIO_KEY}
ExecStart=$(command -v node) ${APP_DIR}/.output/server/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now florahub-web

# ---------------------------------------------------------------------------
# Caddy reverse proxy
# ---------------------------------------------------------------------------
say "Cấu hình Caddy…"
if [ -n "$DOMAIN" ]; then
  CADDY_SITE="$DOMAIN"
else
  CADDY_SITE=":80"
fi
cat > /etc/caddy/Caddyfile <<EOF
{
  email ${ADMIN_EMAIL}
}

${CADDY_SITE} {
  encode gzip
  reverse_proxy ${PB_HOST}:${WEB_PORT}
}
EOF
systemctl restart caddy

# ---------------------------------------------------------------------------
# Xong
# ---------------------------------------------------------------------------
PUBLIC_URL="${DOMAIN:+https://$DOMAIN}"
PUBLIC_URL="${PUBLIC_URL:-http://$(hostname -I 2>/dev/null | awk '{print $1}')}"
cat <<EOF

============================================================
 FloraHub đã cài xong
============================================================
 Cửa hàng : ${PUBLIC_URL}
 Quản trị : ${PUBLIC_URL}/admin/login
   Email    : ${ADMIN_EMAIL}
   Mật khẩu : ${ADMIN_PASSWORD}
   (đổi mật khẩu sau khi đăng nhập tại /admin/login)

 PocketBase: http://${PB_HOST}:${PB_PORT} (chỉ nội bộ)
   ${PB_ADMIN_EMAIL} / ${PB_ADMIN_PASSWORD}

 Tài khoản demo (xoá được): demo@florahub.vn / FloraHub1234

 Lệnh hữu ích:
   systemctl status florahub-web florahub-pocketbase caddy
   journalctl -u florahub-web -f
   cd ${APP_DIR} && git pull && npm ci && npm run build && systemctl restart florahub-web

 Bật vận chuyển Goship tại /admin/shipping và thanh toán SePay tại /admin/payments.
EOF
