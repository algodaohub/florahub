<script setup lang="ts">
import type { VietnamWard } from '~/types'

const props = withDefaults(
  defineProps<{
    city: string
    ward: string
    cityCode?: string
    wardCode?: string
    required?: boolean
    dense?: boolean
    idPrefix?: string
  }>(),
  { required: false, dense: false, idPrefix: 'region', cityCode: '', wardCode: '' }
)

const emit = defineEmits<{
  'update:city': [value: string]
  'update:ward': [value: string]
  'update:cityCode': [value: string]
  'update:wardCode': [value: string]
}>()

const {
  provinces,
  pending,
  pendingWards,
  ensureProvinces,
  loadWards,
  findProvinceByName,
  findWardByName
} = useVietnamLocations()

const provinceCode = ref('')
const wardCode = ref('')
const wards = ref<VietnamWard[]>([])
const provinceError = ref(false)
const wardError = ref(false)
const wardPicker = ref<{ open: (query?: string) => void } | null>(null)

const provinceId = computed(() => `${props.idPrefix}-province`)
const wardId = computed(() => `${props.idPrefix}-ward`)
const loadingWards = computed(
  () => Boolean(provinceCode.value) && pendingWards.value === Number(provinceCode.value)
)
const legacyCity = computed(() => Boolean(props.city) && Boolean(provinces.value.length) && !provinceCode.value)
const legacyWard = computed(
  () => Boolean(provinceCode.value) && Boolean(props.ward) && wards.value.length > 0 && !wardCode.value
)

async function loadProvinceOptions() {
  provinceError.value = false
  try {
    await ensureProvinces()
  } catch {
    provinceError.value = true
  }
}

async function fetchWards(code: number) {
  wardError.value = false
  try {
    return await loadWards(code)
  } catch {
    wardError.value = true
    return []
  }
}

function resetRegion() {
  provinceCode.value = ''
  wardCode.value = ''
  wards.value = []
}

function emitCodes() {
  emit('update:cityCode', provinceCode.value)
  emit('update:wardCode', wardCode.value)
}

const provinceOptions = computed(() =>
  provinces.value.map((province) => ({ code: province.code, name: province.name }))
)

const wardOptions = computed(() =>
  wards.value.map((ward) => ({ code: ward.code, name: ward.name }))
)

const provinceName = computed(
  () => provinces.value.find((item) => String(item.code) === provinceCode.value)?.name ?? ''
)

async function syncFromProps() {
  // Luôn nạp danh mục tỉnh/thành, kể cả khi đang thêm địa chỉ mới (city rỗng).
  if (!provinces.value.length) await loadProvinceOptions()

  if (!props.city) {
    resetRegion()
    emitCodes()
    return
  }

  const province =
    (props.cityCode && provinces.value.find((item) => String(item.code) === String(props.cityCode))) ||
    findProvinceByName(props.city)
  if (!province) {
    resetRegion()
    emitCodes()
    return
  }

  const code = String(province.code)
  if (provinceCode.value !== code) {
    provinceCode.value = code
    wards.value = []
    wardCode.value = ''
  }
  if (!wards.value.length) {
    const loaded = await fetchWards(province.code)
    if (provinceCode.value === code) wards.value = loaded
  }
  const ward =
    (props.wardCode && wards.value.find((item) => String(item.code) === String(props.wardCode))) ||
    findWardByName(wards.value, props.ward)
  wardCode.value = ward ? String(ward.code) : ''
  emitCodes()
}

async function handleProvinceSelect(value: string, query = '') {
  provinceCode.value = value
  const province = provinces.value.find((item) => String(item.code) === value) ?? null
  wardCode.value = ''
  wards.value = []
  wardError.value = false
  emit('update:city', province?.name ?? '')
  emit('update:ward', '')
  emit('update:cityCode', value)
  emit('update:wardCode', '')
  if (!province) return
  const loaded = await fetchWards(province.code)
  if (provinceCode.value !== value) return
  wards.value = loaded
  if (!loaded.length) return

  // Chuyển thẳng sang bước chọn phường/xã, giữ lại từ khoá nếu nó khớp
  // (vd: gõ "sai gon" → chọn TP.HCM → sheet phường/xã đã lọc sẵn "Sài Gòn").
  const keyword = loaded.some((ward) => matchesLocationQuery(ward.name, query)) ? query : ''
  // Chờ sheet tỉnh đóng hẳn để hai lớp chuyển cảnh không chồng nhau.
  await new Promise((resolve) => setTimeout(resolve, 220))
  if (provinceCode.value !== value) return
  wardPicker.value?.open(keyword)
}

function handleWardSelect(value: string) {
  wardCode.value = value
  const ward = wards.value.find((item) => String(item.code) === value) ?? null
  emit('update:ward', ward?.name ?? '')
  emit('update:wardCode', value)
}

async function retryProvinces() {
  await loadProvinceOptions()
  await syncFromProps()
}

async function retryWards() {
  if (!provinceCode.value) return
  const code = Number(provinceCode.value)
  const loaded = await fetchWards(code)
  if (Number(provinceCode.value) === code) wards.value = loaded
}

onMounted(syncFromProps)
watch(() => [props.city, props.ward], syncFromProps)
</script>

<template>
  <div class="space-y-3">
    <div>
      <span :id="provinceId + '-label'" class="mb-1 block font-medium text-muted" :class="dense ? 't-micro' : 't-meta'">
        Tỉnh / thành phố
        <span v-if="required" class="text-discount">*</span>
      </span>
      <RegionPicker
        :id="provinceId"
        :labelledby="provinceId + '-label'"
        :model-value="provinceCode"
        :options="provinceOptions"
        :loading="pending && !provinces.length"
        :disabled="pending && !provinces.length"
        :dense="dense"
        title="Chọn tỉnh / thành phố"
        placeholder="Chọn tỉnh / thành phố"
        search-placeholder="Tìm tỉnh / thành phố (vd: hcm, ha noi)"
        empty-text="Không tìm thấy tỉnh / thành phố phù hợp"
        @select="handleProvinceSelect"
      />
      <p v-if="provinceError && !provinces.length" class="mt-1 t-micro text-discount">
        Không tải được danh mục tỉnh/thành.
        <button type="button" class="font-medium underline underline-offset-2" @click="retryProvinces">
          Thử lại
        </button>
      </p>
      <p v-if="legacyCity" class="mt-1 t-micro text-muted">
        Đang dùng: <span class="font-medium text-ink/80">{{ city }}</span> — chọn lại theo danh mục mới.
      </p>
    </div>

    <div>
      <span :id="wardId + '-label'" class="mb-1 block font-medium text-muted" :class="dense ? 't-micro' : 't-meta'">
        Phường / xã / đặc khu
        <span v-if="required" class="text-discount">*</span>
      </span>
      <RegionPicker
        ref="wardPicker"
        :id="wardId"
        :labelledby="wardId + '-label'"
        :model-value="wardCode"
        :options="wardOptions"
        :loading="loadingWards"
        :disabled="!provinceCode || loadingWards"
        :dense="dense"
        title="Chọn phường / xã / đặc khu"
        :subtitle="provinceName"
        :placeholder="!provinceCode ? 'Chọn tỉnh / thành phố trước' : 'Chọn phường / xã'"
        search-placeholder="Tìm phường / xã (vd: sai gon)"
        empty-text="Không tìm thấy phường / xã phù hợp"
        @select="handleWardSelect"
      />
      <p v-if="wardError" class="mt-1 t-micro text-discount">
        Không tải được phường/xã.
        <button type="button" class="font-medium underline underline-offset-2" @click="retryWards">Thử lại</button>
      </p>
      <p v-if="legacyWard" class="mt-1 t-micro text-muted">
        Đang dùng: <span class="font-medium text-ink/80">{{ ward }}</span> — chọn lại theo danh mục mới.
      </p>
    </div>
  </div>
</template>
