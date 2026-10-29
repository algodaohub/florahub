<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: [() => navigateTo('/admin/orders', { replace: true })],
  title: 'Tổng quan'
})
</script>

<template>
  <div />
</template>
