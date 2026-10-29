<script setup lang="ts">
import type { PublicShippingSettings } from '~/types/shipping'

const requestFetch = useRequestFetch()

const settings = ref<PublicShippingSettings | null>(null)
const loading = ref(true)
const testing = ref(false)
const message = ref('')
const errorMessage = ref('')

async function load() {
  try {
    settings.value = await requestFetch<PublicShippingSettings>('/api/admin/shipping-settings')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không tải được cấu hình vận chuyển.'
  } finally {
    loading.value = false
  }
}

await load()

function apply(next: PublicShippingSettings) {
  settings.value = next
}

function success(text: string) {
  message.value = text
  setTimeout(() => {
    if (message.value === text) message.value = ''
  }, 3500)
}

async function testConnection() {
  if (testing.value) return
  testing.value = true
  errorMessage.value = ''
  try {
    const data = await $fetch<{ ok: boolean; cityCount: number; settings: PublicShippingSettings }>(
      '/api/admin/shipping-settings/test',
      { method: 'POST' }
    )
    apply(data.settings)
    success(`Kết nối Goship thành công — ${data.cityCount} tỉnh/thành.`)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không kết nối được Goship. Kiểm tra token ở tab Kết nối.'
  } finally {
    testing.value = false
  }
}

const readinessDots = computed(() => {
  const readiness = settings.value?.readiness
  return [
    { key: 'api', label: 'API', ok: Boolean(readiness?.api) },
    { key: 'webhook', label: 'Webhook', ok: Boolean(readiness?.webhook) },
    { key: 'pickup', label: 'Địa chỉ lấy hàng', ok: Boolean(readiness?.pickup) },
    { key: 'policy', label: 'Chính sách', ok: Boolean(readiness?.policy) }
  ]
})

const TABS = computed(() => {
  const readiness = settings.value?.readiness
  return [
    {
      key: 'connection' as const,
      label: 'Kết nối Goship',
      hint: 'Token, client secret, môi trường API',
      ok: Boolean(readiness?.api)
    },
    {
      key: 'pickup' as const,
      label: 'Lấy hàng & đóng gói',
      hint: 'Địa chỉ lấy hàng, cân nặng, COD',
      ok: Boolean(readiness?.pickup)
    },
    {
      key: 'policy' as const,
      label: 'Chính sách cửa hàng',
      hint: 'Giá, freeship, khách tự chọn',
      ok: Boolean(readiness?.policy)
    },
    {
      key: 'webhook' as const,
      label: 'Webhook & đồng bộ',
      hint: 'Tự cập nhật vận đơn, danh mục',
      ok: Boolean(readiness?.webhook)
    }
  ]
})

const activeTab = ref<'connection' | 'pickup' | 'policy' | 'webhook'>('connection')
</script>

<template>
  <div class="mx-auto w-full max-w-4xl space-y-4">
    <div>
      <h2 class="text-lg font-semibold">Cấu hình vận chuyển</h2>
      <p class="mt-0.5 text-xs text-slate-500">
        Báo giá trực tiếp từ Goship, khách chọn hoặc cửa hàng tự chọn hãng vận chuyển.
      </p>
    </div>

    <div v-if="loading" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
      Đang tải…
    </div>

    <template v-else-if="settings">
      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold">Trạng thái kết nối</h3>
            <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              <span
                v-for="dot in readinessDots"
                :key="dot.key"
                class="flex items-center gap-1.5 text-[11px] font-medium"
                :class="dot.ok ? 'text-emerald-700' : 'text-slate-400'"
              >
                <span class="h-1.5 w-1.5 rounded-full" :class="dot.ok ? 'bg-emerald-500' : 'bg-slate-300'" />
                {{ dot.label }}
              </span>
            </div>
          </div>
          <button
            type="button"
            class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            :disabled="testing"
            @click="testConnection"
          >
            {{ testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối' }}
          </button>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div role="tablist" class="grid gap-2 border-b border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <AdminShippingConnectionTab v-show="activeTab === 'connection'" :settings="settings" @updated="apply" />
          <AdminShippingPickupTab v-show="activeTab === 'pickup'" :settings="settings" @updated="apply" />
          <AdminShippingPolicyTab v-show="activeTab === 'policy'" :settings="settings" @updated="apply" />
          <AdminShippingWebhookTab v-show="activeTab === 'webhook'" :settings="settings" @updated="apply" />
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-3 pb-6">
        <p v-if="message" class="text-xs font-medium text-emerald-700">{{ message }}</p>
        <p v-if="errorMessage" class="text-xs font-medium text-rose-700">{{ errorMessage }}</p>
      </div>
    </template>
  </div>
</template>
