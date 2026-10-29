<script setup lang="ts">
const props = withDefaults(defineProps<{ rating: number; count?: number }>(), { count: 0 })

const stars = computed(() => Array.from({ length: 5 }, (_, index) => index < Math.round(props.rating)))
</script>

<template>
  <span class="inline-flex items-center gap-1" :aria-label="`${rating} trên 5 sao`">
    <span class="flex t-body leading-none text-[#D9A441]">
      <span v-for="(filled, index) in stars" :key="index">{{ filled ? '★' : '☆' }}</span>
    </span>
    <span class="t-meta text-muted">{{ rating }}<template v-if="count"> ({{ count }})</template></span>
  </span>
</template>
