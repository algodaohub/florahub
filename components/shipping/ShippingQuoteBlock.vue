<script setup lang="ts">
import type { ShippingPublicPolicy, ShippingQuote } from '~/types/shipping'

const props = withDefaults(
  defineProps<{
    quote: ShippingQuote | null
    policy: ShippingPublicPolicy | null
    modelValue: string | null
    loading?: boolean
    error?: string
    hasAddress?: boolean
    districtCode?: string
  }>(),
  { loading: false, error: '', hasAddress: true, districtCode: '' }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:districtCode': [value: string]
  reload: []
}>()

const districtOptions = computed(() =>
  props.quote?.address?.resolution === 'ambiguous' ? props.quote.address.districtOptions : []
)

const showChoices = computed(
  () => props.quote?.options.length && props.quote.options.length > 1 && Boolean(props.policy?.allowCustomerChoice)
)

const freeShippingMessage = computed(() => {
  const quote = props.quote
  if (!quote?.freeShipping.applied) return ''
  return quote.message || 'Đơn hàng được miễn phí giao hàng.'
})

const needMoreForFreeShipping = computed(() => {
  const quote = props.quote
  if (!quote || quote.freeShipping.applied) return 0
  return Math.max(0, Number(quote.freeShipping.remaining ?? 0))
})
</script>

<template>
  <div class="space-y-3">
    <div v-if="props.loading" class="animate-pulse rounded-xl border border-hairline/70 bg-white/60 p-3">
      <div class="h-3 w-1/3 rounded bg-paper-deep" />
      <div class="mt-2 h-9 rounded-lg bg-paper-deep" />
      <div class="mt-2 h-9 rounded-lg bg-paper-deep" />
    </div>

    <div v-else-if="props.error" class="rounded-xl border border-discount/30 bg-discount/5 p-3">
      <p class="t-micro text-discount">{{ props.error }}</p>
      <button type="button" class="mt-2 t-micro font-semibold text-primary underline underline-offset-2" @click="emit('reload')">
        Thử lại
      </button>
    </div>

    <div v-else-if="!props.hasAddress" class="rounded-xl border border-dashed border-hairline bg-white/50 p-3 text-center">
      <p class="t-micro text-muted">Chọn địa chỉ giao hàng để xem phí vận chuyển.</p>
    </div>

    <template v-else-if="props.quote">
      <div
        v-if="districtOptions.length"
        class="rounded-xl border border-amber-200 bg-amber-50/70 p-3"
      >
        <p class="t-micro font-medium text-amber-800">{{ props.quote.message }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="option in districtOptions"
            :key="option.code"
            type="button"
            class="rounded-full border px-3 py-1.5 t-micro font-semibold transition"
            :class="
              props.districtCode === option.code
                ? 'border-primary bg-primary text-white'
                : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100'
            "
            @click="emit('update:districtCode', option.code)"
          >
            {{ option.name }}
          </button>
        </div>
      </div>

      <div v-else-if="props.quote.mode === 'none'" class="rounded-xl border border-hairline/70 bg-white/60 p-3">
        <p class="t-micro text-muted">{{ props.quote.message || 'Đơn hàng không cần giao hàng.' }}</p>
      </div>

      <template v-else>
        <div
          v-if="props.quote.mode === 'fallback'"
          class="rounded-xl border border-amber-200 bg-amber-50/70 p-3"
        >
          <p class="t-micro font-medium text-amber-800">{{ props.quote.message }}</p>
          <p v-if="!props.quote.options.length" class="mt-1 t-micro text-amber-700">
            Vui lòng kiểm tra lại địa chỉ hoặc liên hệ cửa hàng để được báo phí.
          </p>
        </div>

        <p
          v-if="freeShippingMessage"
          class="rounded-xl bg-primary-soft px-3 py-2 t-micro font-medium text-primary"
        >
          {{ freeShippingMessage }}
        </p>
        <p
          v-else-if="needMoreForFreeShipping > 0"
          class="rounded-xl bg-paper-deep px-3 py-2 t-micro text-muted"
        >
          Mua thêm {{ formatVnd(needMoreForFreeShipping) }} để được miễn phí giao hàng.
        </p>

        <template v-if="props.quote.options.length">
          <ShippingOptionList
            v-if="showChoices"
            :options="props.quote.options"
            :model-value="props.modelValue"
            :show-eta="props.policy?.showEta ?? true"
            :show-success-rate="props.policy?.showSuccessRate ?? false"
            @update:model-value="emit('update:modelValue', $event)"
          />
          <div v-else class="rounded-xl border border-hairline/70 bg-white/60 p-3">
            <p class="flex items-center justify-between gap-3 t-body">
              <span class="min-w-0">
                <span class="font-semibold">
                  {{ props.quote.options[0]?.carrierName || props.quote.options[0]?.carrier }}
                </span>
                <span v-if="props.quote.options[0]?.service" class="ml-1.5 t-micro text-muted">
                  {{ props.quote.options[0]?.service }}
                </span>
                <span
                  v-if="props.policy?.showEta && props.quote.options[0]?.eta"
                  class="mt-0.5 block t-micro text-muted"
                >
                  {{ props.quote.options[0]?.eta }}
                </span>
              </span>
              <span class="shrink-0 font-semibold text-primary">
                {{ props.quote.options[0]?.customerFee === 0 ? 'Miễn phí' : formatVnd(props.quote.options[0]?.customerFee ?? 0) }}
              </span>
            </p>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>
