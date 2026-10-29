<script setup lang="ts">
import type { PublicShippingSettings } from '~/types/shipping'

const props = defineProps<{ settings: PublicShippingSettings }>()
const emit = defineEmits<{ updated: [settings: PublicShippingSettings] }>()

const origin = useRequestURL().origin
const webhookUrl = ref(`${origin}/api/webhooks/goship`)
const copied = ref('')
const busy = ref(false)
const message = ref('')
const errorMessage = ref('')

watch(
  () => props.settings.webhook.url,
  (url) => {
    if (url) webhookUrl.value = url
  },
  { immediate: true }
)

const autoAdvance = ref(false)
watch(
  () => props.settings.autoAdvance,
  (value) => {
    autoAdvance.value = value
  },
  { immediate: true }
)

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

async function registerWebhook() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const data = await $fetch<{ webhook: { id: string; url: string }; settings: PublicShippingSettings }>(
      '/api/admin/shipping-settings/register-webhook',
      { method: 'POST', body: { url: webhookUrl.value.trim() } }
    )
    webhookUrl.value = data.webhook.url || webhookUrl.value
    emit('updated', data.settings)
    message.value = 'Đã đăng ký webhook với Goship.'
    setTimeout(() => (message.value = ''), 3500)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không đăng ký được webhook.'
  } finally {
    busy.value = false
  }
}

async function saveAutoAdvance() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    emit(
      'updated',
      await $fetch<PublicShippingSettings>('/api/admin/shipping-settings', {
        method: 'PUT',
        body: { autoAdvance: autoAdvance.value }
      })
    )
    message.value = 'Đã lưu chế độ tự cập nhật trạng thái.'
    setTimeout(() => (message.value = ''), 3500)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không lưu được tuỳ chọn.'
  } finally {
    busy.value = false
  }
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 disabled:bg-slate-50'
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Webhook cập nhật vận đơn</h4>
        <span
          class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          :class="props.settings.readiness.webhook ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
        >
          {{ props.settings.readiness.webhook ? 'Đã đăng ký' : 'Chưa đăng ký' }}
        </span>
      </div>
      <p class="text-[11px] text-slate-500">
        Goship gọi về URL này khi vận đơn đổi trạng thái. Chữ ký HMAC dùng client secret ở tab Kết nối Goship.
      </p>
      <div class="flex gap-2">
        <input v-model="webhookUrl" :class="inputClass" placeholder="https://florahub.vn/api/webhooks/goship" />
        <button
          type="button"
          class="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          @click="copyText(webhookUrl)"
        >
          {{ copied === webhookUrl ? 'Đã sao chép' : 'Sao chép' }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          :disabled="busy"
          @click="registerWebhook"
        >
          {{ busy ? 'Đang đăng ký…' : props.settings.webhook.id ? 'Đăng ký lại' : 'Đăng ký webhook' }}
        </button>
        <span v-if="props.settings.webhook.id" class="font-mono text-[11px] text-slate-400">
          ID: {{ props.settings.webhook.id }}
        </span>
      </div>
    </div>

    <label class="flex items-start gap-2 border-t border-slate-100 pt-4">
      <input v-model="autoAdvance" type="checkbox" class="mt-0.5 h-4 w-4" @change="saveAutoAdvance" />
      <span class="min-w-0">
        <span class="block text-sm font-medium text-slate-700">Tự cập nhật trạng thái đơn theo vận đơn</span>
        <span class="block text-[11px] text-slate-500">
          Chỉ đi theo máy trạng thái hiện có; đơn đã thanh toán không tự hoàn về chờ thanh toán.
        </span>
      </span>
    </label>

    <p v-if="props.settings.lastVerifiedAt" class="text-[11px] text-slate-400">
      Kiểm tra kết nối gần nhất: {{ formatDateTimeNumeric(props.settings.lastVerifiedAt) }}
    </p>

    <p v-if="message" class="text-xs font-medium text-emerald-700">{{ message }}</p>
    <p v-if="errorMessage" class="text-xs font-medium text-rose-700">{{ errorMessage }}</p>
  </div>
</template>
