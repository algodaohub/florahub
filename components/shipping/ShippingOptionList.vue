<script setup lang="ts">
import type { ShippingQuoteOption } from '~/types/shipping'
import { shippingBadgeLabel } from '~/utils/shipping'

const props = withDefaults(
  defineProps<{
    options: ShippingQuoteOption[]
    modelValue: string | null
    showEta?: boolean
    showSuccessRate?: boolean
    disabled?: boolean
    dense?: boolean
    /** customer: giá khách trả (mặc định). carrier: cước hãng — dùng ở màn admin để shop thấy chi phí thật. */
    feeMode?: 'customer' | 'carrier'
  }>(),
  { showEta: true, showSuccessRate: false, disabled: false, dense: false, feeMode: 'customer' }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function badgeClass(badge: string) {
  if (badge === 'cheapest') return 'bg-emerald-50 text-emerald-700'
  if (badge === 'fastest') return 'bg-sky-50 text-sky-700'
  if (badge === 'recommended') return 'bg-violet-50 text-violet-700'
  return 'bg-amber-50 text-amber-700'
}

function feeLabel(option: ShippingQuoteOption) {
  if (props.feeMode === 'carrier') return formatVnd(option.fee)
  return option.customerFee === 0 ? 'Miễn phí' : formatVnd(option.customerFee)
}
const carrierMode = computed(() => props.feeMode === 'carrier')
</script>

<template>
  <div class="space-y-2" role="radiogroup" aria-label="Phương án vận chuyển">
    <label
      v-for="option in props.options"
      :key="option.id"
      class="flex cursor-pointer items-start gap-2.5 rounded-xl border transition"
      :class="[
        props.dense ? 'p-2.5' : 'p-3',
        props.modelValue === option.id
          ? 'border-primary bg-primary-soft/60 ring-1 ring-inset ring-primary/40'
          : 'border-hairline/70 bg-white/60',
        props.disabled ? 'cursor-not-allowed opacity-70' : ''
      ]"
    >
      <input
        type="radio"
        name="shipping-option"
        class="mt-1 h-4 w-4 shrink-0"
        :value="option.id"
        :checked="props.modelValue === option.id"
        :disabled="props.disabled"
        @change="emit('update:modelValue', option.id)"
      />
      <span class="min-w-0 flex-1">
        <span class="flex flex-wrap items-center gap-1.5">
          <span class="t-body font-semibold">{{ option.carrierName || option.carrier }}</span>
          <span v-if="option.service" class="rounded-full bg-paper-deep px-2 py-0.5 t-micro font-medium text-muted">
            {{ option.service }}
          </span>
          <span
            v-for="badge in option.badges"
            :key="badge"
            class="rounded-full px-2 py-0.5 t-micro font-semibold"
            :class="badgeClass(badge)"
          >
            {{ shippingBadgeLabel(badge) }}
          </span>
        </span>
        <span v-if="props.showEta && option.eta" class="mt-0.5 block t-micro text-muted">{{ option.eta }}</span>
        <span v-if="props.showSuccessRate && option.successRate !== null" class="mt-0.5 block t-micro text-muted">
          Tỷ lệ giao thành công {{ option.successRate }}%
        </span>
      </span>
      <span class="shrink-0 text-right">
        <span
          class="t-body font-semibold"
          :class="carrierMode ? '' : option.customerFee === 0 ? 'text-primary' : ''"
        >
          {{ feeLabel(option) }}
        </span>
        <span v-if="carrierMode" class="block t-micro font-medium text-muted">Shop trả cước VC</span>
        <span
          v-else-if="option.feeOriginal > option.customerFee && option.customerFee > 0"
          class="block t-micro text-muted line-through"
        >
          {{ formatVnd(option.feeOriginal) }}
        </span>
      </span>
    </label>
  </div>
</template>
