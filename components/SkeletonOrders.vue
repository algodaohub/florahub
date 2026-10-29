<script setup lang="ts">
withDefaults(defineProps<{ rows?: number; cards?: boolean }>(), { rows: 5, cards: false })
</script>

<template>
  <div class="space-y-2.5" aria-hidden="true">
    <div
      v-for="index in rows"
      :key="index"
      class="flex items-start gap-3 rounded-[14px] border border-hairline/40 bg-white/55 px-4 py-3.5"
    >
      <div class="sk aspect-square w-16 shrink-0 rounded-[12px]" :class="cards ? '' : 'hidden'" />
      <div class="min-w-0 flex-1 py-1">
        <div class="sk h-3.5 w-2/3 rounded-full" />
        <div class="sk mt-2 h-3 w-2/5 rounded-full" />
      </div>
      <div class="sk mt-1 h-4 w-16 shrink-0 rounded-full" />
    </div>
  </div>
</template>
