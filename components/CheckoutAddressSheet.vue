<script setup lang="ts">
import type { Address } from '~/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    addresses?: Address[]
    selectedId?: string | null
    defaultRecipient?: string
    defaultPhone?: string
  }>(),
  {
    addresses: () => [],
    selectedId: null,
    defaultRecipient: '',
    defaultPhone: ''
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [id: string]
  created: [address: Address]
}>()

const { config } = useSite()

const mode = ref<'list' | 'form'>('list')
const saving = ref(false)
const errorMessage = ref('')

const form = reactive({
  label: 'Nhà riêng',
  recipient: '',
  phone: '',
  line1: '',
  ward: '',
  city: '',
  cityCode: '',
  wardCode: '',
  isDefault: false
})

function resetForm() {
  Object.assign(form, {
    label: 'Nhà riêng',
    recipient: props.defaultRecipient,
    phone: props.defaultPhone,
    line1: '',
    ward: '',
    city: '',
    cityCode: '',
    wardCode: '',
    isDefault: props.addresses.length === 0
  })
  errorMessage.value = ''
}

function close() {
  emit('update:open', false)
}

function selectAddress(address: Address) {
  emit('select', address.id)
  close()
}

function startCreate() {
  resetForm()
  mode.value = 'form'
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    errorMessage.value = ''
    if (props.addresses.length) {
      mode.value = 'list'
    } else {
      startCreate()
    }
  }
)

watch(
  () => props.open,
  (open) => {
    if (!import.meta.client) return
    document.body.style.overflow = open ? 'hidden' : ''
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})

async function save() {
  if (saving.value) return
  errorMessage.value = ''

  const recipient = form.recipient.trim()
  const phone = normalizePhone(form.phone)
  const line1 = form.line1.trim()

  if (!recipient || !phone || !line1 || !form.ward || !form.city) {
    errorMessage.value = 'Vui lòng nhập đầy đủ người nhận, số điện thoại và địa chỉ.'
    return
  }
  if (!isValidVietnamesePhone(phone)) {
    errorMessage.value = 'Số điện thoại không hợp lệ. Ví dụ: 0901234567.'
    return
  }

  saving.value = true
  try {
    const result = await $fetch<{ address: Address }>('/api/account/addresses', {
      method: 'POST',
      body: { ...form, recipient, phone, line1 }
    })
    emit('created', result.address)
    close()
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Không thể lưu địa chỉ. Vui lòng thử lại.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="open"
        class="fixed inset-0 z-50"
        role="dialog"
        aria-modal="true"
        aria-label="Địa chỉ giao hàng"
      >
        <div class="absolute inset-0 bg-ink/40" @click="close" />

        <div
          class="sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-paper shadow-[0_-20px_60px_-20px_rgba(27,26,22,0.45)]"
          :style="{ maxWidth: `${config.layout.shellWidth}px` }"
        >
          <div class="shrink-0 pt-2">
            <div class="mx-auto h-1 w-10 rounded-full bg-hairline" />
            <div class="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
              <div class="flex min-w-0 items-center gap-1">
                <button
                  v-if="mode === 'form' && addresses.length"
                  type="button"
                  class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted active:bg-paper-deep"
                  aria-label="Quay lại danh sách địa chỉ"
                  @click="mode = 'list'"
                >
                  <AppIcon name="chevron" size="h-5 w-5 rotate-180" />
                </button>
                <h2 class="truncate t-section font-semibold">
                  {{ mode === 'list' ? 'Chọn địa chỉ giao hàng' : 'Thêm địa chỉ giao hàng' }}
                </h2>
              </div>
              <button
                type="button"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted active:bg-paper-deep"
                aria-label="Đóng"
                @click="close"
              >
                <AppIcon name="close" size="h-5 w-5" />
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div v-if="mode === 'list'" class="space-y-2 py-1">
              <label
                v-for="address in addresses"
                :key="address.id"
                class="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition"
                :class="selectedId === address.id ? 'border-primary bg-primary-soft' : 'border-hairline/70 bg-white/60'"
              >
                <input
                  type="radio"
                  name="checkout-address"
                  class="mt-1 h-4 w-4 shrink-0"
                  :checked="selectedId === address.id"
                  @change="selectAddress(address)"
                />
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="t-body font-semibold">{{ address.recipient }} · {{ address.phone }}</span>
                    <span
                      v-if="address.isDefault"
                      class="rounded-full bg-primary-soft px-2 py-0.5 t-micro font-semibold text-primary"
                    >
                      Mặc định
                    </span>
                    <span class="rounded-full bg-paper-deep px-2 py-0.5 t-micro font-medium text-muted">
                      {{ address.label }}
                    </span>
                  </span>
                  <span class="mt-0.5 block t-meta text-muted">
                    {{ [address.line1, address.ward, address.city].filter(Boolean).join(', ') }}
                  </span>
                </span>
              </label>

              <button
                type="button"
                class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline bg-white/40 py-3 t-meta font-medium text-primary active:bg-white/70"
                @click="startCreate"
              >
                <AppIcon name="plus" size="h-4 w-4" />
                Thêm địa chỉ mới
              </button>
            </div>

            <div v-else class="space-y-3 py-1">
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="mb-1 block t-micro font-medium text-muted">Nhãn</span>
                  <input v-model="form.label" type="text" class="field py-2 t-meta" placeholder="Nhà riêng" />
                </label>
                <label class="block">
                  <span class="mb-1 block t-micro font-medium text-muted">Người nhận</span>
                  <input v-model="form.recipient" type="text" class="field py-2 t-meta" autocomplete="name" />
                </label>
              </div>

              <label class="block">
                <span class="mb-1 block t-micro font-medium text-muted">Số điện thoại</span>
                <input v-model="form.phone" type="tel" inputmode="tel" class="field py-2 t-meta" autocomplete="tel" />
              </label>

              <AddressRegionFields
                v-model:city="form.city"
                v-model:ward="form.ward"
                v-model:city-code="form.cityCode"
                v-model:ward-code="form.wardCode"
                dense
                required
                id-prefix="sheet-region"
              />

              <label class="block">
                <span class="mb-1 block t-micro font-medium text-muted">Địa chỉ chi tiết</span>
                <input
                  v-model="form.line1"
                  type="text"
                  class="field py-2 t-meta"
                  placeholder="Số nhà, đường"
                  autocomplete="street-address"
                />
              </label>

              <label class="flex items-center gap-2 t-meta">
                <input v-model="form.isDefault" type="checkbox" class="h-4 w-4 rounded border-hairline text-primary" />
                Đặt làm địa chỉ mặc định
              </label>

              <p v-if="errorMessage" class="rounded-xl bg-discount/10 px-3 py-2 t-micro text-discount" role="alert">
                {{ errorMessage }}
              </p>

              <button type="button" class="btn-primary w-full py-2.5" :disabled="saving" @click="save">
                {{ saving ? 'Đang lưu...' : 'Lưu và dùng địa chỉ này' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s ease;
}

.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}
</style>
