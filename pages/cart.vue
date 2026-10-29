<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import type { CartItem } from '~/types'

const { items, updateItem, removeItem, clear, pending, ensure, refresh } = useCart()
await ensure()

const { config } = useSite()

// Sản phẩm chọn để thanh toán được giữ trong cookie, không đưa lên URL.
const checkoutItems = useCookie<string | null>('checkout_items', {
  maxAge: 60 * 60 * 6,
  sameSite: 'lax',
  path: '/'
})

const requestedIds = computed(() => {
  const value = String(checkoutItems.value ?? '')
  return value ? value.split(',').filter(Boolean) : null
})

const selectedIds = ref<string[]>([])
const selectionReady = ref(false)

watch(
  items,
  (value) => {
    const ids = value.map((item) => item.id)
    if (!selectionReady.value) {
      selectedIds.value = requestedIds.value ? ids.filter((id) => requestedIds.value?.includes(id)) : ids
      selectionReady.value = true
      return
    }
    selectedIds.value = selectedIds.value.filter((id) => ids.includes(id))
  },
  { immediate: true }
)

const selectedItems = computed(() => items.value.filter((item) => selectedIds.value.includes(item.id)))
const selectedCount = computed(() => selectedItems.value.length)
const selectedQuantity = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity, 0))
const selectedSubtotal = computed(() => selectedItems.value.reduce((sum, item) => sum + item.lineTotal, 0))
const allSelected = computed(() => items.value.length > 0 && selectedCount.value === items.value.length)

function goCheckout() {
  if (!canCheckout.value) return
  checkoutItems.value = selectedIds.value.join(',')
  navigateTo('/checkout')
}

const minQuantity = computed(() => Number(config.value.features.minOrderQuantity ?? 0))
const unitLabel = computed(
  () => selectedItems.value[0]?.product.unit || items.value[0]?.product.unit || 'sản phẩm'
)
const minDeficit = computed(() => Math.max(0, minQuantity.value - selectedQuantity.value))
const blockedByMinimum = computed(() => selectedCount.value > 0 && minDeficit.value > 0)
const canCheckout = computed(() => selectedCount.value > 0 && !blockedByMinimum.value)

const promoCode = useCookie<string | null>('promo_code', { maxAge: 60 * 60 * 24 * 7 })
const promoInput = ref(promoCode.value ?? '')
const promoMeta = ref<{ code: string; type: string; value: number } | null>(null)
const promoError = ref('')
const promoPending = ref(false)
const promoOpen = ref(false)

const discount = computed(() => {
  if (!promoMeta.value || selectedSubtotal.value <= 0) return 0
  if (promoMeta.value.type === 'percentage') {
    return Math.min(selectedSubtotal.value, Math.round((selectedSubtotal.value * promoMeta.value.value) / 100))
  }
  return Math.min(selectedSubtotal.value, promoMeta.value.value)
})

function toggleItem(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((itemId) => itemId !== id)
    : [...selectedIds.value, id]
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : items.value.map((item) => item.id)
}

/** "Hạng B · 600 g/bó" — variant name plus a weight/spec option when the product has one. */
function variantSpec(item: CartItem) {
  const parts: string[] = []
  if (item.variant.title) parts.push(item.variant.title)
  try {
    const options = JSON.parse(item.variant.optionsJson || '[]') as Array<{ name?: string; value?: string }>
    const weight = options.find((option) =>
      /khối lượng|trọng lượng|cân nặng|quy cách|weight/i.test(String(option.name ?? ''))
    )
    if (weight?.value) parts.push(String(weight.value))
  } catch {
    // ignore malformed options_json
  }
  return parts.join(' · ')
}

async function reloadCart() {
  await refresh()
  showToast({ message: 'Đã tải lại giỏ hàng', position: 'bottom' })
}

async function applyPromo() {
  promoError.value = ''
  const code = promoInput.value.trim()
  if (!code) {
    promoError.value = 'Vui lòng nhập mã khuyến mãi.'
    return
  }
  promoPending.value = true
  try {
    const result = await $fetch<{ code: string; type: string; value: number; discount: number }>(
      '/api/promotions/validate',
      { method: 'POST', body: { code, subtotal: selectedSubtotal.value } }
    )
    promoMeta.value = { code: result.code, type: result.type, value: result.value }
    promoCode.value = result.code
    promoInput.value = result.code
    promoOpen.value = false
    showToast({ message: `Đã áp dụng mã ${result.code}`, position: 'bottom' })
  } catch (error) {
    promoError.value = apiErrorMessage(error, 'Mã khuyến mãi không hợp lệ.')
    promoMeta.value = null
    promoCode.value = null
  } finally {
    promoPending.value = false
  }
}

function removePromo() {
  promoMeta.value = null
  promoCode.value = null
  promoInput.value = ''
  promoError.value = ''
}

async function clearCart() {
  try {
    await showConfirmDialog({
      title: 'Xoá giỏ hàng?',
      message: 'Tất cả sản phẩm sẽ được xoá khỏi giỏ.',
      confirmButtonText: 'Xoá',
      cancelButtonText: 'Giữ lại'
    })
    await clear()
    removePromo()
  } catch {
    // cancelled
  }
}

async function changeQuantity(id: string, value: number, max: number) {
  const next = Math.min(max, Math.max(1, value))
  await updateItem(id, next)
}

onMounted(async () => {
  if (!promoCode.value) return
  try {
    const result = await $fetch<{ code: string; type: string; value: number }>('/api/promotions/validate', {
      method: 'POST',
      body: { code: promoCode.value, subtotal: selectedSubtotal.value }
    })
    promoMeta.value = { code: result.code, type: result.type, value: result.value }
  } catch {
    removePromo()
  }
})

useHead({ title: 'Giỏ hàng' })
</script>

<template>
  <div class="pb-[168px]">
    <PageHeader title="Giỏ hàng">
      <template #right>
        <button
          type="button"
          class="flex shrink-0 items-center gap-1 t-meta font-medium text-primary disabled:opacity-50"
          :disabled="pending"
          @click="reloadCart"
        >
          <AppIcon name="refresh" size="h-4 w-4" class="shrink-0" />
          Tải lại giỏ hàng
        </button>
      </template>
    </PageHeader>

    <div v-if="!items.length" class="px-3 pt-6">
      <div class="card flex flex-col items-center px-6 py-12 text-center">
        <span class="grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
          <AppIcon name="bag" size="h-8 w-8" />
        </span>
        <h2 class="mt-4 t-section font-semibold">Giỏ hàng đang trống</h2>
        <p class="mt-1 max-w-xs t-body text-muted">Thêm sản phẩm để xem tổng tiền và tiến hành đặt hàng.</p>
        <NuxtLink to="/categories" class="btn-primary mt-5 px-6">Khám phá danh mục</NuxtLink>
      </div>
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-3 border-b border-hairline/60 px-3 py-3">
        <button type="button" class="t-body flex min-w-0 items-center gap-2.5 font-semibold" @click="toggleAll">
          <span
            class="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border transition"
            :class="allSelected ? 'border-primary bg-primary text-white' : 'border-hairline bg-white/80 text-transparent'"
          >
            <AppIcon name="check" size="h-3.5 w-3.5" />
          </span>
          <span class="truncate">Chọn tất cả sản phẩm</span>
        </button>
        <button
          type="button"
          class="flex shrink-0 items-center gap-1 t-meta font-medium text-discount disabled:opacity-40"
          :disabled="pending"
          @click="clearCart"
        >
          <AppIcon name="trash" size="h-3.5 w-3.5" />
          Xoá tất cả
        </button>
      </div>

      <p class="t-body px-3 pb-2 pt-3 text-ink/80">Đã chọn {{ selectedCount }} mặt hàng</p>

      <section class="space-y-2.5 px-3" aria-label="Sản phẩm trong giỏ">
        <article
          v-for="item in items"
          :key="item.id"
          class="flex items-start gap-2.5 rounded-[10px] border border-hairline/70 bg-white/85 p-3"
        >
          <button
            type="button"
            class="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border transition"
            :class="
              selectedIds.includes(item.id)
                ? 'border-primary bg-primary text-white'
                : 'border-hairline bg-white/95 text-transparent'
            "
            :aria-label="`Chọn ${item.product.title}`"
            :aria-pressed="selectedIds.includes(item.id)"
            @click="toggleItem(item.id)"
          >
            <AppIcon name="check" size="h-3.5 w-3.5" />
          </button>

          <NuxtLink
            :to="`/product/${item.product.handle}`"
            class="block h-[78px] w-[78px] shrink-0 overflow-hidden rounded-lg bg-paper-deep"
          >
            <img
              :src="item.product.thumbnail"
              :alt="item.product.title"
              width="78"
              height="78"
              loading="lazy"
              decoding="async"
              class="h-full w-full object-cover"
            />
          </NuxtLink>

          <div class="flex min-w-0 flex-1 flex-col">
            <NuxtLink
              :to="`/product/${item.product.handle}`"
              class="t-title line-clamp-2 font-bold"
            >
              {{ item.product.title }}
            </NuxtLink>

            <p class="t-meta text-muted mt-1 truncate">
              {{ variantSpec(item) }}<template v-if="variantSpec(item)"> · </template>{{ item.product.unit }}
            </p>

            <p class="t-price mt-1">
              {{ formatVnd(item.unitPrice) }}<span class="t-meta font-medium">/{{ item.product.unit }}</span>
            </p>

            <p v-if="item.variant.inventoryQuantity <= 0" class="t-micro mt-1 font-medium text-discount">Hết hàng</p>

            <div class="mt-2 flex items-center justify-end gap-3">
              <div class="inline-flex items-center gap-2.5">
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-full border border-hairline bg-white/70 t-section leading-none text-muted transition active:scale-95 disabled:opacity-40"
                  :aria-label="`Giảm số lượng ${item.product.title}`"
                  :disabled="pending || item.quantity <= 1"
                  @click="changeQuantity(item.id, item.quantity - 1, Math.max(1, item.variant.inventoryQuantity))"
                >
                  −
                </button>
                <span class="w-6 text-center t-body font-medium tabular-nums">{{ item.quantity }}</span>
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-full bg-primary t-section leading-none text-white transition active:scale-95 disabled:opacity-40"
                  :aria-label="`Tăng số lượng ${item.product.title}`"
                  :disabled="pending || item.quantity >= Math.max(1, item.variant.inventoryQuantity)"
                  @click="changeQuantity(item.id, item.quantity + 1, Math.max(1, item.variant.inventoryQuantity))"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-discount/50 bg-white/80 text-discount transition active:scale-95 disabled:opacity-40"
                :aria-label="`Xoá ${item.product.title}`"
                :disabled="pending"
                @click="removeItem(item.id)"
              >
                <AppIcon name="trash" size="h-4 w-4" />
              </button>
            </div>
          </div>
        </article>
      </section>

      <section class="px-3 pt-4">
        <button
          type="button"
          class="t-body font-medium text-primary underline decoration-primary/50 underline-offset-4"
          @click="promoOpen = !promoOpen"
        >
          Mã khuyến mãi
        </button>

        <p v-if="promoMeta" class="mt-2 flex items-center gap-2 t-meta text-primary">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 font-semibold">
            <AppIcon name="check" size="h-3 w-3" />
            {{ promoMeta.code }}
          </span>
          <span class="text-muted">-{{ formatVnd(discount) }}</span>
          <button type="button" class="t-meta font-medium text-discount underline" @click="removePromo">
            Bỏ mã
          </button>
        </p>

        <div v-if="promoOpen && !promoMeta" class="card mt-2.5 p-3">
          <div class="flex gap-2">
            <input
              v-model="promoInput"
              type="text"
              class="field min-w-0 flex-1 py-2 t-meta uppercase"
              placeholder="Nhập mã khuyến mãi"
              autocomplete="off"
              @keyup.enter="applyPromo"
            />
            <button type="button" class="btn-primary shrink-0 px-4 py-2 t-meta" :disabled="promoPending" @click="applyPromo">
              {{ promoPending ? '...' : 'Áp dụng' }}
            </button>
          </div>
          <p v-if="promoError" class="mt-2 t-micro text-discount">{{ promoError }}</p>
        </div>
      </section>
    </template>
  </div>

  <div
    v-if="items.length"
    class="fixed inset-x-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-30 mx-auto w-full"
    :style="{ maxWidth: 'var(--shell-max)' }"
  >
    <p v-if="blockedByMinimum" class="t-body bg-paper-deep px-3 py-2 font-medium text-discount">
      Tối thiểu {{ minQuantity }} {{ unitLabel }}. Thêm {{ minDeficit }} {{ unitLabel }} để tiếp tục.
    </p>
    <div class="border-t border-hairline bg-paper/95 px-3 py-2.5 backdrop-blur">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="flex flex-wrap items-baseline gap-1.5 t-meta text-muted">
            <span>{{ selectedCount ? 'Tạm tính đã chọn' : 'Chưa chọn sản phẩm' }}</span>
            <span class="t-price-lg inline-flex items-center gap-0.5">
              {{ formatVnd(selectedSubtotal) }}
              <AppIcon name="chevron" size="h-3.5 w-3.5" />
            </span>
          </p>
        </div>

        <button v-if="canCheckout" type="button" class="btn-primary shrink-0 px-6 py-2.5 t-body" @click="goCheckout">
          Thanh toán
        </button>
        <button v-else type="button" class="btn-primary shrink-0 px-6 py-2.5 t-body" disabled>Thanh toán</button>
      </div>
    </div>
  </div>
</template>
