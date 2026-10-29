<script setup lang="ts">
const orderId = ref('')
const errorMessage = ref('')

function lookupOrder() {
  errorMessage.value = ''
  const value = orderId.value.trim()
  if (!value) {
    errorMessage.value = 'Nhập mã đơn hàng để tra cứu.'
    return
  }
  navigateTo(`/orders/${value}`)
}

const { cart, ensure } = useCart()
await ensure()

useHead({ title: 'Tra cứu đơn hàng' })
</script>

<template>
  <div class="container-page py-6">
    <header>
      <p class="chip">Tài khoản</p>
      <h1 class="mt-3 t-page font-semibold">Xin chào, khách hàng</h1>
      <p class="mt-2 t-body text-muted">
        Bản demo chưa bật đăng nhập. Bạn vẫn có thể tra cứu đơn hàng bằng mã đơn.
      </p>
    </header>

    <div class="mt-4 space-y-3">
      <section class="card p-4">
        <h2 class="t-section font-semibold">Tra cứu đơn hàng</h2>
        <form class="mt-3 flex flex-col gap-2" @submit.prevent="lookupOrder">
          <input
            v-model="orderId"
            class="field flex-1"
            placeholder="Dán mã đơn hàng"
            aria-label="Mã đơn hàng"
          />
          <button type="submit" class="btn-primary">Tra cứu</button>
        </form>
        <p v-if="errorMessage" class="mt-2 t-body text-discount" role="alert">{{ errorMessage }}</p>
        <p class="mt-3 t-meta text-muted">
          Mã đơn có trong trang xác nhận sau khi đặt hàng, dạng <span>ORD-XXXXXX</span>.
        </p>
      </section>

      <section class="card p-5">
        <h2 class="t-section font-semibold">Giỏ hàng của bạn</h2>
        <p class="mt-2 t-body text-muted">
          {{ cart.count }} sản phẩm · {{ formatVnd(cart.total) }}
        </p>
        <NuxtLink to="/cart" class="btn-ghost mt-4 w-full">Mở giỏ hàng</NuxtLink>
        <NuxtLink to="/search" class="btn-primary mt-2 w-full">Tìm sản phẩm</NuxtLink>
      </section>
    </div>

    <section class="mt-4 space-y-2.5">
      <NuxtLink to="/flash-sale" class="card p-4 transition hover:border-primary/40">
        <p class="t-section font-semibold">Ưu đãi hôm nay</p>
        <p class="mt-1 t-body text-muted">Xem các sản phẩm đang giảm giá theo khung giờ.</p>
      </NuxtLink>
      <NuxtLink to="/posts" class="card p-4 transition hover:border-primary/40">
        <p class="t-section font-semibold">Cẩm nang</p>
        <p class="mt-1 t-body text-muted">Hướng dẫn bảo quản và chọn sản phẩm theo mùa.</p>
      </NuxtLink>
      <NuxtLink to="/categories" class="card p-4 transition hover:border-primary/40">
        <p class="t-section font-semibold">Danh mục</p>
        <p class="mt-1 t-body text-muted">Duyệt toàn bộ danh mục sản phẩm.</p>
      </NuxtLink>
    </section>
  </div>
</template>
