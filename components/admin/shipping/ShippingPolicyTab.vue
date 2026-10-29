<script setup lang="ts">
import type { PublicShippingSettings } from '~/types/shipping'
import type { StoreShippingPolicy } from '~/types/store'

type Carrier = { code: string; name: string; shortName: string }

const props = defineProps<{ settings: PublicShippingSettings }>()
const emit = defineEmits<{ updated: [settings: PublicShippingSettings] }>()

function parseList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

const form = reactive({
  enabled: true,
  allowCustomerChoice: true,
  autoStrategy: 'cheapest' as StoreShippingPolicy['autoStrategy'],
  preferredCarrier: '',
  maxOptions: 3,
  allowedCarriersText: '',
  blockedCarriersText: '',
  markupPercent: 0,
  freeShippingThreshold: 0,
  fallbackBehavior: 'flat' as StoreShippingPolicy['fallbackBehavior'],
  fallbackFee: 0,
  showEta: true,
  showSuccessRate: false,
  absorbFeeDifference: true
})

watch(
  () => props.settings,
  (settings) => {
    const policy = settings.policy
    form.enabled = policy.enabled
    form.allowCustomerChoice = policy.allowCustomerChoice
    form.autoStrategy = policy.autoStrategy
    form.preferredCarrier = policy.preferredCarrier
    form.maxOptions = policy.maxOptions
    form.allowedCarriersText = policy.allowedCarriers.join(', ')
    form.blockedCarriersText = policy.blockedCarriers.join(', ')
    form.markupPercent = policy.markupPercent
    form.freeShippingThreshold = policy.freeShippingThreshold
    form.fallbackBehavior = policy.fallbackBehavior
    form.fallbackFee = policy.fallbackFee
    form.showEta = policy.showEta
    form.showSuccessRate = policy.showSuccessRate
    form.absorbFeeDifference = policy.absorbFeeDifference
  },
  { immediate: true }
)

const carriers = ref<Carrier[]>([])
const carriersError = ref('')

onMounted(async () => {
  try {
    const data = await $fetch<{ carriers: Carrier[] }>('/api/admin/shipping-settings/carriers')
    carriers.value = data.carriers ?? []
  } catch {
    carriersError.value = 'Chưa tải được danh sách hãng — nhập mã hãng cách nhau bằng dấu phẩy.'
  }
})

function hasCarrier(list: string, code: string) {
  return parseList(list).includes(code)
}

function toggleCarrier(list: 'allowed' | 'blocked', code: string) {
  const current = list === 'allowed' ? form.allowedCarriersText : form.blockedCarriersText
  const items = parseList(current)
  const next = items.includes(code) ? items.filter((item) => item !== code) : [...items, code]
  if (list === 'allowed') form.allowedCarriersText = next.join(', ')
  else form.blockedCarriersText = next.join(', ')
}

const busy = ref(false)
const message = ref('')
const errorMessage = ref('')

async function save() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const data = await $fetch<{ policy: StoreShippingPolicy }>('/api/admin/shipping-settings/policy', {
      method: 'PUT',
      body: {
        enabled: form.enabled,
        allowCustomerChoice: form.allowCustomerChoice,
        autoStrategy: form.autoStrategy,
        preferredCarrier: form.preferredCarrier.trim().toLowerCase(),
        maxOptions: form.maxOptions,
        allowedCarriers: parseList(form.allowedCarriersText),
        blockedCarriers: parseList(form.blockedCarriersText),
        markupPercent: form.markupPercent,
        freeShippingThreshold: form.freeShippingThreshold,
        fallbackBehavior: form.fallbackBehavior,
        fallbackFee: form.fallbackFee,
        showEta: form.showEta,
        showSuccessRate: form.showSuccessRate,
        absorbFeeDifference: form.absorbFeeDifference
      }
    })
    emit('updated', {
      ...props.settings,
      policy: { ...props.settings.policy, ...data.policy },
      readiness: { ...props.settings.readiness, policy: data.policy.enabled }
    })
    message.value = 'Đã lưu chính sách vận chuyển.'
    setTimeout(() => (message.value = ''), 3500)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không lưu được chính sách vận chuyển.'
  } finally {
    busy.value = false
  }
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 disabled:bg-slate-50'
</script>

<template>
  <div class="space-y-4">
    <label class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <input v-model="form.enabled" type="checkbox" class="mt-0.5 h-4 w-4" />
      <span class="min-w-0">
        <span class="block text-sm font-semibold text-slate-800">Bật phí vận chuyển động</span>
        <span class="mt-0.5 block text-[11px] text-slate-500">
          Khi tắt, cửa hàng luôn dùng phí dự phòng bên dưới thay vì gọi Goship.
        </span>
      </span>
    </label>

    <label class="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <input v-model="form.allowCustomerChoice" type="checkbox" class="mt-0.5 h-4 w-4" />
      <span class="min-w-0">
        <span class="block text-sm font-semibold text-slate-800">Cho phép khách chọn vận chuyển</span>
        <span class="mt-0.5 block text-[11px] text-slate-500">
          Bật: khách chọn hãng/dịch vụ ở checkout. Tắt: hệ thống tự chọn theo chiến lược bên dưới.
        </span>
      </span>
    </label>

    <div v-if="!form.allowCustomerChoice" class="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Chiến lược tự chọn</span>
        <select v-model="form.autoStrategy" :class="inputClass">
          <option value="cheapest">Rẻ nhất</option>
          <option value="fastest">Nhanh nhất</option>
          <option value="preferred">Hãng ưu tiên</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Hãng ưu tiên</span>
        <input v-model="form.preferredCarrier" :class="inputClass" placeholder="vd: ghn, ghtk, vtp" />
      </label>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Số phương án tối đa</span>
        <input v-model.number="form.maxOptions" type="number" min="1" max="8" :class="inputClass" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Phụ phí trên cước hãng (%)</span>
        <input v-model.number="form.markupPercent" type="number" min="0" max="100" :class="inputClass" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Ngưỡng miễn phí giao (₫)</span>
        <input v-model.number="form.freeShippingThreshold" type="number" min="0" :class="inputClass" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Phí dự phòng (₫)</span>
        <input v-model.number="form.fallbackFee" type="number" min="0" :class="inputClass" />
      </label>
    </div>

    <div class="space-y-2 border-t border-slate-100 pt-4">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Hãng cho phép</h4>
      <div v-if="carriers.length" class="flex flex-wrap gap-2">
        <button
          v-for="carrier in carriers"
          :key="carrier.code"
          type="button"
          class="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
          :class="
            hasCarrier(form.allowedCarriersText, carrier.code)
              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          "
          @click="toggleCarrier('allowed', carrier.code)"
        >
          {{ carrier.shortName || carrier.name }}
        </button>
      </div>
      <input v-else v-model="form.allowedCarriersText" :class="inputClass" placeholder="Để trống = tất cả hãng" />
      <p class="text-[11px] text-slate-500">Để trống nghĩa là cho phép mọi hãng Goship trả về.</p>
    </div>

    <div class="space-y-2">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Hãng chặn</h4>
      <div v-if="carriers.length" class="flex flex-wrap gap-2">
        <button
          v-for="carrier in carriers"
          :key="carrier.code"
          type="button"
          class="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
          :class="
            hasCarrier(form.blockedCarriersText, carrier.code)
              ? 'border-rose-500 bg-rose-50 text-rose-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          "
          @click="toggleCarrier('blocked', carrier.code)"
        >
          {{ carrier.shortName || carrier.name }}
        </button>
      </div>
      <input v-else v-model="form.blockedCarriersText" :class="inputClass" placeholder="vd: ghtk, vtp" />
      <p v-if="carriersError" class="text-[11px] text-amber-700">{{ carriersError }}</p>
    </div>

    <div class="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Khi không báo giá được</span>
        <select v-model="form.fallbackBehavior" :class="inputClass">
          <option value="flat">Dùng phí dự phòng</option>
          <option value="block">Chặn đặt hàng</option>
        </select>
      </label>
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="form.showEta" type="checkbox" class="h-4 w-4" />
          Hiển thị thời gian giao dự kiến
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="form.showSuccessRate" type="checkbox" class="h-4 w-4" />
          Hiển thị tỷ lệ giao thành công
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="form.absorbFeeDifference" type="checkbox" class="h-4 w-4" />
          Shop chịu phần cước chênh lệch
        </label>
      </div>
    </div>

    <p class="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
      Phí giao cố định và ngưỡng freeship cũ đã chuyển vào đây. Checkout luôn lấy phí từ báo giá máy chủ.
    </p>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        :disabled="busy"
        @click="save"
      >
        {{ busy ? 'Đang lưu…' : 'Lưu chính sách' }}
      </button>
      <p v-if="message" class="text-xs font-medium text-emerald-700">{{ message }}</p>
      <p v-if="errorMessage" class="text-xs font-medium text-rose-700">{{ errorMessage }}</p>
    </div>
  </div>
</template>
