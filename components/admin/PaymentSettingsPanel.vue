<script setup lang="ts">
type SecretState = { has: boolean; hint: string }

type BankAccount = {
  id: string
  accountNumber: string
  accountHolderName: string
  bankName: string
  bankShortName: string
  active: boolean
}

type PublicSettings = {
  apiToken: SecretState
  apiBaseUrl: string
  webhookApiKey: SecretState
  webhookSecret: SecretState
  pg: {
    merchantId: string
    secretKey: SecretState
    ipnSecret: SecretState
    env: 'sandbox' | 'production'
    publicUrl: string
  }
  bankAccounts: BankAccount[]
  bankAccountsSyncedAt: string
  readiness: { webhook: boolean; api: boolean; hosted: boolean }
}

const form = reactive({
  apiToken: '',
  apiBaseUrl: 'https://my.sepay.vn/userapi',
  webhookApiKey: '',
  webhookSecret: '',
  pgMerchantId: '',
  pgSecretKey: '',
  pgIpnSecret: '',
  pgEnv: 'sandbox' as 'sandbox' | 'production',
  pgPublicUrl: ''
})

const meta = reactive({
  apiToken: { has: false, hint: '' } as SecretState,
  webhookApiKey: { has: false, hint: '' } as SecretState,
  webhookSecret: { has: false, hint: '' } as SecretState,
  pgSecretKey: { has: false, hint: '' } as SecretState,
  pgIpnSecret: { has: false, hint: '' } as SecretState,
  readiness: { webhook: false, api: false, hosted: false },
  bankAccounts: [] as BankAccount[],
  bankAccountsSyncedAt: ''
})

const loading = ref(true)
const busy = ref(false)
const syncing = ref(false)
const message = ref('')
const errorMessage = ref('')

const origin = useRequestURL().origin
const requestFetch = useRequestFetch()

function apply(data: PublicSettings) {
  form.apiBaseUrl = data.apiBaseUrl || 'https://my.sepay.vn/userapi'
  form.apiToken = ''
  form.webhookApiKey = ''
  form.webhookSecret = ''
  form.pgMerchantId = data.pg.merchantId
  form.pgSecretKey = ''
  form.pgIpnSecret = ''
  form.pgEnv = data.pg.env
  form.pgPublicUrl = data.pg.publicUrl
  meta.apiToken = data.apiToken
  meta.webhookApiKey = data.webhookApiKey
  meta.webhookSecret = data.webhookSecret
  meta.pgSecretKey = data.pg.secretKey
  meta.pgIpnSecret = data.pg.ipnSecret
  meta.readiness = data.readiness
  meta.bankAccounts = data.bankAccounts ?? []
  meta.bankAccountsSyncedAt = data.bankAccountsSyncedAt
}

async function load() {
  try {
    apply(await requestFetch<PublicSettings>('/api/admin/payment-settings'))
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không tải được cấu hình thanh toán.'
  } finally {
    loading.value = false
  }
}

await load()

function success(text: string) {
  message.value = text
  setTimeout(() => {
    if (message.value === text) message.value = ''
  }, 3500)
}

async function save() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const data = await $fetch<PublicSettings>('/api/admin/payment-settings', {
      method: 'PUT',
      body: {
        apiBaseUrl: form.apiBaseUrl.trim(),
        apiToken: form.apiToken.trim() || undefined,
        webhookApiKey: form.webhookApiKey.trim() || undefined,
        webhookSecret: form.webhookSecret.trim() || undefined,
        pg: {
          merchantId: form.pgMerchantId.trim(),
          secretKey: form.pgSecretKey.trim() || undefined,
          ipnSecret: form.pgIpnSecret.trim() || undefined,
          env: form.pgEnv,
          publicUrl: form.pgPublicUrl.trim()
        }
      }
    })
    apply(data)
    success('Đã lưu cấu hình thanh toán. Key mới có hiệu lực ngay.')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không lưu được cấu hình thanh toán.'
  } finally {
    busy.value = false
  }
}

async function clearSecret(field: 'apiToken' | 'webhookApiKey' | 'webhookSecret' | 'pgSecretKey' | 'pgIpnSecret') {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const body =
      field === 'pgSecretKey' || field === 'pgIpnSecret'
        ? { pg: { [field === 'pgSecretKey' ? 'secretKey' : 'ipnSecret']: '' } }
        : { [field]: '' }
    apply(
      await $fetch<PublicSettings>('/api/admin/payment-settings', {
        method: 'PUT',
        body
      })
    )
    success('Đã xoá key.')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không xoá được key.'
  } finally {
    busy.value = false
  }
}

async function syncBankAccounts() {
  if (syncing.value) return
  syncing.value = true
  errorMessage.value = ''
  try {
    const data = await $fetch<{
      accounts: BankAccount[]
      syncedAt: string
      readiness: PublicSettings['readiness']
    }>('/api/admin/payment-settings/sync-bank-accounts', { method: 'POST' })
    meta.bankAccounts = data.accounts
    meta.bankAccountsSyncedAt = data.syncedAt
    meta.readiness = data.readiness
    success(`Đã đồng bộ ${data.accounts.length} tài khoản ngân hàng.`)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không đồng bộ được tài khoản ngân hàng.'
  } finally {
    syncing.value = false
  }
}

function secretPlaceholder(state: SecretState, fallback: string) {
  return state.has ? `Đang dùng ${state.hint} — để trống nếu không đổi` : fallback
}

const TABS = computed(() => [
  {
    key: 'api' as const,
    label: 'Cấu hình SePay API',
    hint: 'Webhook & đối soát giao dịch',
    ok: meta.readiness.api && meta.readiness.webhook
  },
  {
    key: 'hosted' as const,
    label: 'Cấu hình cổng SePay',
    hint: 'Thanh toán thẻ/NAPAS (có phí)',
    ok: meta.readiness.hosted
  }
])

const activeTab = ref<'api' | 'hosted'>('api')

const webhookUrl = computed(() => `${origin}/api/webhooks/sepay`)
const ipnUrl = computed(() => `${origin}/api/webhooks/sepay-ipn`)
const copied = ref('')

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    document.body.removeChild(area)
  }
  copied.value = text
  setTimeout(() => {
    if (copied.value === text) copied.value = ''
  }, 2000)
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-4">
    <div>
      <h2 class="text-lg font-semibold">Cấu hình thanh toán</h2>
    </div>

    <div v-if="loading" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
      Đang tải…
    </div>

    <template v-else>
      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 class="text-sm font-semibold">Tài khoản ngân hàng đã liên kết</h3>
            <p class="mt-0.5 text-[11px] text-slate-500">
              <template v-if="meta.bankAccounts.length">
                Nhận tiền VietQR và đối soát giao dịch.
                <template v-if="meta.bankAccountsSyncedAt">
                  Đồng bộ lần cuối {{ formatDateTimeNumeric(meta.bankAccountsSyncedAt) }}.
                </template>
              </template>
              <template v-else>
                Liên kết tài khoản ngân hàng để nhận VietQR và xác nhận thanh toán tự động.
              </template>
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            :disabled="syncing || busy"
            @click="syncBankAccounts"
          >
            {{ syncing ? 'Đang đồng bộ…' : 'Đồng bộ từ SePay' }}
          </button>
        </div>

        <div v-if="meta.bankAccounts.length" class="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
          <div
            v-for="account in meta.bankAccounts"
            :key="account.id || account.accountNumber"
            class="flex items-center justify-between gap-3 px-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-xs font-semibold text-slate-700">{{ account.accountNumber }}</p>
              <p class="truncate text-[11px] text-slate-500">
                {{ account.accountHolderName || '—' }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-slate-500">{{ account.bankShortName || account.bankName }}</span>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                :class="account.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
              >
                {{ account.active ? 'Hoạt động' : 'Tắt' }}
              </span>
            </div>
          </div>
          <div class="flex justify-end px-3 py-2">
            <a
              href="https://my.sepay.vn/bankaccount"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[11px] font-semibold text-emerald-700 hover:underline"
            >
              Quản lý tài khoản tại SePay ↗
            </a>
          </div>
        </div>

        <div
          v-else
          class="mt-3 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 p-4 text-white"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[11px] font-semibold uppercase tracking-wider text-emerald-100">Chưa có tài khoản SePay?</p>
              <p class="mt-0.5 text-sm font-semibold">Mở tài khoản miễn phí để nhận VietQR và xác nhận thanh toán tự động.</p>
              <p class="mt-0.5 text-[11px] text-emerald-100">
                Sau khi đăng ký: liên kết tài khoản ngân hàng, tạo API token và khai báo webhook trong các tab bên dưới.
              </p>
            </div>
            <a
              href="https://my.sepay.vn/register?gcid=361"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              Đăng ký SePay ↗
            </a>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div role="tablist" class="grid gap-2 border-b border-slate-200 p-3 sm:grid-cols-2">
          <button
            v-for="item in TABS"
            :key="item.key"
            type="button"
            role="tab"
            :aria-selected="activeTab === item.key"
            class="rounded-xl border p-3 text-left transition"
            :class="
              activeTab === item.key
                ? 'border-emerald-600 bg-emerald-50 ring-1 ring-inset ring-emerald-600'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            "
            @click="activeTab = item.key"
          >
            <span
              class="flex items-center gap-1.5 text-[11px] font-semibold"
              :class="item.ok ? 'text-emerald-700' : 'text-amber-700'"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="item.ok ? 'bg-emerald-500' : 'bg-amber-400'" />
              {{ item.ok ? 'Sẵn sàng' : 'Chưa cấu hình' }}
            </span>
            <span class="mt-1 block text-sm font-semibold text-slate-800">{{ item.label }}</span>
            <span class="mt-0.5 block text-[11px] leading-snug text-slate-500">{{ item.hint }}</span>
          </button>
        </div>

        <div class="p-4">
          <div v-if="activeTab === 'api'" class="space-y-4">
            <div class="space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">SePay Open API</h4>
                <span
                  class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  :class="meta.readiness.api ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                >
                  {{ meta.readiness.api ? 'Sẵn sàng' : 'Chưa cấu hình' }}
                </span>
              </div>
              <p class="text-xs text-slate-500">
                Dùng để đối soát giao dịch khi webhook trễ hoặc mất, và để đồng bộ tài khoản ngân hàng đã liên kết.
              </p>

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="block sm:col-span-2">
                  <span class="mb-1 block text-xs font-medium text-slate-600">SePay API token</span>
                  <input
                    v-model="form.apiToken"
                    type="password"
                    autocomplete="new-password"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
                    :placeholder="secretPlaceholder(meta.apiToken, 'Dán API token tại my.sepay.vn → API')"
                  />
                  <span v-if="meta.apiToken.has" class="mt-1 inline-block text-[11px] text-slate-400">
                    <button type="button" class="font-medium text-rose-600 hover:underline" @click="clearSecret('apiToken')">
                      Xoá token
                    </button>
                  </span>
                </label>

                <label class="block sm:col-span-2">
                  <span class="mb-1 block text-xs font-medium text-slate-600">API base URL</span>
                  <input
                    v-model="form.apiBaseUrl"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
                    placeholder="https://my.sepay.vn/userapi"
                  />
                </label>
              </div>
            </div>

            <div class="space-y-3 border-t border-slate-100 pt-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Webhook ngân hàng</h4>
                <span
                  class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  :class="meta.readiness.webhook ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
                >
                  {{ meta.readiness.webhook ? 'Sẵn sàng' : 'Chưa cấu hình' }}
                </span>
              </div>
              <p class="text-xs text-slate-500">
                Khách quét QR đúng số tiền + nội dung <code class="rounded bg-slate-100 px-1">ORD-XXXXXX</code>;
                webhook xác nhận đơn ngay khi tiền về. Không phí cổng.
              </p>

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">Webhook API key</span>
                <input
                  v-model="form.webhookApiKey"
                  type="password"
                  autocomplete="new-password"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
                  :placeholder="secretPlaceholder(meta.webhookApiKey, 'Authorization: Apikey <key>')"
                />
                <button
                  v-if="meta.webhookApiKey.has"
                  type="button"
                  class="mt-1 text-[11px] font-medium text-rose-600 hover:underline"
                  @click="clearSecret('webhookApiKey')"
                >
                  Xoá key
                </button>
              </label>

              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">Webhook secret (HMAC)</span>
                <input
                  v-model="form.webhookSecret"
                  type="password"
                  autocomplete="new-password"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
                  :placeholder="secretPlaceholder(meta.webhookSecret, 'Khuyến nghị: dùng chữ ký HMAC')"
                />
                <button
                  v-if="meta.webhookSecret.has"
                  type="button"
                  class="mt-1 text-[11px] font-medium text-rose-600 hover:underline"
                  @click="clearSecret('webhookSecret')"
                >
                  Xoá secret
                </button>
              </label>
            </div>

            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-[11px] font-medium text-slate-500">Webhook URL khai báo tại SePay</p>
                  <code class="mt-0.5 block break-all font-mono text-xs text-slate-800">{{ webhookUrl }}</code>
                </div>
                <div class="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    @click="copyText(webhookUrl)"
                  >
                    {{ copied === webhookUrl ? 'Đã sao chép' : 'Sao chép' }}
                  </button>
                  <a
                    href="https://my.sepay.vn/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                  >
                    Mở trang Webhooks ↗
                  </a>
                </div>
              </div>
              <p class="mt-2 text-[11px] text-slate-500">
                Tại
                <a
                  href="https://my.sepay.vn/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-emerald-700 hover:underline"
                >
                  my.sepay.vn → Webhooks
                </a>
                , chọn <strong>Thêm webhook</strong>, dán URL trên rồi bật xác thực bằng API key hoặc HMAC.
              </p>
            </div>
            </div>
          </div>

          <div v-else class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-xs text-slate-500">
                Thanh toán thẻ quốc tế / NAPAS — ưu tiên cho bán dịch vụ. SePay gọi IPN về server để xác nhận thanh toán.
              </p>
              <span class="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Có phí mỗi giao dịch
              </span>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">Merchant ID</span>
                <input
                  v-model="form.pgMerchantId"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
                  placeholder="SP-..."
                />
              </label>

              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">Môi trường</span>
                <select
                  v-model="form.pgEnv"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </label>

              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">Merchant secret key</span>
                <input
                  v-model="form.pgSecretKey"
                  type="password"
                  autocomplete="new-password"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
                  :placeholder="secretPlaceholder(meta.pgSecretKey, 'spsk_...')"
                />
                <button
                  v-if="meta.pgSecretKey.has"
                  type="button"
                  class="mt-1 text-[11px] font-medium text-rose-600 hover:underline"
                  @click="clearSecret('pgSecretKey')"
                >
                  Xoá secret
                </button>
              </label>

              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">IPN secret (tuỳ chọn)</span>
                <input
                  v-model="form.pgIpnSecret"
                  type="password"
                  autocomplete="new-password"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
                  :placeholder="secretPlaceholder(meta.pgIpnSecret, 'Mặc định dùng merchant secret')"
                />
                <button
                  v-if="meta.pgIpnSecret.has"
                  type="button"
                  class="mt-1 text-[11px] font-medium text-rose-600 hover:underline"
                  @click="clearSecret('pgIpnSecret')"
                >
                  Xoá secret
                </button>
              </label>

              <label class="block sm:col-span-2">
                <span class="mb-1 block text-xs font-medium text-slate-600">Public URL (tuỳ chọn)</span>
                <input
                  v-model="form.pgPublicUrl"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
                  placeholder="https://florahub.vn"
                />
                <span class="mt-1 block text-[11px] text-slate-400">
                  Dùng để tạo return URL khi chạy sau proxy. Để trống sẽ lấy host của request.
                </span>
              </label>
            </div>

            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-[11px] font-medium text-slate-500">IPN URL khai báo tại my.sepay.vn → Cổng thanh toán</p>
                  <code class="mt-0.5 block break-all font-mono text-xs text-slate-800">{{ ipnUrl }}</code>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  @click="copyText(ipnUrl)"
                >
                  {{ copied === ipnUrl ? 'Đã sao chép' : 'Sao chép' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-3 pb-6">
        <button
          type="button"
          class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          :disabled="busy || syncing"
          @click="save"
        >
          {{ busy ? 'Đang lưu…' : 'Lưu cấu hình' }}
        </button>
        <p v-if="message" class="text-xs font-medium text-emerald-700">{{ message }}</p>
        <p v-if="errorMessage" class="text-xs font-medium text-rose-700">{{ errorMessage }}</p>
      </div>
    </template>
  </div>
</template>
