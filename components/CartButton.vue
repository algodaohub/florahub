<script setup lang="ts">
const props = withDefaults(defineProps<{ count?: number }>(), { count: 0 })
</script>

<template>
  <NuxtLink
    to="/cart"
    class="relative grid h-10 w-10 shrink-0 place-items-center border border-hairline bg-white/70 text-ink"
    :style="{ borderRadius: 'var(--radius-btn)' }"
    :aria-label="`Giỏ hàng — ${props.count} sản phẩm`"
  >
    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
      <path
        d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20 7H6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="9.5" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="19.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
    <span
      v-if="props.count > 0"
      class="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-discount px-1 t-micro font-semibold text-white"
    >
      {{ props.count > 99 ? '99+' : props.count }}
    </span>
  </NuxtLink>
</template>
