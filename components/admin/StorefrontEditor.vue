<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { StoreConfig, StorePreset, StoreRecordMeta } from '~/types/store'
import { configFromPreset, STORE_CONFIG_UPDATED_KEY } from '~/utils/store-config'
import { fontOptions, themeVars } from '~/utils/theme'
import { defaultConfig } from '~/utils/store-presets'

const { config, store: siteStore, load: loadSite } = useSite()

const busy = ref(false)
const message = ref('')
const errorMessage = ref('')

const presets = ref<StorePreset[]>([])
const stores = ref<StoreRecordMeta[]>([])
const storeId = ref('')
const storeDomain = ref('')
const activePreset = ref('')

const draft = ref<StoreConfig>(structuredClone(defaultConfig))
const savedSnapshot = ref('')
const savedDomain = ref('')

const isDirty = computed(
  () => JSON.stringify(draft.value) !== savedSnapshot.value || storeDomain.value !== savedDomain.value
)
const currentStore = computed(() => stores.value.find((store) => store.id === storeId.value) ?? null)
/** Các store không gắn domain — chỉ store mặc định trong nhóm này được phát. */
const domainlessStores = computed(() => stores.value.filter((store) => !store.domain && store.active))
/** Store đang thực sự phục vụ host hiện tại. */
const isEditingLive = computed(() => Boolean(storeId.value) && storeId.value === siteStore.value?.id)
const presetSaved = computed(
  () => !activePreset.value || currentStore.value?.preset === activePreset.value
)
const previewVars = computed(() => themeVars(draft.value) as unknown as CSSProperties)
const previewWidth = computed(() => ({ maxWidth: `${Math.min(draft.value.layout.shellWidth, 460)}px` }))

const navOptions = [
  { key: 'home', label: 'Trang chủ' },
  { key: 'categories', label: 'Danh mục' },
  { key: 'cart', label: 'Giỏ hàng' },
  { key: 'account', label: 'Tài khoản' },
  { key: 'assistant', label: 'Trợ lý' }
] as const

const colorFields = [
  { key: 'primary', label: 'Chính' },
  { key: 'primaryDark', label: 'Chính đậm' },
  { key: 'primarySoft', label: 'Chính nhạt' },
  { key: 'accent', label: 'Nhấn' },
  { key: 'accentSoft', label: 'Nhấn nhạt' },
  { key: 'paper', label: 'Nền' },
  { key: 'paperDeep', label: 'Nền sâu' },
  { key: 'ink', label: 'Chữ' },
  { key: 'muted', label: 'Chữ mờ' },
  { key: 'hairline', label: 'Đường kẻ' },
  { key: 'discount', label: 'Giảm giá' }
] as const

const demoProducts = [
  { title: 'Hồng phấn pastel', image: '/images/product-1.svg' },
  { title: 'Cúc vàng chanh', image: '/images/product-5.svg' },
  { title: 'Tulip đỏ Hà Lan', image: '/images/product-8.svg' },
  { title: 'Lan hồ điệp tím', image: '/images/product-3.svg' },
  { title: 'Baby trắng tuyết', image: '/images/product-2.svg' },
  { title: 'Nơ lụa và thiệp', image: '/images/product-12.svg' }
]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function markSaved() {
  savedSnapshot.value = JSON.stringify(draft.value)
  savedDomain.value = storeDomain.value
}

/** Tick phương thức nào thì chọn làm mặc định; tắt phương thức đang mặc định thì lùi về phương thức còn bật. */
function togglePaymentMethod(kind: 'qr' | 'sepay', enabled: boolean) {
  draft.value.payments[kind].enabled = enabled
  if (enabled) {
    draft.value.payments.method = kind
    return
  }
  if (draft.value.payments.method === kind) {
    const other = kind === 'qr' ? 'sepay' : 'qr'
    draft.value.payments.method = draft.value.payments[other].enabled ? other : 'cod'
  }
}

function changePaymentMethod(method: StoreConfig['payments']['method']) {
  draft.value.payments.method = method
  if (method === 'qr') draft.value.payments.qr.enabled = true
  if (method === 'sepay') draft.value.payments.sepay.enabled = true
}

function flash(text: string) {
  message.value = text
  errorMessage.value = ''
  setTimeout(() => {
    if (message.value === text) message.value = ''
  }, 2600)
}

async function studioFetch<T>(path: string, options: Record<string, unknown> = {}): Promise<T> {
  const result = await $fetch(path, options as any)
  return result as T
}

async function loadPresets() {
  const data = await $fetch<{ presets: StorePreset[] }>('/api/store/presets')
  presets.value = data.presets
}

async function loadStores() {
  const data = await studioFetch<{ stores: StoreRecordMeta[] }>('/api/store')
  stores.value = data.stores
}

async function loadConfig(id = '') {
  const query = id ? `?store=${encodeURIComponent(id)}` : ''
  const data = await $fetch<{ config: StoreConfig; store: StoreRecordMeta | null }>(`/api/store/config${query}`)
  draft.value = clone(data.config)
  storeId.value = data.store?.id ?? ''
  storeDomain.value = data.store?.domain ?? ''
  activePreset.value = data.store?.preset ?? ''
  markSaved()
}

function notifyOtherTabs() {
  if (import.meta.client) localStorage.setItem(STORE_CONFIG_UPDATED_KEY, String(Date.now()))
}

/** Áp dụng ngay cấu hình vừa lưu cho storefront đang mở (kể cả tab khác). */
async function syncSite() {
  await loadSite(true)
  notifyOtherTabs()
}

async function unlock() {
  busy.value = true
  errorMessage.value = ''
  try {
    await Promise.all([loadStores(), loadSite(), loadPresets()])
    await loadConfig()
  } catch (error: any) {
    errorMessage.value = error?.statusMessage || 'Không tải được cấu hình cửa hàng.'
  } finally {
    busy.value = false
  }
}

async function save() {
  busy.value = true
  errorMessage.value = ''
  try {
    draft.value.typography.displayFont = draft.value.typography.bodyFont
    const query = storeId.value ? `?store=${encodeURIComponent(storeId.value)}` : ''
    const data = await studioFetch<{ config: StoreConfig; store: StoreRecordMeta | null }>(
      `/api/store/config${query}`,
      {
        method: 'PUT',
        body: {
          config: draft.value,
          name: draft.value.brand.name,
          domain: storeDomain.value,
          preset: activePreset.value || undefined
        }
      }
    )
    draft.value = clone(data.config)
    storeId.value = data.store?.id ?? storeId.value
    storeDomain.value = data.store?.domain ?? ''
    activePreset.value = data.store?.preset || activePreset.value
    markSaved()
    await loadStores()
    await syncSite()
    flash(
      isEditingLive.value
        ? 'Đã lưu và áp dụng cho storefront.'
        : 'Đã lưu. Cửa hàng này chỉ hiển thị trên domain của nó.'
    )
  } catch (error: any) {
    errorMessage.value = error?.statusMessage || 'Không lưu được cấu hình.'
  } finally {
    busy.value = false
  }
}

/** Áp preset rồi lưu luôn — tránh trường hợp chọn preset nhưng quên bấm Lưu. */
async function applyPresetAndSave(presetId: string) {
  applyPreset(presetId)
  await nextTick()
  await save()
}

async function makeDefault() {
  if (!storeId.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    await studioFetch('/api/store/default', { method: 'POST', body: { store: storeId.value } })
    await loadStores()
    await syncSite()
    flash('Đã đặt cửa hàng này làm mặc định cho mọi host chưa khớp domain.')
  } catch (error: any) {
    errorMessage.value = error?.statusMessage || 'Không đặt được cửa hàng mặc định.'
  } finally {
    busy.value = false
  }
}

function applyPreset(presetId: string) {
  activePreset.value = presetId
  const next = configFromPreset(presetId, {
    brand: draft.value.brand,
    features: draft.value.features,
    seo: draft.value.seo,
    content: draft.value.content,
    payments: draft.value.payments,
    layout: { shellWidth: draft.value.layout.shellWidth }
  })
  // `ready` là cờ runtime do server inject, normalizeConfig strip khi tạo preset.
  next.payments.sepay.ready = draft.value.payments.sepay.ready
  draft.value = next
}

function reset() {
  draft.value = clone(JSON.parse(savedSnapshot.value) as StoreConfig)
  storeDomain.value = savedDomain.value
}

async function selectStore(id: string) {
  if (id === storeId.value) return
  if (isDirty.value && !window.confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi và chuyển cửa hàng?')) return
  try {
    await loadConfig(id)
  } catch (error: any) {
    errorMessage.value = error?.statusMessage || 'Không tải được cửa hàng.'
  }
}

async function onStoreSelect(event: Event) {
  const select = event.target as HTMLSelectElement
  await selectStore(select.value)
  // Nếu huỷ hoặc tải lỗi, trả select về cửa hàng đang mở.
  select.value = storeId.value
}

const newStore = reactive({ name: '', domain: '', preset: 'vuon-nha' })
const showCreate = ref(false)

async function createStore() {
  if (!newStore.name.trim()) {
    errorMessage.value = 'Nhập tên cửa hàng mới.'
    return
  }
  busy.value = true
  errorMessage.value = ''
  try {
    const data = await studioFetch<{ store: StoreRecordMeta }>('/api/store/scaffold', {
      method: 'POST',
      body: {
        name: newStore.name.trim(),
        domain: newStore.domain.trim(),
        preset: newStore.preset
      }
    })
    await loadStores()
    await loadConfig(data.store.id)
    await syncSite()
    showCreate.value = false
    newStore.name = ''
    newStore.domain = ''
    flash('Đã tạo cửa hàng mới từ preset.')
  } catch (error: any) {
    errorMessage.value = error?.statusMessage || 'Không tạo được cửa hàng.'
  } finally {
    busy.value = false
  }
}

function copyJson() {
  navigator.clipboard?.writeText(JSON.stringify(draft.value, null, 2))
  flash('Đã sao chép JSON cấu hình.')
}

onMounted(async () => {
  await unlock()
  window.addEventListener('beforeunload', warnBeforeUnload)
})

onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

useHead({ title: 'Giao diện cửa hàng' })
</script>

<template>
  <div class="w-full space-y-4">
    <div
      class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="min-w-0">
        <p class="text-xs text-slate-500">
          Đang phát:
          <strong class="font-semibold text-slate-800">{{ siteStore?.name || '—' }}</strong>
          <span
            v-if="siteStore?.isDefault"
            class="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"
          >
            mặc định
          </span>
          <span v-else-if="siteStore?.domain"> · {{ siteStore.domain }}</span>
        </p>
        <NuxtLink
          to="/"
          target="_blank"
          class="text-xs font-semibold text-emerald-700 underline decoration-dotted hover:text-emerald-800"
        >
          Xem cửa hàng ↗
        </NuxtLink>
      </div>

      <div class="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
        <select
          :value="storeId"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 sm:w-[240px]"
          @change="onStoreSelect"
        >
          <option value="">Cửa hàng mặc định (host hiện tại)</option>
          <option v-for="store in stores" :key="store.id" :value="store.id">
            {{ store.isDefault ? '★ ' : '' }}{{ store.name }}{{ store.domain ? ` · ${store.domain}` : ''
            }}{{ !store.domain && !store.isDefault ? ` · #${store.id.slice(-5)}` : '' }}
          </option>
        </select>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            :disabled="busy"
            @click="reset"
          >
            Hoàn tác
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            :disabled="busy || !isDirty"
            @click="save"
          >
            {{ busy ? 'Đang lưu…' : 'Lưu & áp dụng' }}
          </button>
        </div>
      </div>
    </div>

    <div class="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div class="order-2 space-y-4 lg:order-1">
        <p v-if="message" class="rounded-xl2 border border-primary/25 bg-primary-soft px-4 py-2 t-body text-primary">
          {{ message }}
        </p>
        <p v-if="errorMessage" class="rounded-xl2 border border-discount/30 bg-discount/5 px-4 py-2 t-body text-discount">
          {{ errorMessage }}
        </p>

        <div
          v-if="storeId && siteStore && !isEditingLive"
          class="rounded-xl2 border border-accent/40 bg-accent-soft/40 px-4 py-3 t-meta leading-relaxed"
        >
          Bạn đang sửa <strong>{{ currentStore?.name || 'một cửa hàng khác' }}</strong> — không phải cửa hàng đang phát
          trên host này (<strong>{{ siteStore.name }}</strong>). Lưu theme ở đây sẽ không đổi storefront hiện tại.
          <button type="button" class="btn-primary mt-2 py-1.5" :disabled="busy" @click="makeDefault">
            Đặt làm cửa hàng mặc định
          </button>
        </div>

        <!-- Store block -->
        <section class="rounded-xl2 border border-hairline bg-white/80 p-4 shadow-soft">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="t-section font-semibold">Cửa hàng</h2>
              <p class="t-meta text-muted">Mỗi domain một cấu hình riêng — cùng một nền tảng, nhiều store.</p>
            </div>
            <button type="button" class="btn-ghost py-1.5 t-meta" @click="showCreate = !showCreate">
              + Cửa hàng mới
            </button>
          </div>

          <div v-if="showCreate" class="mt-3 grid gap-2 rounded-xl2 bg-paper-deep/60 p-3 sm:grid-cols-2">
            <label class="t-meta">
              <span class="text-muted">Tên cửa hàng</span>
              <input v-model="newStore.name" class="field mt-1 py-2" placeholder="Ví dụ: Tiệm Hoa Mây" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Domain (để trống = thay cửa hàng mặc định đang phát)</span>
              <input v-model="newStore.domain" class="field mt-1 py-2" placeholder="hoamay.vn" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Preset khởi tạo</span>
              <select v-model="newStore.preset" class="field mt-1 py-2">
                <option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.name }}</option>
              </select>
            </label>
            <div class="flex items-end">
              <button type="button" class="btn-primary w-full py-2" :disabled="busy" @click="createStore">
                Tạo 1 click
              </button>
            </div>
          </div>

          <div class="mt-3 grid gap-2 sm:grid-cols-3">
            <label class="t-meta">
              <span class="text-muted">Tên hiển thị</span>
              <input v-model="draft.brand.name" class="field mt-1 py-2" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Tagline</span>
              <input v-model="draft.brand.tagline" class="field mt-1 py-2" />
            </label>
            <label class="t-meta sm:col-span-1">
              <span class="text-muted">Hotline</span>
              <input v-model="draft.brand.hotline" class="field mt-1 py-2" />
            </label>
            <label class="t-meta sm:col-span-2">
              <span class="text-muted">Domain (để trống = cửa hàng mặc định)</span>
              <input v-model="storeDomain" class="field mt-1 py-2" placeholder="hoamay.vn" />
            </label>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl2 bg-paper-deep/50 px-3 py-2 t-micro">
            <span
              class="rounded-full px-2 py-0.5 font-semibold"
              :class="currentStore?.isDefault ? 'bg-primary-soft text-primary' : 'bg-white text-muted'"
            >
              {{ currentStore?.isDefault ? 'Cửa hàng mặc định' : 'Store phụ' }}
            </span>
            <span v-if="isEditingLive" class="inline-flex items-center gap-1 font-semibold text-primary">
              <span class="h-1.5 w-1.5 rounded-full bg-primary" /> Đang phát
            </span>
            <span class="text-muted">ID: {{ storeId || '—' }}</span>
            <span class="text-muted">Cập nhật: {{ currentStore?.updatedAt ? formatDateTime(currentStore.updatedAt) : '—' }}</span>
            <button
              v-if="storeId && !currentStore?.isDefault"
              type="button"
              class="ml-auto underline decoration-dotted hover:text-ink"
              :disabled="busy"
              @click="makeDefault"
            >
              Đặt làm mặc định
            </button>
          </div>

          <p
            v-if="domainlessStores.length > 1"
            class="mt-2 rounded-xl2 border border-accent/30 bg-accent-soft/30 px-3 py-2 t-micro leading-relaxed text-muted"
          >
            Có {{ domainlessStores.length }} cửa hàng không gắn domain. Chỉ cửa hàng
            <strong class="text-ink">mặc định</strong> được phát cho host chưa khớp domain — đánh dấu ★ hoặc gán
            domain riêng cho các cửa hàng còn lại.
          </p>
        </section>

        <!-- Presets -->
        <section class="rounded-xl2 border border-hairline bg-white/80 p-4 shadow-soft">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <h2 class="t-section font-semibold">Preset giao diện</h2>
              <p class="t-meta text-muted">
                Đổi toàn bộ màu, font và bo góc trong 1 click. Preset chỉ đổi giao diện — giữ nguyên nội dung,
                thương mại và thanh toán.
              </p>
            </div>
            <span v-if="activePreset" class="shrink-0 rounded-full bg-paper-deep px-2.5 py-1 t-micro">
              Đang chọn:
              <strong>{{ presets.find((preset) => preset.id === activePreset)?.name || activePreset }}</strong>
              <span v-if="!presetSaved" class="font-semibold text-discount">· chưa lưu</span>
            </span>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div
              v-for="preset in presets"
              :key="preset.id"
              class="flex flex-col rounded-xl2 border p-2.5 transition"
              :class="activePreset === preset.id ? 'border-primary bg-primary-soft/60' : 'border-hairline bg-white'"
            >
              <button type="button" class="flex-1 text-left" @click="applyPreset(preset.id)">
                <span class="flex gap-1">
                  <span
                    v-for="swatch in preset.swatches"
                    :key="swatch"
                    class="h-6 w-6 rounded-full border border-black/5"
                    :style="{ background: swatch }"
                  />
                </span>
                <span class="mt-2 flex items-center gap-1.5">
                  <span class="t-body font-medium">{{ preset.name }}</span>
                  <span
                    v-if="activePreset === preset.id"
                    class="rounded-full bg-primary px-1.5 py-0.5 t-micro font-semibold text-white"
                  >
                    đang chọn
                  </span>
                </span>
                <span class="mt-0.5 block t-micro leading-snug text-muted">{{ preset.description }}</span>
              </button>
              <button
                type="button"
                class="mt-2 rounded-full border border-primary/30 px-2 py-1 t-micro font-semibold text-primary transition hover:bg-primary-soft disabled:opacity-40"
                :disabled="busy"
                @click="applyPresetAndSave(preset.id)"
              >
                {{ activePreset === preset.id && presetSaved ? 'Lưu lại' : 'Áp dụng & lưu' }}
              </button>
            </div>
          </div>
        </section>

        <!-- Colors -->
        <section class="rounded-xl2 border border-hairline bg-white/80 p-4 shadow-soft">
          <h2 class="t-section font-semibold">Màu sắc & tone</h2>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label v-for="field in colorFields" :key="field.key" class="t-meta">
              <span class="text-muted">{{ field.label }}</span>
              <span class="mt-1 flex items-center gap-1.5">
                <input
                  v-model="draft.colors[field.key]"
                  type="color"
                  class="h-9 w-9 shrink-0 rounded-lg border border-hairline bg-white p-0.5"
                />
                <input v-model="draft.colors[field.key]" class="field py-1.5 t-meta" />
              </span>
            </label>
          </div>
        </section>

        <!-- Typography & shape -->
        <section class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-xl2 border border-hairline bg-white/80 p-4 shadow-soft">
            <h2 class="t-section font-semibold">Kiểu chữ</h2>
            <label class="mt-3 block t-meta">
              <span class="text-muted">Font chữ</span>
              <select v-model="draft.typography.bodyFont" class="field mt-1 py-2">
                <option v-for="font in fontOptions" :key="font.value" :value="font.value">{{ font.label }}</option>
              </select>
            </label>
            <label class="mt-2 block t-meta">
              <span class="text-muted">Độ đậm tiêu đề: {{ draft.typography.displayWeight }}</span>
              <input
                v-model.number="draft.typography.displayWeight"
                type="range"
                min="300"
                max="800"
                step="100"
                class="mt-1 w-full accent-[rgb(var(--color-primary))]"
              />
            </label>
            <label class="mt-1 block t-meta">
              <span class="text-muted">Giãn chữ tiêu đề</span>
              <input v-model="draft.typography.headingTracking" class="field mt-1 py-2 t-meta" />
            </label>
          </div>

          <div class="rounded-xl2 border border-hairline bg-white/80 p-4 shadow-soft">
            <h2 class="t-section font-semibold">Hình khối</h2>
            <label class="mt-3 block t-meta">
              <span class="text-muted">Bo góc thẻ: {{ draft.shape.cardRadius }}px</span>
              <input v-model.number="draft.shape.cardRadius" type="range" min="0" max="40" class="mt-1 w-full" />
            </label>
            <label class="mt-1 block t-meta">
              <span class="text-muted">Bo góc nút: {{ draft.shape.buttonRadius }}px</span>
              <input v-model.number="draft.shape.buttonRadius" type="range" min="0" max="999" class="mt-1 w-full" />
            </label>
            <label class="mt-1 block t-meta">
              <span class="text-muted">Bo góc ảnh: {{ draft.shape.imageRadius }}px</span>
              <input v-model.number="draft.shape.imageRadius" type="range" min="0" max="40" class="mt-1 w-full" />
            </label>
            <div class="mt-2 flex gap-1.5">
              <button
                v-for="option in (['none', 'soft', 'strong'] as const)"
                :key="option"
                type="button"
                class="flex-1 rounded-full border px-2 py-1.5 t-meta capitalize"
                :class="draft.shape.shadow === option ? 'border-primary bg-primary-soft text-primary' : 'border-hairline bg-white text-muted'"
                @click="draft.shape.shadow = option"
              >
                {{ option === 'none' ? 'Không đổ bóng' : option === 'soft' ? 'Mềm' : 'Đậm' }}
              </button>
            </div>
          </div>
        </section>

        <!-- Layout -->
        <section class="rounded-xl2 border border-hairline bg-white/80 p-4 shadow-soft">
          <h2 class="t-section font-semibold">Bố cục</h2>

          <div class="mt-3 grid gap-2 sm:grid-cols-3">
            <label class="t-meta">
              <span class="text-muted">Header</span>
              <select v-model="draft.layout.headerStyle" class="field mt-1 py-2">
                <option value="classic">Logo + tìm kiếm + giỏ</option>
                <option value="centered">Logo căn giữa</option>
                <option value="minimal">Tối giản</option>
              </select>
            </label>
            <label class="t-meta">
              <span class="text-muted">Số cột sản phẩm</span>
              <select v-model.number="draft.layout.productGridColumns" class="field mt-1 py-2">
                <option :value="2">2 cột</option>
                <option :value="3">3 cột</option>
                <option :value="4">4 cột</option>
              </select>
            </label>
            <label class="t-meta">
              <span class="text-muted">Kiểu thẻ sản phẩm</span>
              <select v-model="draft.layout.productCardStyle" class="field mt-1 py-2">
                <option value="soft">Mềm</option>
                <option value="flat">Phẳng</option>
                <option value="bordered">Viền</option>
              </select>
            </label>
            <label class="t-meta">
              <span class="text-muted">Rộng khung: {{ draft.layout.shellWidth }}px</span>
              <input v-model.number="draft.layout.shellWidth" type="range" min="360" max="1440" step="20" class="mt-2 w-full" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Lề trong: {{ draft.layout.gutter }}px</span>
              <input v-model.number="draft.layout.gutter" type="range" min="8" max="40" class="mt-2 w-full" />
            </label>
            <label class="flex items-center gap-2 pt-5 t-meta">
              <input v-model="draft.layout.showTagline" type="checkbox" class="h-4 w-4 accent-[rgb(var(--color-primary))]" />
              Hiện tagline dưới logo
            </label>
            <label class="flex items-center gap-2 pt-5 t-meta">
              <input v-model="draft.layout.assistantInHeader" type="checkbox" class="h-4 w-4 accent-[rgb(var(--color-primary))]" />
              Nút trợ lý trên header
            </label>
          </div>

          <div class="mt-3 grid gap-2 rounded-xl2 bg-paper-deep/50 p-3 sm:grid-cols-2">
            <label class="flex items-center gap-2 t-meta">
              <input v-model="draft.layout.announcement.enabled" type="checkbox" class="h-4 w-4" />
              Thanh thông báo đầu trang
            </label>
            <input v-model="draft.layout.announcement.text" class="field py-1.5 t-meta" placeholder="Freeship đơn từ 500k" />
            <input v-model="draft.layout.announcement.href" class="field py-1.5 t-meta" placeholder="/khuyen-mai" />
          </div>

          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p class="t-meta text-muted">Thanh điều hướng dưới</p>
              <label class="mt-1 flex items-center gap-2 t-meta">
                <input v-model="draft.layout.bottomNav.enabled" type="checkbox" class="h-4 w-4" />
                Bật thanh điều hướng
              </label>
              <div class="mt-1 flex flex-wrap gap-3">
                <label v-for="item in navOptions" :key="item.key" class="flex items-center gap-1.5 t-meta">
                  <input v-model="draft.layout.bottomNav.items" type="checkbox" :value="item.key" class="h-4 w-4" />
                  {{ item.label }}
                </label>
              </div>
            </div>
            <div>
              <p class="t-meta text-muted">Footer</p>
              <label class="mt-1 flex items-center gap-2 t-meta">
                <input v-model="draft.layout.footer.enabled" type="checkbox" class="h-4 w-4" />
                Hiện footer
              </label>
              <textarea
                v-model="draft.layout.footer.text"
                rows="2"
                class="field mt-1 rounded-2xl py-2 t-meta"
                placeholder="© 2026 FloraHub · Giao hoa trong ngày"
              />
            </div>
          </div>
        </section>

        <!-- Content -->
        <section class="rounded-xl2 border border-hairline bg-white/80 p-4 shadow-soft">
          <h2 class="t-section font-semibold">Nội dung trang chủ</h2>
          <label class="mt-2 flex items-center gap-2 t-meta">
            <input v-model="draft.content.hero.enabled" type="checkbox" class="h-4 w-4" />
            Hiện hero khi chưa có banner
          </label>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            <label class="t-meta">
              <span class="text-muted">Nhãn nhỏ</span>
              <input v-model="draft.content.hero.eyebrow" class="field mt-1 py-2" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Tiêu đề</span>
              <input v-model="draft.content.hero.title" class="field mt-1 py-2" />
            </label>
            <label class="t-meta sm:col-span-2">
              <span class="text-muted">Mô tả</span>
              <input v-model="draft.content.hero.subtitle" class="field mt-1 py-2" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Nút CTA</span>
              <input v-model="draft.content.hero.ctaLabel" class="field mt-1 py-2" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Liên kết CTA</span>
              <input v-model="draft.content.hero.ctaHref" class="field mt-1 py-2" />
            </label>
            <label class="t-meta sm:col-span-2">
              <span class="text-muted">Ảnh hero (URL)</span>
              <input v-model="draft.content.hero.image" class="field mt-1 py-2" placeholder="/images/hero-1.svg" />
            </label>
          </div>
        </section>

        <!-- Branding & SEO -->
        <section class="rounded-xl2 border border-hairline bg-white/80 p-4 shadow-soft">
          <h2 class="t-section font-semibold">Nhận diện & SEO</h2>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            <label class="t-meta">
              <span class="text-muted">Logo URL</span>
              <input v-model="draft.brand.logoUrl" class="field mt-1 py-2" placeholder="/images/logo.svg" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Favicon URL</span>
              <input v-model="draft.brand.faviconUrl" class="field mt-1 py-2" placeholder="/images/logo.svg" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Email</span>
              <input v-model="draft.brand.email" class="field mt-1 py-2" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Địa chỉ</span>
              <input v-model="draft.brand.address" class="field mt-1 py-2" />
            </label>
            <label class="t-meta sm:col-span-2">
              <span class="text-muted">Mô tả</span>
              <textarea v-model="draft.brand.description" rows="2" class="field mt-1 rounded-2xl py-2" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Tiêu đề SEO (%)</span>
              <input v-model="draft.seo.titleTemplate" class="field mt-1 py-2" placeholder="%s — Tiệm Hoa Mây" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Từ khoá</span>
              <input v-model="draft.seo.keywords" class="field mt-1 py-2" />
            </label>
            <label class="t-meta sm:col-span-2">
              <span class="text-muted">Ảnh chia sẻ (OG image)</span>
              <input v-model="draft.seo.ogImage" class="field mt-1 py-2" />
            </label>
          </div>
        </section>

        <!-- Commerce -->
        <section class="rounded-xl2 border border-hairline bg-white/80 p-4 shadow-soft">
          <h2 class="t-section font-semibold">Thương mại & tính năng</h2>
          <div class="mt-2 grid gap-2 sm:grid-cols-3">
            <label class="t-meta">
              <span class="text-muted">Tiền tệ</span>
              <input v-model="draft.features.currency" class="field mt-1 py-2" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Locale</span>
              <input v-model="draft.features.locale" class="field mt-1 py-2" />
            </label>
            <div class="t-meta sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-hairline bg-white/60 px-3 py-2">
              <div>
                <p class="font-medium">Phí & chính sách vận chuyển</p>
                <p class="t-micro text-muted mt-0.5">Cước tính realtime qua hãng vận chuyển, freeship và chế độ dự phòng.</p>
              </div>
              <NuxtLink to="/admin/shipping" class="btn-ghost shrink-0 py-1.5 t-meta">Cấu hình</NuxtLink>
            </div>
            <label class="t-meta">
              <span class="text-muted">Thuế (%)</span>
              <input v-model.number="draft.features.taxRate" type="number" class="field mt-1 py-2" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Hoa hồng CTV (%)</span>
              <input v-model.number="draft.features.affiliateCommissionRate" type="number" class="field mt-1 py-2" />
            </label>
            <label class="t-meta">
              <span class="text-muted">SL tối thiểu mỗi đơn (0 = không giới hạn)</span>
              <input v-model.number="draft.features.minOrderQuantity" type="number" min="0" class="field mt-1 py-2" />
            </label>
          </div>

          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <label v-for="feature in ([
              ['affiliate', 'Cộng tác viên'],
              ['wallet', 'Ví'],
              ['reviews', 'Đánh giá'],
              ['flashSale', 'Flash sale'],
              ['wishlist', 'Yêu thích'],
              ['trackOrder', 'Tra cứu đơn']
            ] as const)" :key="feature[0]" class="flex items-center gap-1.5 t-meta">
              <input v-model="draft.features[feature[0]]" type="checkbox" class="h-4 w-4" />
              {{ feature[1] }}
            </label>
          </div>
        </section>

        <section class="rounded-xl2 border border-hairline bg-white/80 p-4 shadow-soft">
          <div class="flex items-center justify-between gap-3">
            <h2 class="t-section font-semibold">Thanh toán</h2>
            <a href="/admin/payments" class="t-micro font-semibold text-primary hover:underline">
              Cấu hình key thanh toán →
            </a>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-1.5 t-meta">
              <input
                type="checkbox"
                class="h-4 w-4"
                :checked="draft.payments.qr.enabled"
                @change="togglePaymentMethod('qr', ($event.target as HTMLInputElement).checked)"
              />
              Bật VietQR (miễn phí)
            </label>
            <label class="flex items-center gap-1.5 t-meta">
              <input
                type="checkbox"
                class="h-4 w-4"
                :checked="draft.payments.sepay.enabled"
                @change="togglePaymentMethod('sepay', ($event.target as HTMLInputElement).checked)"
              />
              Bật cổng SePay (có phí)
            </label>
          </div>
          <p class="mt-1 t-micro text-muted">
            Phương thức mặc định áp dụng cho đơn hàng mới. VietQR dùng ảnh QR động đúng số tiền và nội dung
            <code>ORD-XXXXXX</code>; đơn tự chuyển “Đã thanh toán” khi webhook SePay báo tiền về
            (<code>/api/webhooks/sepay</code>) hoặc khi Open API đối soát được giao dịch.
          </p>
          <p class="mt-1 t-micro text-muted">
            Cổng SePay (hosted checkout) cho phép trả thẻ quốc tế/NAPAS nhưng <strong>thu phí mỗi giao dịch</strong>.
            IPN xác nhận tại <code>/api/webhooks/sepay-ipn</code>.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              class="rounded-full px-2 py-0.5 t-micro font-medium"
              :class="draft.payments.qr.webhookReady ? 'bg-primary-soft text-primary' : 'bg-paper-deep text-muted'"
            >
              Webhook: {{ draft.payments.qr.webhookReady ? 'đã cấu hình' : 'chưa cấu hình' }}
            </span>
            <span
              class="rounded-full px-2 py-0.5 t-micro font-medium"
              :class="draft.payments.qr.apiReady ? 'bg-primary-soft text-primary' : 'bg-paper-deep text-muted'"
            >
              SePay API: {{ draft.payments.qr.apiReady ? 'đã cấu hình' : 'chưa cấu hình' }}
            </span>
            <span
              class="rounded-full px-2 py-0.5 t-micro font-medium"
              :class="draft.payments.sepay.ready ? 'bg-primary-soft text-primary' : 'bg-paper-deep text-muted'"
            >
              Cổng SePay: {{ draft.payments.sepay.ready ? 'sẵn sàng' : 'chưa đủ key' }}
            </span>
          </div>
          <p
            v-if="draft.payments.sepay.enabled && !draft.payments.sepay.ready"
            class="mt-1 t-micro font-medium text-discount"
          >
            Thiếu merchant key cho cổng SePay — đơn mới sẽ tự lùi về phương thức khác. Nhập key tại
            <a href="/admin/payments" class="underline">/admin/payments</a>.
          </p>

          <div class="mt-2 grid gap-2 sm:grid-cols-3">
            <label class="t-meta">
              <span class="text-muted">Phương thức mặc định</span>
              <select
                class="field mt-1 py-2"
                :value="draft.payments.method"
                @change="changePaymentMethod(($event.target as HTMLSelectElement).value as StoreConfig['payments']['method'])"
              >
                <option value="qr">VietQR — miễn phí</option>
                <option value="sepay">Cổng SePay — có phí</option>
                <option value="cod">Thanh toán khi nhận hàng</option>
              </select>
            </label>
            <label class="t-meta">
              <span class="text-muted">Ngân hàng (BIN hoặc mã)</span>
              <input v-model="draft.payments.qr.bankId" class="field mt-1 py-2" placeholder="970436 / VCB" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Tên ngân hàng hiển thị</span>
              <input v-model="draft.payments.qr.bankName" class="field mt-1 py-2" placeholder="Vietcombank" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Số tài khoản</span>
              <input v-model="draft.payments.qr.accountNo" class="field mt-1 py-2" placeholder="0123456789" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Chủ tài khoản</span>
              <input v-model="draft.payments.qr.accountName" class="field mt-1 py-2" placeholder="CONG TY FLORAHUB" />
            </label>
            <label class="t-meta">
              <span class="text-muted">Mẫu QR</span>
              <select v-model="draft.payments.qr.template" class="field mt-1 py-2">
                <option value="compact2">compact2</option>
                <option value="compact">compact</option>
                <option value="qr_only">qr_only</option>
                <option value="print">print</option>
              </select>
            </label>
          </div>
        </section>

        <div class="flex flex-wrap items-center gap-2 pb-8">
          <button type="button" class="btn-primary" :disabled="busy || !isDirty" @click="save">
            {{ busy ? 'Đang lưu…' : 'Lưu & áp dụng' }}
          </button>
          <button type="button" class="btn-ghost" :disabled="!isDirty" @click="reset">Hoàn tác</button>
          <button type="button" class="btn-ghost" @click="copyJson">Sao chép JSON</button>
          <span v-if="isDirty" class="t-meta text-muted">Có thay đổi chưa lưu</span>
        </div>
      </div>

      <!-- Live preview -->
      <aside class="order-1 lg:order-2 lg:sticky lg:top-[84px] lg:self-start">
        <div class="rounded-xl2 border border-hairline bg-white/70 p-3 shadow-soft">
          <div class="mb-2 flex items-center justify-between">
            <p class="t-micro uppercase tracking-wide text-muted">Xem trước trực tiếp</p>
            <span class="rounded-full bg-paper-deep px-2 py-0.5 t-micro text-muted">{{ draft.tone }}</span>
          </div>

          <div class="mx-auto overflow-hidden rounded-[26px] border border-hairline bg-white" :style="previewWidth">
            <div :style="previewVars" class="font-body text-ink" :data-card="draft.layout.productCardStyle">
              <div
                v-if="draft.layout.announcement.enabled && draft.layout.announcement.text"
                class="bg-primary px-2 py-1 text-center t-micro font-medium text-white"
              >
                {{ draft.layout.announcement.text }}
              </div>

              <div class="border-b border-hairline/60 bg-paper px-3 py-2.5">
                <div v-if="draft.layout.headerStyle === 'classic'" class="flex items-center gap-2">
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary t-micro font-semibold text-white">
                    {{ draft.brand.name.slice(0, 1) || 'F' }}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate t-meta font-semibold leading-tight">{{ draft.brand.name }}</span>
                    <span v-if="draft.layout.showTagline && draft.brand.tagline" class="block truncate t-micro text-muted">
                      {{ draft.brand.tagline }}
                    </span>
                  </span>
                  <span class="h-6 flex-1 rounded-full border border-hairline bg-white/70" />
                  <span class="grid h-7 w-7 place-items-center rounded-full border border-hairline bg-white/70">
                    <AppIcon name="bag" size="h-3.5 w-3.5" />
                  </span>
                </div>
                <div v-else-if="draft.layout.headerStyle === 'centered'" class="text-center">
                  <p class="truncate t-body font-semibold">{{ draft.brand.name }}</p>
                  <p v-if="draft.layout.showTagline && draft.brand.tagline" class="truncate t-micro text-muted">
                    {{ draft.brand.tagline }}
                  </p>
                  <div class="mt-1.5 h-6 rounded-full border border-hairline bg-white/70" />
                </div>
                <div v-else class="flex items-center justify-between">
                  <p class="truncate t-body font-semibold">{{ draft.brand.name }}</p>
                  <span class="grid h-7 w-7 place-items-center rounded-full border border-hairline bg-white/70">
                    <AppIcon name="bag" size="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>

              <div class="bg-paper px-3 py-3">
                <div v-if="draft.content.hero.enabled" class="overflow-hidden rounded-xl2 border border-hairline/70 shadow-soft">
                  <img
                    v-if="draft.content.hero.image"
                    :src="draft.content.hero.image"
                    alt=""
                    class="h-20 w-full object-cover"
                  />
                  <div class="bg-primary-soft/70 px-3 py-3">
                    <p v-if="draft.content.hero.eyebrow" class="t-micro uppercase tracking-wide text-primary">
                      {{ draft.content.hero.eyebrow }}
                    </p>
                    <p class="mt-0.5 t-body font-semibold leading-tight">{{ draft.content.hero.title }}</p>
                    <p class="mt-0.5 line-clamp-2 t-micro leading-snug text-ink/70">{{ draft.content.hero.subtitle }}</p>
                    <span class="mt-1.5 inline-flex rounded-full bg-primary px-2.5 py-1 t-micro font-medium text-white">
                      {{ draft.content.hero.ctaLabel }}
                    </span>
                  </div>
                </div>

                <div
                  class="mt-3 grid gap-x-2 gap-y-3"
                  :style="{ gridTemplateColumns: `repeat(${draft.layout.productGridColumns}, minmax(0, 1fr))` }"
                >
                  <div v-for="product in demoProducts" :key="product.title" class="min-w-0 text-center">
                    <span class="block aspect-square overflow-hidden rounded-image border border-hairline/60 bg-white">
                      <img :src="product.image" :alt="product.title" class="h-full w-full object-cover" />
                    </span>
                    <span class="mt-1 line-clamp-2 block t-micro font-bold leading-tight">{{ product.title }}</span>
                  </div>
                </div>
              </div>

              <div
                v-if="draft.layout.footer.enabled && draft.layout.footer.text"
                class="border-t border-hairline/60 px-2 py-2 text-center t-micro text-muted"
              >
                {{ draft.layout.footer.text }}
              </div>

              <div
                v-if="draft.layout.bottomNav.enabled"
                class="grid border-t border-hairline bg-paper/95 py-1.5"
                :style="{ gridTemplateColumns: `repeat(${draft.layout.bottomNav.items.length || 1}, minmax(0, 1fr))` }"
              >
                <span
                  v-for="item in draft.layout.bottomNav.items"
                  :key="item"
                  class="flex flex-col items-center gap-0.5 t-micro text-muted"
                >
                  <AppIcon
                    :name="item === 'home' ? 'home' : item === 'categories' ? 'grid' : item === 'cart' ? 'bag' : item === 'assistant' ? 'shop' : 'user'"
                    size="h-3.5 w-3.5"
                  />
                  {{ item === 'home' ? 'Trang chủ' : item === 'categories' ? 'Danh mục' : item === 'cart' ? 'Giỏ' : item === 'assistant' ? 'Trợ lý' : 'Tài khoản' }}
                </span>
              </div>
            </div>
          </div>

          <p class="mt-2 text-center t-micro leading-snug text-muted">
            Xem trước bằng CSS variables — website áp dụng ngay ở lần render đầu tiên sau khi lưu.
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>
