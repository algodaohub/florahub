<script setup lang="ts">
import type { ProductDetail } from '~/types'

const { open, handle, presetVariantId, presetQuantity, closeSheet } = useAddToCartSheet()
const { add, pending: cartPending } = useCart()

const product = ref<ProductDetail | null>(null)
const loading = ref(false)
const loadError = ref('')
const selectedVariantId = ref('')
const quantity = ref(1)
let requestId = 0

const selectedVariant = computed(
  () => product.value?.variants.find((variant) => variant.id === selectedVariantId.value) ?? product.value?.variants[0] ?? null
)
const price = computed(() => selectedVariant.value?.price ?? 0)
const compareAt = computed(() => selectedVariant.value?.compareAtPrice ?? null)
const discount = computed(() => discountPercent(price.value, compareAt.value))
const maxQuantity = computed(() => Math.max(1, selectedVariant.value?.inventoryQuantity ?? 1))
const total = computed(() => price.value * quantity.value)
const canAdd = computed(() => Boolean(selectedVariant.value) && (selectedVariant.value?.inventoryQuantity ?? 0) > 0)

function variantSpec(variant: ProductDetail['variants'][number]) {
  try {
    const options = JSON.parse(variant.optionsJson || '[]') as Array<{ name?: string; value?: string }>
    const spec = options.find(
      (option) =>
        option.value &&
        option.value !== variant.title &&
        !/hạng|grade/i.test(String(option.name ?? ''))
    )
    if (spec?.value) return spec.value
  } catch {
    // ignore malformed options_json
  }
  if (variant.inventoryQuantity <= 0) return 'Hết hàng'
  return `Còn ${variant.inventoryQuantity} ${product.value?.unit ?? ''}`.trim()
}

function selectVariant(id: string) {
  selectedVariantId.value = id
  const stock = product.value?.variants.find((variant) => variant.id === id)?.inventoryQuantity ?? 0
  quantity.value = Math.min(Math.max(1, quantity.value), Math.max(1, stock))
}

async function loadProduct(value: string) {
  const current = ++requestId
  loading.value = true
  loadError.value = ''
  product.value = null
  try {
    const data = await $fetch<ProductDetail>(`/api/products/${encodeURIComponent(value)}`)
    if (current !== requestId) return
    product.value = data
    const preset = data.variants.find((variant) => variant.id === presetVariantId.value) ?? data.variants[0] ?? null
    selectedVariantId.value = preset?.id ?? ''
    quantity.value = Math.min(Math.max(1, presetQuantity.value), Math.max(1, preset?.inventoryQuantity ?? 1))
  } catch (error) {
    if (current !== requestId) return
    loadError.value = apiErrorMessage(error, 'Không tải được sản phẩm.')
  } finally {
    if (current === requestId) loading.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeSheet()
}

watch(open, (value) => {
  if (import.meta.client) {
    document.body.style.overflow = value ? 'hidden' : ''
    if (value) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  }
  if (value && handle.value) loadProduct(handle.value)
})

watch(handle, (value) => {
  if (open.value && value) loadProduct(value)
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onKeydown)
  }
})

async function onAdd() {
  if (!canAdd.value || cartPending.value) return
  await add(selectedVariantId.value, quantity.value)
  closeSheet()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
        role="dialog"
        aria-modal="true"
        aria-label="Thêm vào giỏ hàng"
        @click.self="closeSheet"
      >
        <div
          class="sheet-panel flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[22px] border border-hairline/70 bg-paper shadow-[0_-18px_50px_-20px_rgba(27,26,22,0.45)]"
          :style="{ maxWidth: 'var(--shell-max)' }"
        >
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div class="flex justify-center pb-1 pt-2.5">
              <span class="h-1 w-10 rounded-full bg-hairline" aria-hidden="true" />
            </div>

            <template v-if="loading">
              <div class="px-4 pb-4 pt-2" aria-hidden="true">
                <div class="flex gap-3">
                  <div class="sk h-[76px] w-[76px] shrink-0 rounded-[12px]" />
                  <div class="min-w-0 flex-1 py-1">
                    <div class="sk h-4 w-4/5 rounded-full" />
                    <div class="sk mt-2 h-3 w-1/3 rounded-full" />
                  </div>
                </div>
                <div class="sk mt-5 h-3.5 w-40 rounded-full" />
                <div class="sk mt-3 h-[74px] rounded-[12px]" />
                <div class="sk mt-2 h-[74px] rounded-[12px]" />
              </div>
            </template>

            <template v-else-if="product">
              <div class="flex items-start gap-3 px-4 pb-4 pt-2">
                <NuxtLink
                  :to="`/product/${product.handle}`"
                  class="block h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[12px] bg-paper-deep"
                  @click="closeSheet"
                >
                  <img
                    :src="product.thumbnail"
                    :alt="product.title"
                    width="76"
                    height="76"
                    decoding="async"
                    class="h-full w-full object-cover"
                  />
                </NuxtLink>

                <div class="min-w-0 flex-1 pt-0.5">
                  <p class="t-title line-clamp-2 font-bold">{{ product.title }}</p>
                  <NuxtLink
                    :to="`/product/${product.handle}`"
                    class="mt-2 inline-flex items-center gap-0.5 t-meta font-semibold text-primary"
                    @click="closeSheet"
                  >
                    Xem chi tiết
                    <AppIcon name="chevron" size="h-3.5 w-3.5" />
                  </NuxtLink>
                </div>

                <button
                  type="button"
                  class="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted"
                  aria-label="Đóng"
                  @click="closeSheet"
                >
                  <AppIcon name="close" size="h-5 w-5" />
                </button>
              </div>

              <div class="border-t border-hairline/70 px-4 pb-1 pt-3.5">
                <h2 class="t-title">
                  {{ product.variants.length > 1 ? 'Chọn hạng và quy cách' : 'Chọn quy cách' }}
                </h2>
              </div>

              <div class="divide-y divide-hairline/50">
                <button
                  v-for="variant in product.variants"
                  :key="variant.id"
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition"
                  :class="selectedVariantId === variant.id ? 'bg-primary-soft/55' : 'bg-transparent'"
                  role="radio"
                  :aria-checked="selectedVariantId === variant.id"
                  @click="selectVariant(variant.id)"
                >
                  <span class="min-w-0 flex-1">
                    <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span class="t-title">{{ variant.title }}</span>
                      <span
                        v-if="variantSpec(variant)"
                        class="rounded-full border border-hairline bg-white/60 px-2 py-0.5 t-micro font-medium text-ink/70"
                      >
                        {{ variantSpec(variant) }}
                      </span>
                    </span>
                    <span class="t-price mt-1.5 flex items-baseline gap-2">
                      {{ formatVnd(variant.price) }}<span class="t-micro font-medium text-ink/70">/{{ product.unit }}</span>
                      <span
                        v-if="variant.compareAtPrice && variant.compareAtPrice > variant.price"
                        class="t-micro font-normal text-muted line-through"
                      >
                        {{ formatVnd(variant.compareAtPrice) }}
                      </span>
                    </span>
                  </span>

                  <span
                    class="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition"
                    :class="selectedVariantId === variant.id ? 'border-primary' : 'border-hairline'"
                    aria-hidden="true"
                  >
                    <span
                      class="h-2.5 w-2.5 rounded-full transition"
                      :class="selectedVariantId === variant.id ? 'bg-primary' : 'bg-transparent'"
                    />
                  </span>
                </button>
              </div>

              <div class="flex items-center justify-between gap-3 border-t border-hairline/70 px-4 py-4">
                <div class="min-w-0">
                  <p class="t-title">Số {{ product.unit }}</p>
                  <p class="t-meta mt-0.5" :class="canAdd ? 'text-muted' : 'text-discount'">
                    {{ canAdd ? `Còn ${selectedVariant?.inventoryQuantity ?? 0} ${product.unit}` : 'Tạm hết hàng' }}
                  </p>
                </div>
                <QuantityStepper v-model="quantity" :max="maxQuantity" :label="`Số ${product.unit}`" />
              </div>
            </template>

            <div v-else class="px-6 py-10 text-center">
              <p class="t-section">Không tải được sản phẩm</p>
              <p class="t-meta text-muted mt-1">{{ loadError || 'Vui lòng thử lại sau ít phút.' }}</p>
              <button type="button" class="btn-ghost mt-4" @click="handle && loadProduct(handle)">Thử lại</button>
            </div>
          </div>

          <div v-if="product && !loading" class="border-t border-hairline/70 bg-paper/95 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-3">
            <div class="flex items-end justify-between gap-3">
              <div class="min-w-0">
                <p class="t-meta text-muted">Tạm tính</p>
                <p class="t-price-lg mt-0.5 flex flex-wrap items-center gap-2">
                  {{ formatVnd(total) }}<span class="t-meta font-medium text-ink/70">/{{ product.unit }}</span>
                  <span v-if="discount" class="ml-2 rounded-full bg-discount px-2 py-0.5 t-micro font-semibold text-white">-{{ discount }}%</span>
                </p>
              </div>
              <span class="t-meta text-muted pb-1">{{ quantity }} {{ product.unit }}</span>
            </div>

            <button
              type="button"
              class="btn-primary mt-3 w-full py-3 t-body"
              :disabled="!canAdd || cartPending"
              @click="onAdd"
            >
              {{ cartPending ? 'Đang thêm...' : canAdd ? 'Thêm vào giỏ hàng' : 'Hết hàng' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
