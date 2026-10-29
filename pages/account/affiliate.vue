<script setup lang="ts">
import { showToast } from 'vant'
import type { AffiliateSummary } from '~/types'

const { site } = useSite()
const { data, refresh } = await useFetch<AffiliateSummary>('/api/affiliate', { key: 'account-affiliate' })
const pending = ref(false)

const affiliate = computed(() => data.value?.affiliate ?? null)
const stats = computed(() => data.value?.stats ?? { clicks: 0, orders: 0, pending: 0, paid: 0, total: 0 })
const rate = computed(() => affiliate.value?.commissionRate ?? data.value?.defaultRate ?? 5)

const statusLabel: Record<string, string> = {
  pending: 'Chờ duyệt',
  paid: 'Đã thanh toán',
  cancelled: 'Đã huỷ'
}

async function join() {
  pending.value = true
  try {
    await $fetch('/api/affiliate', { method: 'POST' })
    await refresh()
    showToast({ message: 'Bạn đã tham gia chương trình', position: 'bottom' })
  } finally {
    pending.value = false
  }
}

async function copyLink() {
  if (!affiliate.value) return
  try {
    await navigator.clipboard.writeText(affiliate.value.link)
    showToast({ message: 'Đã sao chép liên kết', position: 'bottom' })
  } catch {
    showToast({ message: 'Không thể sao chép liên kết', position: 'bottom' })
  }
}

async function shareLink() {
  if (!affiliate.value) return
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Mời bạn mua sắm cùng ${site.value.siteName}`,
        text: 'Đặt hàng qua liên kết này để ủng hộ mình nhé.',
        url: affiliate.value.link
      })
      return
    } catch {
      return
    }
  }
  await copyLink()
}

useHead({ title: 'Cộng tác viên' })
</script>

<template>
  <div class="container-page py-0">
    <AccountHeader title="Cộng tác viên" subtitle="Affiliate" />

    <section v-if="!affiliate" class="overflow-hidden rounded-xl2 bg-primary p-5 text-white shadow-soft">
      <div class="grid h-12 w-12 place-items-center rounded-full bg-white/15">
        <AppIcon name="gift" size="h-6 w-6" />
      </div>
      <h2 class="mt-4 t-page font-semibold">Chia sẻ, nhận hoa hồng</h2>
      <p class="mt-2 t-body text-white/80">
        Mời bạn bè mua sắm qua liên kết của bạn. Mỗi đơn hàng phát sinh, bạn nhận {{ rate }}% hoa hồng.
      </p>
      <button type="button" class="mt-4 w-full rounded-full bg-white py-3 t-body font-semibold text-primary disabled:opacity-60" :disabled="pending" @click="join">
        {{ pending ? 'Đang tạo liên kết...' : 'Tham gia miễn phí' }}
      </button>
    </section>

    <template v-else>
      <section class="overflow-hidden rounded-xl2 bg-primary p-5 text-white shadow-soft">
        <p class="t-meta text-white/70">Tổng hoa hồng</p>
        <p class="mt-1 t-display font-semibold">{{ formatVnd(stats.total) }}</p>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <div class="rounded-xl bg-white/10 p-3">
            <p class="t-micro text-white/70">Chờ duyệt</p>
            <p class="mt-0.5 t-body font-semibold">{{ formatVnd(stats.pending) }}</p>
          </div>
          <div class="rounded-xl bg-white/10 p-3">
            <p class="t-micro text-white/70">Đã thanh toán</p>
            <p class="mt-0.5 t-body font-semibold">{{ formatVnd(stats.paid) }}</p>
          </div>
        </div>
      </section>

      <section class="card mt-3 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="t-section font-semibold">Liên kết giới thiệu</h2>
            <p class="mt-0.5 t-meta text-muted">Mã: {{ affiliate.code }} · Hoa hồng {{ affiliate.commissionRate }}%</p>
          </div>
          <span class="rounded-full bg-primary-soft px-2.5 py-1 t-micro font-semibold uppercase text-primary">
            {{ affiliate.status === 'active' ? 'Hoạt động' : affiliate.status }}
          </span>
        </div>

        <div class="mt-3 rounded-xl border border-hairline bg-paper-deep/50 px-3 py-2.5">
          <p class="truncate t-meta text-muted">{{ affiliate.link }}</p>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-2">
          <button type="button" class="btn-primary py-2.5 t-meta" @click="copyLink">Sao chép</button>
          <button type="button" class="btn-ghost py-2.5 t-meta" @click="shareLink">Chia sẻ</button>
        </div>
      </section>

      <section class="mt-3 grid grid-cols-3 gap-2">
        <div class="card p-3 text-center">
          <p class="t-section font-semibold">{{ stats.clicks }}</p>
          <p class="mt-0.5 t-micro text-muted">Lượt truy cập</p>
        </div>
        <div class="card p-3 text-center">
          <p class="t-section font-semibold">{{ stats.orders }}</p>
          <p class="mt-0.5 t-micro text-muted">Đơn hàng</p>
        </div>
        <div class="card p-3 text-center">
          <p class="t-section font-semibold">{{ rate }}%</p>
          <p class="mt-0.5 t-micro text-muted">Hoa hồng</p>
        </div>
      </section>

      <section class="mt-5">
        <h2 class="t-section font-semibold">Lịch sử hoa hồng</h2>
        <div v-if="data?.commissions.length" class="mt-2 divide-y divide-hairline/60 overflow-hidden rounded-xl2 border border-hairline/70 bg-white/70">
          <NuxtLink
            v-for="item in data.commissions"
            :key="item.id"
            :to="`/orders/${item.order.id}`"
            class="flex items-center gap-3 p-3.5"
          >
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <AppIcon name="bag" size="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate t-body font-medium">{{ formatOrderCode(item.order.id) }}</p>
              <p class="t-micro text-muted">{{ formatDate(item.createdAt) }} · {{ item.rate }}%</p>
            </div>
            <div class="text-right">
              <p class="t-body font-semibold text-primary">+{{ formatVnd(item.amount) }}</p>
              <p class="t-micro text-muted">{{ statusLabel[item.status] ?? item.status }}</p>
            </div>
          </NuxtLink>
        </div>
        <p v-else class="mt-2 rounded-xl2 border border-dashed border-hairline bg-white/50 p-5 text-center t-body text-muted">
          Chưa có hoa hồng. Chia sẻ liên kết để bắt đầu.
        </p>
      </section>

      <section class="card mt-4 p-4">
        <h2 class="t-section font-semibold">Cách hoạt động</h2>
        <ol class="mt-2 space-y-2 t-meta text-muted">
          <li>1. Sao chép hoặc chia sẻ liên kết giới thiệu của bạn.</li>
          <li>2. Khách truy cập và đặt hàng trong 30 ngày.</li>
          <li>3. Hoa hồng {{ affiliate.commissionRate }}% được ghi nhận vào tài khoản.</li>
        </ol>
      </section>
    </template>
  </div>
</template>
