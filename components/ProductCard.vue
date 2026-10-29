<script setup lang="ts">
import type { ProductCard } from '~/types'

const props = withDefaults(
  defineProps<{
    product: ProductCard
    salePrice?: number
    layout?: 'grid' | 'row'
    /** Bản gọn cho danh sách trong chat: ảnh nhỏ, 1 dòng tên, không badge. */
    compact?: boolean
  }>(),
  { layout: 'grid' }
)

const { openSheet } = useAddToCartSheet()

const effectivePrice = computed(() => props.salePrice ?? props.product.price)
const discount = computed(() => discountPercent(effectivePrice.value, props.product.price))
const isRow = computed(() => props.layout === 'row')
const isCompact = computed(() => props.compact)

function onAdd() {
  openSheet(props.product.handle, { variantId: props.product.variantId ?? undefined })
}
</script>

<template>
  <article
    class="group relative flex overflow-hidden rounded-xl2 border border-hairline/70 bg-white/80 shadow-card"
    :class="isCompact ? 'gap-2.5 p-2' : isRow ? 'gap-3 p-3' : 'flex-col'"
  >
    <NuxtLink
      :to="`/product/${product.handle}`"
      class="relative block shrink-0 overflow-hidden bg-paper-deep"
      :class="isCompact ? 'h-14 w-14 rounded-lg' : isRow ? 'h-28 w-28 rounded-xl' : 'aspect-square w-full'"
    >
      <img
        :src="product.thumbnail"
        :alt="product.title"
        width="400"
        height="400"
        loading="lazy"
        decoding="async"
        class="h-full w-full object-cover"
      />
      <span
        v-if="discount > 0 && !isCompact"
        class="absolute left-2 top-2 rounded-full bg-discount px-2 py-0.5 t-micro font-semibold text-white"
      >
        -{{ discount }}%
      </span>
      <span
        v-if="product.type !== 'physical' && !isCompact"
        class="absolute bottom-2 left-2 rounded-full bg-primary/90 px-2 py-0.5 t-micro font-semibold text-white"
      >
        {{ product.type === 'digital' ? 'Số' : 'Dịch vụ' }}
      </span>
    </NuxtLink>

    <div class="flex min-w-0 flex-1 flex-col" :class="isRow || isCompact ? '' : 'p-2.5'">
      <NuxtLink
        :to="`/product/${product.handle}`"
        class="text-ink"
        :class="isCompact ? 'line-clamp-1 t-meta font-semibold leading-snug' : 'line-clamp-2 t-body font-bold leading-snug'"
      >
        {{ product.title }}
      </NuxtLink>

      <div class="mt-auto flex items-end justify-between gap-1.5" :class="isCompact ? '' : 'pt-2'">
        <div class="min-w-0">
          <p class="font-semibold text-primary" :class="isCompact ? 't-meta' : 't-body'">
            {{ formatVnd(effectivePrice) }}
            <span v-if="!isCompact" class="t-micro font-normal text-muted">/{{ product.unit }}</span>
          </p>
          <p v-if="discount > 0 && !isCompact" class="t-micro text-muted line-through">
            {{ formatVnd(product.price) }}
          </p>
        </div>

        <button
          type="button"
          class="grid shrink-0 place-items-center rounded-full bg-primary text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          :class="isCompact ? 'h-8 w-8' : 'h-9 w-9'"
          :aria-label="`Chọn hạng và thêm ${product.title} vào giỏ hàng`"
          @click.stop.prevent="onAdd"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20 7H6" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="9.5" cy="19.5" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="17" cy="19.5" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>
    </div>
  </article>
</template>
