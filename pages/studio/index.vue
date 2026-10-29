<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: [() => navigateTo('/admin/storefront', { redirectCode: 301 })]
})
</script>

<template>
  <div />
</template>
