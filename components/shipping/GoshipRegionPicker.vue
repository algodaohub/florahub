<script setup lang="ts">
import type { GoshipRegionValue } from '~/types/shipping'

type GoshipLocation = { code: string; name: string; parentCode?: string }

const model = defineModel<GoshipRegionValue>({ required: true })

const cities = ref<GoshipLocation[]>([])
const districts = ref<GoshipLocation[]>([])
const wards = ref<GoshipLocation[]>([])
const loadingCities = ref(false)
const loadingDistricts = ref(false)
const loadingWards = ref(false)
const error = ref('')

function withCurrent(options: GoshipLocation[], code: string, name: string) {
  if (!code || options.some((item) => item.code === code)) return options
  return [{ code, name: `${name || code} (không có trong danh mục)` }, ...options]
}

const cityOptions = computed(() => withCurrent(cities.value, model.value.cityCode, model.value.cityName))
const districtOptions = computed(() => withCurrent(districts.value, model.value.districtCode, model.value.districtName))
const wardOptions = computed(() => withCurrent(wards.value, model.value.wardCode, model.value.wardName))

async function fetchLocations(type: 'cities' | 'districts' | 'wards', key: string) {
  const data = await $fetch<{ items: GoshipLocation[] }>('/api/shipping/locations', {
    query: type === 'cities' ? { type } : type === 'districts' ? { type, city: key } : { type, district: key }
  })
  return data.items ?? []
}

function reason(error: unknown, fallback: string) {
  const server = (error as any)?.data?.statusMessage || (error as any)?.statusMessage
  return server ? `${fallback} ${server}` : fallback
}

async function loadCities() {
  loadingCities.value = true
  error.value = ''
  try {
    cities.value = await fetchLocations('cities', '')
  } catch (cause) {
    error.value = reason(cause, 'Không tải được danh mục tỉnh/thành của Goship.')
  } finally {
    loadingCities.value = false
  }
}

async function loadDistricts(cityCode: string) {
  districts.value = []
  wards.value = []
  if (!cityCode) return
  loadingDistricts.value = true
  error.value = ''
  try {
    districts.value = await fetchLocations('districts', cityCode)
  } catch (cause) {
    error.value = reason(cause, 'Không tải được danh mục quận/huyện.')
  } finally {
    loadingDistricts.value = false
  }
}

async function loadWards(districtCode: string) {
  wards.value = []
  if (!districtCode) return
  loadingWards.value = true
  error.value = ''
  try {
    wards.value = await fetchLocations('wards', districtCode)
  } catch (cause) {
    error.value = reason(cause, 'Không tải được danh mục phường/xã.')
  } finally {
    loadingWards.value = false
  }
}

async function retry() {
  await loadCities()
  if (error.value) return
  if (model.value.cityCode) await loadDistricts(model.value.cityCode)
  if (!error.value && model.value.districtCode) await loadWards(model.value.districtCode)
}

async function handleCity(code: string) {
  error.value = ''
  const city = cities.value.find((item) => item.code === code) ?? null
  model.value = {
    cityCode: code,
    cityName: city?.name ?? '',
    districtCode: '',
    districtName: '',
    wardCode: '',
    wardName: ''
  }
  await loadDistricts(code)
}

async function handleDistrict(code: string) {
  error.value = ''
  const district = districts.value.find((item) => item.code === code) ?? null
  model.value = {
    ...model.value,
    districtCode: code,
    districtName: district?.name ?? '',
    wardCode: '',
    wardName: ''
  }
  await loadWards(code)
}

function handleWard(code: string) {
  const ward = wards.value.find((item) => item.code === code) ?? null
  model.value = { ...model.value, wardCode: code, wardName: ward?.name ?? '' }
}

onMounted(async () => {
  await loadCities()
  if (model.value.cityCode) await loadDistricts(model.value.cityCode)
  if (model.value.districtCode) await loadWards(model.value.districtCode)
})

function selectClass() {
  return 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 disabled:bg-slate-50 disabled:text-slate-400'
}
</script>

<template>
  <div class="space-y-3">
    <div class="grid gap-3 sm:grid-cols-3">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Tỉnh / thành phố</span>
        <select
          :value="model.cityCode"
          :class="selectClass()"
          :disabled="loadingCities"
          @change="handleCity(($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ loadingCities ? 'Đang tải…' : 'Chọn tỉnh/thành' }}</option>
          <option v-for="item in cityOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
        </select>
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Quận / huyện</span>
        <select
          :value="model.districtCode"
          :class="selectClass()"
          :disabled="!model.cityCode || loadingDistricts"
          @change="handleDistrict(($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            {{ !model.cityCode ? 'Chọn tỉnh trước' : loadingDistricts ? 'Đang tải…' : 'Chọn quận/huyện' }}
          </option>
          <option v-for="item in districtOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
        </select>
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600">Phường / xã</span>
        <select
          :value="model.wardCode"
          :class="selectClass()"
          :disabled="!model.districtCode || loadingWards"
          @change="handleWard(($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            {{ !model.districtCode ? 'Chọn quận/huyện trước' : loadingWards ? 'Đang tải…' : 'Chọn phường/xã' }}
          </option>
          <option v-for="item in wardOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
        </select>
      </label>
    </div>
    <div v-if="error" class="flex flex-wrap items-center gap-2">
      <p class="text-[11px] text-rose-600">{{ error }}</p>
      <button
        type="button"
        class="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        :disabled="loadingCities || loadingDistricts || loadingWards"
        @click="retry"
      >
        Thử lại
      </button>
    </div>
  </div>
</template>
