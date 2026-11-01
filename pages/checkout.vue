<script setup lang="ts">
import type { Address } from '~/types'
import type { ShippingPublicPolicy, ShippingQuote } from '~/types/shipping'

const { items: cartItems, refresh, ensure } = useCart()
await ensure()

const { config } = useSite()

const { data: shippingConfig } = await useFetch<{ policy: ShippingPublicPolicy; liveQuotes: boolean }>(
  '/api/shipping/config',
  { key: 'checkout-shipping-config' }
)
const shippingPolicy = computed(() => shippingConfig.value?.policy ?? null)

// Danh sách sản phẩm đã chọn được giữ trong cookie thay vì query string.
const checkoutItems = useCookie<string | null>('checkout_items', {
  maxAge: 60 * 60 * 6,
  sameSite: 'lax',
  path: '/'
})

const selectedIds = computed(() => {
  const value = String(checkoutItems.value ?? '')
  return value ? value.split(',').filter(Boolean) : null
})
const items = computed(() =>
  selectedIds.value ? cartItems.value.filter((item) => selectedIds.value?.includes(item.id)) : cartItems.value
)
const itemsExpanded = ref(false)
const visibleItems = computed(() => (itemsExpanded.value ? items.value : items.value.slice(0, 3)))
const hiddenItemCount = computed(() => Math.max(0, items.value.length - visibleItems.value.length))
const subtotal = computed(() => items.value.reduce((sum, item) => sum + item.lineTotal, 0))
const backToCart = '/cart'
const paymentMethod = computed(() => resolvePaymentMethod(config.value.payments))

const { user, isLoggedIn } = useAuth()
const { data: addressData, refresh: refreshAddresses } = await useFetch<{ addresses: Address[] }>(
  '/api/account/addresses',
  { key: 'checkout-addresses', immediate: isLoggedIn.value }
)
const savedAddresses = computed(() => addressData.value?.addresses ?? [])
const selectedAddressId = ref<string | null>(null)
const selectedAddress = computed(
  () => savedAddresses.value.find((item) => item.id === selectedAddressId.value) ?? null
)
const addressSheetOpen = ref(false)

function formatAddress(address: Address) {
  return [address.line1, address.ward, address.city].filter(Boolean).join(', ')
}

function selectDefaultAddress() {
  const preferred = savedAddresses.value.find((item) => item.isDefault) ?? savedAddresses.value[0]
  selectedAddressId.value = preferred?.id ?? null
}

const promoCode = useCookie<string | null>('promo_code', { maxAge: 60 * 60 * 24 * 7 })
const promoInput = ref(promoCode.value ?? '')
const promoOpen = ref(false)
const promoMeta = ref<{ code: string; type: string; value: number } | null>(null)
const promoError = ref('')
const promoPending = ref(false)

const discount = computed(() => {
  if (!promoMeta.value || subtotal.value <= 0) return 0
  if (promoMeta.value.type === 'percentage') {
    return Math.min(subtotal.value, Math.round((subtotal.value * promoMeta.value.value) / 100))
  }
  return Math.min(subtotal.value, promoMeta.value.value)
})
const grandTotal = computed(() => Math.max(0, subtotal.value - discount.value + shipping.value))
const goodsTotal = computed(() => Math.max(0, subtotal.value - discount.value))

const form = reactive({
  name: user.value?.displayName ?? '',
  email: user.value?.email ?? '',
  phone: user.value?.phone ?? '',
  address: '',
  note: ''
})

// Khách chưa đăng nhập: chọn địa chỉ theo chuẩn 2 cấp rồi ghép thành chuỗi giao hàng.
const guestAddress = reactive({ city: '', ward: '', cityCode: '', wardCode: '', line1: '' })

// --- Vận chuyển: báo giá server-side, client chỉ giữ optionId ---
const quote = ref<ShippingQuote | null>(null)
const quotePending = ref(false)
const quoteError = ref('')
const selectedShippingOptionId = ref<string | null>(null)
const manualDistrictCode = ref('')

const quoteAddress = computed(() => {
  if (isLoggedIn.value) {
    const address = selectedAddress.value
    if (!address) return null
    return {
      cityCode: address.cityCode ?? '',
      cityName: address.city,
      wardCode: address.wardCode ?? '',
      wardName: address.ward,
      street: address.line1
    }
  }
  if (!guestAddress.city || !guestAddress.ward) return null
  return {
    cityCode: guestAddress.cityCode,
    cityName: guestAddress.city,
    wardCode: guestAddress.wardCode,
    wardName: guestAddress.ward,
    street: guestAddress.line1.trim()
  }
})
const hasQuoteAddress = computed(() => Boolean(quoteAddress.value?.cityName && quoteAddress.value?.wardName))

const selectedShippingOption = computed(
  () => quote.value?.options.find((option) => option.id === selectedShippingOptionId.value) ?? null
)
const shipping = computed(() => {
  if (quote.value?.mode === 'none') return 0
  return selectedShippingOption.value?.customerFee ?? 0
})
const shippingDisplay = computed(() => {
  if (quotePending.value) return 'Đang tính…'
  if (quote.value?.mode === 'none') return 'Không cần giao'
  if (!selectedShippingOption.value) return '—'
  return shipping.value === 0 ? 'Miễn phí' : formatVnd(shipping.value)
})

const shippingExpanded = ref(false)
const canChangeShipping = computed(
  () => Boolean(shippingPolicy.value?.allowCustomerChoice) && (quote.value?.optionCount ?? 0) > 1
)
// Chọn mặc định xong thì ẩn hẳn cụm vận chuyển; chỉ mở lại khi khách bấm "Đổi"
// hoặc khi báo giá cần xử lý (lỗi, khu vực mơ hồ, phí dự phòng).
const showShippingSection = computed(() => {
  if (shippingExpanded.value) return true
  if (!hasQuoteAddress.value) return false
  if (quoteError.value) return true
  const current = quote.value
  if (!current || current.mode === 'none') return false
  if (current.mode === 'fallback' || current.address?.resolution === 'ambiguous') return true
  return current.options.length === 0
})
const shippingHint = computed(() => {
  const current = quote.value
  if (!current) return ''
  if (current.freeShipping.applied) return current.message || 'Đơn hàng được miễn phí giao hàng.'
  const remaining = Number(current.freeShipping.remaining ?? 0)
  return remaining > 0 ? `Mua thêm ${formatVnd(remaining)} để được miễn phí giao.` : ''
})

const quoteSignature = computed(() =>
  [
    quoteAddress.value?.cityCode,
    quoteAddress.value?.cityName,
    quoteAddress.value?.wardCode,
    quoteAddress.value?.wardName,
    manualDistrictCode.value,
    subtotal.value,
    discount.value,
    paymentMethod.value
  ].join('|')
)

let quoteTimer: ReturnType<typeof setTimeout> | null = null

async function requestQuote() {
  if (import.meta.server || !items.value.length || !hasQuoteAddress.value) return
  if (quoteTimer) {
    clearTimeout(quoteTimer)
    quoteTimer = null
  }
  quotePending.value = true
  quoteError.value = ''
  try {
    const result = await $fetch<ShippingQuote>('/api/shipping/quote', {
      method: 'POST',
      body: {
        ...quoteAddress.value,
        districtCode: manualDistrictCode.value || undefined,
        itemIds: items.value.map((item) => item.id),
        paymentMethod: paymentMethod.value,
        promoCode: promoMeta.value?.code ?? ''
      }
    })
    quote.value = result
    const keep = result.options.some((option) => option.id === selectedShippingOptionId.value)
    selectedShippingOptionId.value = keep
      ? selectedShippingOptionId.value
      : (result.selectedOptionId ?? result.options[0]?.id ?? null)
  } catch (error: unknown) {
    quote.value = null
    selectedShippingOptionId.value = null
    quoteError.value = apiErrorMessage(error, 'Không tính được phí vận chuyển. Vui lòng thử lại.')
  } finally {
    quotePending.value = false
  }
}

function scheduleQuote() {
  if (quoteTimer) clearTimeout(quoteTimer)
  quoteTimer = setTimeout(() => {
    quoteTimer = null
    void requestQuote()
  }, 350)
}

watch(
  () => [quoteAddress.value?.cityCode, quoteAddress.value?.cityName, quoteAddress.value?.wardCode, quoteAddress.value?.wardName].join('|'),
  () => {
    manualDistrictCode.value = ''
  }
)
watch(quoteSignature, scheduleQuote)

function shippingQuoteErrorCode(error: unknown) {
  const code = (error as any)?.data?.data?.code ?? (error as any)?.data?.code
  return typeof code === 'string' && code.startsWith('SHIPPING_QUOTE') ? code : ''
}

watch(
  savedAddresses,
  () => {
    if (!isLoggedIn.value) return
    const stillExists = savedAddresses.value.some((item) => item.id === selectedAddressId.value)
    if (!stillExists) selectDefaultAddress()
  },
  { immediate: true }
)

watch(
  selectedAddress,
  (address) => {
    if (!address) return
    form.name = address.recipient
    form.phone = address.phone
    form.address = formatAddress(address)
  },
  { immediate: true }
)

function openAddressSheet() {
  addressSheetOpen.value = true
}

function handleAddressSelected(id: string) {
  selectedAddressId.value = id
}

async function handleAddressCreated(address: Address) {
  await refreshAddresses()
  if (!savedAddresses.value.some((item) => item.id === address.id)) {
    addressData.value = { addresses: [address, ...savedAddresses.value] }
  }
  selectedAddressId.value = address.id
}

const submitting = ref(false)
const errorMessage = ref('')

async function applyPromo() {
  promoError.value = ''
  const code = promoInput.value.trim()
  if (!code) {
    promoError.value = 'Vui lòng nhập mã giảm giá.'
    return
  }
  promoPending.value = true
  try {
    const result = await $fetch<{ code: string; type: string; value: number }>('/api/promotions/validate', {
      method: 'POST',
      body: { code, subtotal: subtotal.value }
    })
    promoMeta.value = { code: result.code, type: result.type, value: result.value }
    promoCode.value = result.code
    promoInput.value = result.code
  } catch (error) {
    promoError.value = apiErrorMessage(error, 'Mã giảm giá không hợp lệ.')
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

function clearPromo() {
  removePromo()
  promoOpen.value = false
}

async function submitOrder() {
  errorMessage.value = ''
  if (isLoggedIn.value && !selectedAddress.value) {
    addressSheetOpen.value = true
    return
  }
  if (!form.name || !form.phone) {
    errorMessage.value = 'Vui lòng nhập họ tên và số điện thoại.'
    return
  }
  if (!isLoggedIn.value) {
    if (!guestAddress.city || !guestAddress.ward || !guestAddress.line1.trim()) {
      errorMessage.value = 'Vui lòng chọn tỉnh/thành, phường/xã và nhập địa chỉ chi tiết.'
      return
    }
    form.address = [guestAddress.line1.trim(), guestAddress.ward, guestAddress.city].join(', ')
  }
  if (!form.address) {
    errorMessage.value = 'Vui lòng nhập địa chỉ nhận hàng.'
    return
  }
  if (!form.email.includes('@')) {
    errorMessage.value = 'Email không hợp lệ.'
    return
  }
  if (hasQuoteAddress.value && quote.value?.mode !== 'none') {
    if (quotePending.value) {
      errorMessage.value = 'Đang tính phí vận chuyển, vui lòng chờ một chút.'
      return
    }
    if (!selectedShippingOption.value) {
      errorMessage.value = quoteError.value || 'Chưa có phương án vận chuyển cho địa chỉ này.'
      return
    }
  }

  const buildBody = () => ({
    ...form,
    promoCode: promoMeta.value?.code ?? '',
    itemIds: items.value.map((item) => item.id),
    shippingQuoteId: quote.value?.quoteId || undefined,
    shippingOptionId: selectedShippingOptionId.value || undefined,
    cityCode: quoteAddress.value?.cityCode || undefined,
    cityName: quoteAddress.value?.cityName || undefined,
    wardCode: quoteAddress.value?.wardCode || undefined,
    wardName: quoteAddress.value?.wardName || undefined,
    districtCode: manualDistrictCode.value || undefined
  })

  submitting.value = true
  try {
    let result: { orderId: string; paymentMethod?: string }
    try {
      result = await $fetch<{ orderId: string; paymentMethod?: string }>('/api/orders', {
        method: 'POST',
        body: buildBody()
      })
    } catch (error: unknown) {
      // Quote hết hạn/giỏ đổi giá → báo lại phí một lần rồi thử đặt lại.
      if (!shippingQuoteErrorCode(error)) throw error
      await requestQuote()
      if (!quote.value || !selectedShippingOption.value) throw error
      result = await $fetch<{ orderId: string; paymentMethod?: string }>('/api/orders', {
        method: 'POST',
        body: buildBody()
      })
    }
    checkoutItems.value = null
    await refresh()
    if (result.paymentMethod === 'sepay') {
      try {
        const redirected = await startSepayCheckout(result.orderId)
        if (redirected) return
      } catch {
        // Cổng thanh toán lỗi → mở trang đơn để khách thử lại.
      }
    }
    await navigateTo(`/orders/${result.orderId}`, { replace: true })
  } catch (error: unknown) {
    errorMessage.value = apiErrorMessage(error, 'Không thể tạo đơn hàng. Vui lòng thử lại.')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (isLoggedIn.value) {
    await refreshAddresses()
  }
  if (promoCode.value) {
    try {
      const result = await $fetch<{ code: string; type: string; value: number }>('/api/promotions/validate', {
        method: 'POST',
        body: { code: promoCode.value, subtotal: subtotal.value }
      })
      promoMeta.value = { code: result.code, type: result.type, value: result.value }
    } catch {
      removePromo()
    }
  }
  await requestQuote()
})

useHead({ title: 'Đặt hàng' })
</script>

<template>
  <div>
    <PageHeader title="Đặt hàng" :subtitle="`${items.length} sản phẩm`" back :back-to="backToCart" />
    <div class="container-page pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-3">

    <div v-if="!items.length" class="card flex flex-col items-center px-6 py-12 text-center">
      <span class="grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
        <AppIcon name="bag" size="h-8 w-8" />
      </span>
      <h2 class="mt-4 t-section font-semibold">Chưa có sản phẩm để đặt</h2>
      <p class="mt-1 max-w-xs t-body text-muted">Giỏ hàng đang trống. Chọn sản phẩm trước khi tiến hành đặt hàng.</p>
      <NuxtLink to="/categories" class="btn-primary mt-5 px-6">Xem danh mục</NuxtLink>
    </div>

    <form v-else class="space-y-3" @submit.prevent="submitOrder">
      <!-- Đơn hàng -->
      <section class="card p-3.5 lg:p-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="t-section">Đơn hàng</h2>
          <span class="t-micro text-muted">{{ items.length }} sản phẩm</span>
        </div>
        <ul class="mt-1 divide-y divide-hairline/60">
          <li v-for="item in visibleItems" :key="item.id" class="flex gap-2.5 py-2.5">
            <img
              :src="item.product.thumbnail"
              :alt="item.product.title"
              width="48"
              height="48"
              loading="lazy"
              decoding="async"
              class="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
            <div class="min-w-0 flex-1">
              <p class="t-meta line-clamp-2 font-medium leading-snug">{{ item.product.title }}</p>
              <p class="mt-0.5 t-micro text-muted">{{ item.variant.title }} × {{ item.quantity }}</p>
            </div>
            <p class="shrink-0 t-meta font-medium">{{ formatVnd(item.lineTotal) }}</p>
          </li>
        </ul>
        <button
          v-if="hiddenItemCount"
          type="button"
          class="mt-1 w-full rounded-lg border border-dashed border-hairline py-1.5 t-micro font-medium text-primary active:bg-primary-soft"
          @click="itemsExpanded = !itemsExpanded"
        >
          {{ itemsExpanded ? 'Thu gọn' : `Xem thêm ${hiddenItemCount} sản phẩm` }}
        </button>
      </section>

      <!-- Địa chỉ nhận hàng -->
      <section class="card p-3.5 lg:p-4">
        <template v-if="isLoggedIn">
          <div v-if="selectedAddress" class="flex items-start gap-2.5">
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <AppIcon name="pin" size="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="t-micro font-medium text-muted">Giao đến</p>
              <p class="mt-0.5 flex flex-wrap items-center gap-1.5 t-body font-semibold">
                {{ selectedAddress.recipient }} · {{ selectedAddress.phone }}
                <span
                  v-if="selectedAddress.isDefault"
                  class="rounded-full bg-primary-soft px-2 py-0.5 t-micro font-semibold text-primary"
                >
                  Mặc định
                </span>
              </p>
              <p class="mt-0.5 t-meta text-muted">{{ formatAddress(selectedAddress) }}</p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg px-1.5 py-1 t-micro font-semibold text-primary active:bg-primary-soft"
              @click="openAddressSheet"
            >
              Thay đổi
            </button>
          </div>

          <div v-else class="flex items-center gap-2.5">
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <AppIcon name="pin" size="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="t-body font-semibold">Bạn chưa có địa chỉ giao hàng</p>
              <p class="t-micro text-muted">Thêm địa chỉ để tính phí và giao hàng.</p>
            </div>
            <button type="button" class="btn-primary shrink-0 px-3 py-2 t-micro" @click="openAddressSheet">
              Thêm
            </button>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center gap-2.5">
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <AppIcon name="pin" size="h-4 w-4" />
            </span>
            <div>
              <p class="t-micro font-medium text-muted">Giao đến</p>
              <p class="t-body font-semibold">Thông tin người nhận</p>
            </div>
          </div>
          <div class="mt-3 grid gap-2.5 sm:grid-cols-2">
            <label class="flex flex-col gap-1 t-micro">
              <span class="font-medium">Họ tên <span class="text-discount">*</span></span>
              <input v-model="form.name" class="field py-2 t-meta" autocomplete="name" required />
            </label>
            <label class="flex flex-col gap-1 t-micro">
              <span class="font-medium">Số điện thoại <span class="text-discount">*</span></span>
              <input v-model="form.phone" class="field py-2 t-meta" inputmode="tel" autocomplete="tel" required />
            </label>
            <label class="flex flex-col gap-1 t-micro sm:col-span-2">
              <span class="font-medium">Email <span class="text-discount">*</span></span>
              <input v-model="form.email" type="email" class="field py-2 t-meta" autocomplete="email" required />
            </label>
            <div class="sm:col-span-2">
              <AddressRegionFields
                v-model:city="guestAddress.city"
                v-model:ward="guestAddress.ward"
                v-model:city-code="guestAddress.cityCode"
                v-model:ward-code="guestAddress.wardCode"
                dense
                required
                id-prefix="guest-region"
              />
            </div>
            <label class="flex flex-col gap-1 t-micro sm:col-span-2">
              <span class="font-medium">Địa chỉ chi tiết <span class="text-discount">*</span></span>
              <input
                v-model="guestAddress.line1"
                class="field py-2 t-meta"
                placeholder="Số nhà, đường"
                autocomplete="street-address"
                required
              />
            </label>
          </div>
        </template>
      </section>

      <!-- Vận chuyển: chỉ hiện khi cần khách quyết định -->
      <section v-if="showShippingSection" class="card p-3.5 lg:p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <AppIcon name="truck" size="h-4 w-4 text-primary" />
            <h2 class="t-body font-semibold">Vận chuyển</h2>
          </div>
          <button
            v-if="shippingExpanded"
            type="button"
            class="t-micro font-semibold text-primary"
            @click="shippingExpanded = false"
          >
            Thu gọn
          </button>
          <span v-else-if="quotePending" class="t-micro text-muted">Đang tính…</span>
        </div>
        <ShippingQuoteBlock
          v-model="selectedShippingOptionId"
          v-model:district-code="manualDistrictCode"
          class="mt-2.5"
          :quote="quote"
          :policy="shippingPolicy"
          :loading="quotePending"
          :error="quoteError"
          :has-address="hasQuoteAddress"
          @reload="requestQuote"
        />
      </section>

      <!-- Cụm tiền -->
      <section class="card p-3.5 lg:p-4">
        <h2 class="t-section">Tổng kết đơn hàng</h2>

        <div class="mt-2 flex items-center justify-between gap-3">
          <span class="t-meta font-medium">Mã giảm giá</span>
          <button
            v-if="!promoMeta && !promoOpen"
            type="button"
            class="t-micro font-semibold text-primary"
            @click="promoOpen = true"
          >
            Nhập mã
          </button>
          <button v-else-if="promoMeta" type="button" class="t-micro font-medium text-discount" @click="clearPromo">
            Bỏ mã
          </button>
        </div>
        <p
          v-if="promoMeta"
          class="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 t-micro font-semibold text-primary"
        >
          <AppIcon name="check" size="h-3.5 w-3.5" />
          {{ promoMeta.code }} · -{{ formatVnd(discount) }}
        </p>
        <div v-if="!promoMeta && promoOpen" class="mt-2 flex gap-2">
          <input
            v-model="promoInput"
            type="text"
            class="field py-2 t-meta uppercase"
            placeholder="Nhập mã giảm giá"
            autocomplete="off"
            @keydown.enter.prevent="applyPromo"
          />
          <button type="button" class="btn-primary shrink-0 px-3 py-2 t-micro" :disabled="promoPending" @click="applyPromo">
            {{ promoPending ? '...' : 'Áp dụng' }}
          </button>
        </div>
        <p v-if="promoError" class="mt-1.5 t-micro text-discount">{{ promoError }}</p>

        <p
          v-if="shippingHint"
          class="mt-2.5 rounded-xl px-3 py-2 t-micro font-semibold"
          :class="quote?.freeShipping.applied ? 'bg-primary-soft text-primary' : 'bg-accent-soft text-accent'"
        >
          {{ shippingHint }}
        </p>

        <dl class="mt-2.5 space-y-1.5 border-t border-hairline/70 pt-2.5 t-meta">
          <div v-if="discount > 0" class="flex justify-between gap-3">
            <dt class="text-muted">Giảm giá</dt>
            <dd class="text-discount">-{{ formatVnd(discount) }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">Tổng tiền hàng</dt>
            <dd>{{ formatVnd(goodsTotal) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted">Phí vận chuyển</dt>
            <dd class="flex items-center justify-end gap-2">
              {{ shippingDisplay }}
              <button
                v-if="canChangeShipping"
                type="button"
                class="t-micro font-semibold text-primary"
                @click="shippingExpanded = true"
              >
                Đổi
              </button>
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-t border-hairline/70 pt-2">
            <dt class="t-body font-semibold">Tổng cộng</dt>
            <dd class="t-section font-semibold text-primary">{{ formatVnd(grandTotal) }}</dd>
          </div>
        </dl>
        <p v-if="config.features.taxRate > 0" class="mt-1.5 t-micro text-muted">
          Giá đã bao gồm VAT {{ config.features.taxRate }}%, không cộng thêm khi thanh toán.
        </p>
      </section>

      <!-- Ghi chú -->
      <section class="card p-3.5 lg:p-4">
        <h2 class="t-body font-semibold">Ghi chú</h2>
        <textarea
          v-model="form.note"
          rows="2"
          class="field mt-2 rounded-xl py-2 t-meta"
          placeholder="Thời gian giao, yêu cầu đóng gói… (không bắt buộc)"
        />
      </section>

      <!-- Thanh đặt hàng cố định ở mọi kích thước màn hình -->
      <div
        class="fixed inset-x-0 bottom-0 z-40 mx-auto w-full border-t border-hairline bg-paper/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_30px_-20px_rgba(27,26,22,0.45)] backdrop-blur-md"
        :style="{ maxWidth: `${config.layout.shellWidth}px` }"
      >
        <p v-if="errorMessage" class="mb-2 rounded-xl bg-discount/10 px-3 py-1.5 t-micro text-discount" role="alert">
          {{ errorMessage }}
        </p>
        <div class="flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="t-micro text-muted">Tổng cộng · {{ items.length }} sản phẩm</p>
            <p class="t-section font-semibold leading-tight text-primary">{{ formatVnd(grandTotal) }}</p>
          </div>
          <button type="submit" class="btn-primary min-w-0 flex-1 py-3" :disabled="submitting">
            {{ submitting ? 'Đang tạo đơn...' : 'Đặt hàng' }}
          </button>
        </div>
      </div>
    </form>

    <CheckoutAddressSheet
      v-model:open="addressSheetOpen"
      :addresses="savedAddresses"
      :selected-id="selectedAddressId"
      :default-recipient="form.name"
      :default-phone="form.phone"
      @select="handleAddressSelected"
      @created="handleAddressCreated"
    />
    </div>
  </div>
</template>
