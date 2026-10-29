<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    size?: string
  }>(),
  { size: 'h-5 w-5' }
)

const paths: Record<string, string> = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5Z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  bag: 'M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20 7H6M9.5 19.5h.01M17 19.5h.01',
  box: 'M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9ZM4 7.5l8 3.5 8-3.5M12 11v9',
  pin: 'M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z',
  wallet: 'M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9ZM4 8h14M16 12h.01',
  bell: 'M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9ZM10 18a2 2 0 0 0 4 0',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20c.8-3.4 3.4-5.2 7-5.2s6.2 1.8 7 5.2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16 16l4 4',
  logout: 'M15 12H4m4-4-4 4 4 4M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8',
  chevron: 'm9 5 7 7-7 7',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  gift: 'M4 9h16v4H4zM5 13v7h14v-7M12 9v11M12 9c-2.5 0-4.5-1.2-4.5-3A2.5 2.5 0 0 1 12 4a2.5 2.5 0 0 1 4.5 2c0 1.8-2 3-4.5 3Z',
  truck: 'M3 6h10v9H3zM13 9h4l3 3v3h-7M7 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  check: 'm5 12 4 4L19 6',
  expand: 'M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5',
  close: 'm6 6 12 12M18 6 6 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13',
  refresh: 'M20 11a8 8 0 0 0-14-4.6L4 8m0-4v4h4M4 13a8 8 0 0 0 14 4.6L20 16m0 4v-4h-4',
  heart: 'M12 21c4.5 0 8-3.2 8-7.2 0-4.4-4-7.3-8-10.8-4 3.5-8 6.4-8 10.8C4 17.8 7.5 21 12 21Z',
  shop: 'M4 9.5h16V20H4V9.5ZM4 9.5 5.8 4h12.4L20 9.5M9 20v-6h6v6',
  mail: 'M4 6h16v12H4V6ZM4 7l8 6 8-6',
  clipboard: 'M9 4h6v3H9V4ZM7 5.5H5V20h14V5.5h-2M8.5 11h7M8.5 15h5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6',
  news: 'M4 5h13v14H5a1 1 0 0 1-1-1V5ZM17 8h3v9a2 2 0 0 1-2 2M7 9h7M7 12h7M7 15h4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 8h.01',
  play: 'M9 5.5 19 12 9 18.5Z',
  barcode: 'M4 5v14M7 5v14M10 5v9M13 5v14M16 5v9M19 5v14M22 5v14'
}
</script>

<template>
  <svg viewBox="0 0 24 24" :class="size" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name] ?? paths.grid" />
  </svg>
</template>
