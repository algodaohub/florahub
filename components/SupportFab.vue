<script setup lang="ts">
/** Nút hỗ trợ Zalo nổi ở góc phải. Đổi số tại đây (hoặc thay bằng site.hotline nếu muốn). */
const ZALO_PHONE = '0945245115'
const zaloUrl = `https://zalo.me/${ZALO_PHONE}`
</script>

<template>
  <a
    :href="zaloUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-[#0068FF] px-3.5 py-2.5 t-meta font-semibold text-white shadow-lg shadow-black/20 transition hover:brightness-110"
    :aria-label="`Chat Zalo hỗ trợ ${ZALO_PHONE}`"
  >
    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.5 2 2 5.8 2 10.5c0 2.7 1.5 5.1 3.9 6.7-.1.8-.5 2-.9 2.9-.1.3.1.6.4.5 1.2-.4 2.7-1.1 3.5-1.5.9.2 1.9.3 3.1.3 5.5 0 10-3.8 10-8.5S17.5 2 12 2z" />
    </svg>
    Zalo
  </a>
</template>
