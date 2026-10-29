<script setup lang="ts">
withDefaults(
  defineProps<{
    count?: number
    columns?: number
    /** Category-style centered tiles (86% wide) instead of edge-to-edge cards. */
    tiles?: boolean
  }>(),
  { count: 6, columns: 2, tiles: false }
)
</script>

<template>
  <ul
    class="grid gap-x-3 gap-y-5"
    :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }"
    aria-hidden="true"
  >
    <li v-for="index in count" :key="index" class="min-w-0">
      <div
        class="sk aspect-square rounded-[16px]"
        :class="tiles ? 'mx-auto w-[86%]' : 'w-full'"
      />
      <div class="mx-auto mt-2.5 h-3 w-4/5 rounded-full sk" />
      <div class="mx-auto mt-1.5 h-3 w-1/2 rounded-full sk" />
    </li>
  </ul>
</template>
