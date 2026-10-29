<script setup lang="ts">
import type { PublicShippingSettings } from '~/types/shipping'
import { GOSHIP_BASE_URLS, secretPlaceholder } from '~/utils/shipping-admin'

const props = defineProps<{ settings: PublicShippingSettings }>()
const emit = defineEmits<{ updated: [settings: PublicShippingSettings] }>()

const form = reactive({
  enabled: false,
  apiBaseUrl: '',
  accessToken: '',
  clientId: '',
  clientSecret: ''
})

watch(
  () => props.settings,
  (settings) => {
    form.enabled = settings.enabled
    form.apiBaseUrl = settings.apiBaseUrl
    form.clientId = settings.clientId
    form.accessToken = ''
    form.clientSecret = ''
  },
  { immediate: true }
)

const busy = ref(false)
const message = ref('')
const errorMessage = ref('')

async function save() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const data = await $fetch<PublicShippingSettings>('/api/admin/shipping-settings', {
      method: 'PUT',
      body: {
        enabled: form.enabled,
        apiBaseUrl: form.apiBaseUrl.trim(),
        accessToken: form.accessToken.trim() || undefined,
        clientId: form.clientId.trim(),
        clientSecret: form.clientSecret.trim() || undefined
      }
    })
    emit('updated', data)
    message.value = 'Đã lưu cấu hình kết nối Goship.'
    setTimeout(() => (message.value = ''), 3500)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không lưu được cấu hình Goship.'
  } finally {
    busy.value = false
  }
}

async function clearSecret(field: 'accessToken' | 'clientSecret') {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    emit(
      'updated',
      await $fetch<PublicShippingSettings>('/api/admin/shipping-settings', {
        method: 'PUT',
        body: { [field]: '' }
      })
    )
    message.value = 'Đã xoá key.'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không xoá được key.'
  } finally {
    busy.value = false
  }
}

function useBaseUrl(value: string) {
  form.apiBaseUrl = value
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600'
</script>

<template>
  <div class="space-y-4">
    <label class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <input v-model="form.enabled" type="checkbox" class="mt-0.5 h-4 w-4" />
      <span class="min-w-0">
        <span class="block text-sm font-semibold text-slate-800">Bật tính phí vận chuyển Goship</span>
        <span class="mt-0.5 block text-[11px] text-slate-500">
          Tắt để cửa hàng dùng phí dự phòng. Cần bật cùng token và địa chỉ lấy hàng để báo giá trực tiếp.
        </span>
      </span>
    </label>

    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block sm:col-span-2">
        <span class="mb-1 block text-xs font-medium text-slate-600">Goship API base URL</span>
        <input v-model="form.apiBaseUrl" :class="inputClass" placeholder="https://sandbox.goship.io/api/v2" />
        <span class="mt-1 flex gap-2">
          <button
            type="button"
            class="rounded-full border border-slate-300 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
            @click="useBaseUrl(GOSHIP_BASE_URLS.sandbox)"
          >
            Sandbox
          </button>
          <button
            type="button"
            class="rounded-full border border-slate-300 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
            @click="useBaseUrl(GOSHIP_BASE_URLS.production)"
          >
            Production
          </button>
        </span>
      </label>

      <label class="block sm:col-span-2">
        <span class="mb-1 block text-xs font-medium text-slate-600">Access token</span>
        <input
          v-model="form.accessToken"
          type="password"
          autocomplete="new-password"
          :class="inputClass"
          :placeholder="secretPlaceholder(props.settings.accessToken, 'Dán token trong dashboard Goship → API')"
        />
        <button
          v-if="props.settings.accessToken.has"
          type="button"
          class="mt-1 text-[11px] font-medium text-rose-600 hover:underline"
          @click="clearSecret('accessToken')"
        >
          Xoá token
        </button>
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Client ID (tuỳ chọn)</span>
        <input v-model="form.clientId" :class="inputClass" placeholder="Goship client id" />
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Client secret (HMAC webhook)</span>
        <input
          v-model="form.clientSecret"
          type="password"
          autocomplete="new-password"
          :class="inputClass"
          :placeholder="secretPlaceholder(props.settings.clientSecret, 'Dùng để xác thực webhook')"
        />
        <button
          v-if="props.settings.clientSecret.has"
          type="button"
          class="mt-1 text-[11px] font-medium text-rose-600 hover:underline"
          @click="clearSecret('clientSecret')"
        >
          Xoá secret
        </button>
      </label>
    </div>

    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
      Lấy access token trong dashboard Goship. Môi trường production cần liên hệ
      <a href="https://doc.goship.io/" target="_blank" rel="noopener noreferrer" class="font-semibold text-emerald-700 hover:underline">
        tài liệu Goship ↗
      </a>
      để được cấp quyền. Token/secret chỉ lưu trong PocketBase và không bao giờ trả lại trình duyệt.
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        :disabled="busy"
        @click="save"
      >
        {{ busy ? 'Đang lưu…' : 'Lưu kết nối' }}
      </button>
      <p v-if="message" class="text-xs font-medium text-emerald-700">{{ message }}</p>
      <p v-if="errorMessage" class="text-xs font-medium text-rose-700">{{ errorMessage }}</p>
    </div>
  </div>
</template>
