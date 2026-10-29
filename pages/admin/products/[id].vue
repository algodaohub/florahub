<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Sửa sản phẩm' })
useHead({ title: 'Sửa sản phẩm' })
</script>

<template>
  <AdminProductEditor :product-id="String($route.params.id)" />
</template>
