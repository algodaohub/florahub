<script setup lang="ts">
import type { GoshipRegionValue, PublicShippingSettings } from '~/types/shipping'

const props = defineProps<{ settings: PublicShippingSettings }>()
const emit = defineEmits<{ updated: [settings: PublicShippingSettings] }>()

const form = reactive({
  pickup: {
    name: '',
    phone: '',
    street: '',
    city: '',
    cityCode: '',
    district: '',
    districtCode: '',
    ward: '',
    wardCode: ''
  },
  parcel: {
    defaultWeight: 500,
    defaultItemWeight: 300,
    packagingWeight: 100,
    length: 20,
    width: 15,
    height: 10
  },
  codEnabled: false,
  quoteTtlSeconds: 900,
  rateCacheSeconds: 600,
  quoteRateLimitPerMinute: 20,
  addressFallback: 'ask_district' as 'flat' | 'ask_district' | 'block'
})

watch(
  () => props.settings,
  (settings) => {
    Object.assign(form.pickup, settings.pickup)
    Object.assign(form.parcel, settings.parcel)
    form.codEnabled = settings.codEnabled
    form.quoteTtlSeconds = settings.quoteTtlSeconds
    form.rateCacheSeconds = settings.rateCacheSeconds
    form.quoteRateLimitPerMinute = settings.quoteRateLimitPerMinute
    form.addressFallback = settings.addressFallback
  },
  { immediate: true }
)

const region = computed<GoshipRegionValue>({
  get: () => ({
    cityCode: form.pickup.cityCode,
    cityName: form.pickup.city,
    districtCode: form.pickup.districtCode,
    districtName: form.pickup.district,
    wardCode: form.pickup.wardCode,
    wardName: form.pickup.ward
  }),
  set: (value) => {
    form.pickup.cityCode = value.cityCode
    form.pickup.city = value.cityName
    form.pickup.districtCode = value.districtCode
    form.pickup.district = value.districtName
    form.pickup.wardCode = value.wardCode
    form.pickup.ward = value.wardName
  }
})

const busy = ref(false)
const message = ref('')
const errorMessage = ref('')

/** Token vừa được lưu ở tab Kết nối → mount lại picker để tải danh mục thay vì giữ lỗi cũ. */
const regionPickerKey = computed(() => (props.settings.accessToken.has ? 'with-token' : 'no-token'))

async function save() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const data = await $fetch<PublicShippingSettings>('/api/admin/shipping-settings', {
      method: 'PUT',
      body: {
        pickup: { ...form.pickup },
        parcel: { ...form.parcel },
        codEnabled: form.codEnabled,
        quoteTtlSeconds: form.quoteTtlSeconds,
        rateCacheSeconds: form.rateCacheSeconds,
        quoteRateLimitPerMinute: form.quoteRateLimitPerMinute,
        addressFallback: form.addressFallback
      }
    })
    emit('updated', data)
    message.value = 'Đã lưu địa chỉ lấy hàng và cấu hình đóng gói.'
    setTimeout(() => (message.value = ''), 3500)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không lưu được cấu hình lấy hàng.'
  } finally {
    busy.value = false
  }
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 disabled:bg-slate-50'
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-3">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Địa chỉ lấy hàng</h4>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Tên người gửi</span>
          <input v-model="form.pickup.name" :class="inputClass" placeholder="Tên cửa hàng / người gửi" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Số điện thoại</span>
          <input v-model="form.pickup.phone" :class="inputClass" inputmode="tel" placeholder="09xx xxx xxx" />
        </label>
      </div>
      <ShippingGoshipRegionPicker :key="regionPickerKey" v-model="region" />
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Số nhà, tên đường</span>
        <input v-model="form.pickup.street" :class="inputClass" placeholder="Số nhà, đường, ghi chú lấy hàng" />
      </label>
      <p class="text-[11px] text-slate-500">
        Cần đủ tỉnh/quận/phường và số nhà để Goship báo giá và tạo vận đơn.
      </p>
    </div>

    <div class="space-y-3 border-t border-slate-100 pt-4">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Đóng gói & cân nặng</h4>
      <div class="grid gap-3 sm:grid-cols-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Cân nặng mặc định (g)</span>
          <input v-model.number="form.parcel.defaultWeight" type="number" min="1" :class="inputClass" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Cân nặng mỗi món (g)</span>
          <input v-model.number="form.parcel.defaultItemWeight" type="number" min="1" :class="inputClass" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Bao bì cộng thêm (g)</span>
          <input v-model.number="form.parcel.packagingWeight" type="number" min="0" :class="inputClass" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Dài (cm)</span>
          <input v-model.number="form.parcel.length" type="number" min="1" :class="inputClass" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Rộng (cm)</span>
          <input v-model.number="form.parcel.width" type="number" min="1" :class="inputClass" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Cao (cm)</span>
          <input v-model.number="form.parcel.height" type="number" min="1" :class="inputClass" />
        </label>
      </div>
      <p class="text-[11px] text-slate-500">
        Cân tính phí = max(cân thực tế + bao bì, D×R×C/6000). Sản phẩm chưa khai báo cân nặng dùng mức mỗi món.
      </p>
    </div>

    <div class="space-y-3 border-t border-slate-100 pt-4">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Tuỳ chọn</h4>
      <label class="flex items-start gap-2">
        <input v-model="form.codEnabled" type="checkbox" class="mt-0.5 h-4 w-4" />
        <span class="min-w-0">
          <span class="block text-sm font-medium text-slate-700">Cho phép thanh toán COD</span>
          <span class="block text-[11px] text-slate-500">Cước COD được cộng vào phí báo giá khi khách chọn COD.</span>
        </span>
      </label>

      <div class="grid gap-3 sm:grid-cols-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Hiệu lực báo giá (giây)</span>
          <input v-model.number="form.quoteTtlSeconds" type="number" min="60" :class="inputClass" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Cache cước (giây)</span>
          <input v-model.number="form.rateCacheSeconds" type="number" min="0" :class="inputClass" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Giới hạn báo giá / phút</span>
          <input v-model.number="form.quoteRateLimitPerMinute" type="number" min="1" :class="inputClass" />
        </label>
      </div>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Khi không xác định được địa chỉ</span>
        <select v-model="form.addressFallback" :class="inputClass">
          <option value="ask_district">Hỏi khách chọn quận/huyện</option>
          <option value="flat">Dùng phí dự phòng</option>
          <option value="block">Chặn đặt hàng</option>
        </select>
      </label>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        :disabled="busy"
        @click="save"
      >
        {{ busy ? 'Đang lưu…' : 'Lưu cấu hình' }}
      </button>
      <p v-if="message" class="text-xs font-medium text-emerald-700">{{ message }}</p>
      <p v-if="errorMessage" class="text-xs font-medium text-rose-700">{{ errorMessage }}</p>
    </div>
  </div>
</template>
