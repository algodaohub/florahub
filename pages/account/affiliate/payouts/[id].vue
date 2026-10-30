<script setup lang="ts">
import type { AffiliatePayoutSummary, AffiliateStatement } from '~/types'
import { formatDate, formatVnd } from '~/utils/format'

type PayoutDetailResponse = {
  payout: AffiliatePayoutSummary & { note: string; reference: string }
  statement: AffiliateStatement
}

const route = useRoute()
const id = String(route.params.id ?? '')

const { data, pending, error, refresh } = await useFetch<PayoutDetailResponse>(`/api/affiliate/payouts/${id}`, {
  key: `account-affiliate-payout-${id}`
})

const statement = computed(() => data.value?.statement ?? null)
const payout = computed(() => data.value?.payout ?? null)

const errorMessage = computed(() => {
  const err = error.value as any
  return err?.data?.statusMessage || err?.statusMessage || 'Không tải được phiếu chi.'
})

useHead({ title: 'Phiếu chi hoa hồng' })
</script>

<template>
  <div class="container-page py-0">
    <AccountHeader title="Phiếu chi hoa hồng" subtitle="Đối soát" back-to="/account/affiliate" />

    <div v-if="pending && !data" class="mt-3 rounded-xl2 border border-hairline/70 bg-white p-5 shadow-soft">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          <div class="h-3 w-32 animate-pulse rounded bg-paper-deep" />
          <div class="h-5 w-56 animate-pulse rounded bg-paper-deep" />
          <div class="h-3 w-28 animate-pulse rounded bg-paper-deep" />
        </div>
        <div class="h-6 w-20 animate-pulse rounded-full bg-paper-deep" />
      </div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="h-24 animate-pulse rounded-xl bg-paper-deep" />
        <div class="h-24 animate-pulse rounded-xl bg-paper-deep" />
      </div>
      <div class="mt-4 space-y-2">
        <div v-for="row in 4" :key="row" class="h-9 animate-pulse rounded bg-paper-deep" />
      </div>
      <div class="ml-auto mt-4 h-24 w-full max-w-xs animate-pulse rounded-xl bg-paper-deep" />
    </div>

    <section v-else-if="error" class="card mt-3 p-5 text-center">
      <p class="t-body text-muted">{{ errorMessage }}</p>
      <button type="button" class="btn-ghost mt-3 px-4 py-2 t-meta" @click="refresh()">Thử lại</button>
    </section>

    <template v-else-if="statement">
      <div
        v-if="statement.status === 'draft'"
        class="mb-3 rounded-xl2 border border-amber-200 bg-amber-50 px-4 py-3 t-body text-amber-800"
      >
        Phiếu đang được chuẩn bị và <strong>chưa chi trả</strong>. Bạn sẽ nhận được thông báo khi cửa hàng xác nhận chi.
      </div>
      <div
        v-else-if="statement.status === 'paid'"
        class="mb-3 rounded-xl2 border border-hairline bg-primary-soft px-4 py-3 t-body text-primary"
      >
        Đã chi trả {{ statement.paidAt ? formatDate(statement.paidAt) : '' }} · Thực nhận
        <strong>{{ formatVnd(statement.totals.net) }}</strong>
      </div>
      <div
        v-else-if="statement.status === 'cancelled'"
        class="mb-3 rounded-xl2 border border-discount/30 bg-discount/10 px-4 py-3 t-body text-discount"
      >
        Phiếu chi đã bị huỷ{{ payout?.cancelledAt ? ` ngày ${formatDate(payout.cancelledAt)}` : '' }}.
      </div>

      <AffiliatePaymentStatement :statement="statement" :show-print="statement.status === 'paid'" />
    </template>
  </div>
</template>
