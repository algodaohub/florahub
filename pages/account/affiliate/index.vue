<script setup lang="ts">
import { showToast } from 'vant'
import type { AffiliateSummary } from '~/types'
import { formatDate, formatOrderCode, formatVnd } from '~/utils/format'

const { site } = useSite()
const { data, pending, error, refresh } = await useFetch<AffiliateSummary>('/api/affiliate', {
  key: 'account-affiliate'
})

const joining = ref(false)

const affiliate = computed(() => data.value?.affiliate ?? null)
const stats = computed(
  () => data.value?.stats ?? { clicks: 0, orders: 0, pending: 0, approved: 0, processing: 0, paid: 0, total: 0 }
)
const effectiveRate = computed(() => affiliate.value?.effectiveRate ?? data.value?.defaultRate ?? 0)
const holdDays = computed(() => data.value?.holdDays ?? 30)
const attributionDays = computed(() => data.value?.attributionDays ?? 30)
const payoutThreshold = computed(() => data.value?.payoutThreshold ?? 0)
const autoReconcile = computed(() => data.value?.autoReconcile !== false)
const payouts = computed(() => data.value?.payouts ?? [])
const commissions = computed(() => data.value?.commissions ?? [])

const hasDraftPayout = computed(() => payouts.value.some((payout) => payout.status === 'draft'))
const remainingToThreshold = computed(() => Math.max(0, payoutThreshold.value - stats.value.approved))
const belowThreshold = computed(
  () => Boolean(payoutThreshold.value) && stats.value.approved > 0 && remainingToThreshold.value > 0
)

const statusLabel: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Khả dụng',
  processing: 'Đang chi trả',
  paid: 'Đã chi trả',
  cancelled: 'Đã huỷ'
}

const payoutStatusLabel: Record<string, string> = {
  draft: 'Đang chuẩn bị chi',
  paid: 'Đã chi',
  cancelled: 'Đã huỷ'
}

const bankForm = reactive({
  bankName: '',
  bankAccountNo: '',
  bankAccountName: '',
  taxCode: ''
})

watch(
  affiliate,
  (value) => {
    bankForm.bankName = value?.bankName ?? ''
    bankForm.bankAccountNo = value?.bankAccountNo ?? ''
    bankForm.bankAccountName = value?.bankAccountName ?? ''
    bankForm.taxCode = value?.taxCode ?? ''
  },
  { immediate: true }
)

const bankReady = computed(
  () => Boolean(bankForm.bankName.trim() && bankForm.bankAccountNo.trim() && bankForm.bankAccountName.trim())
)

const savingBank = ref(false)
const bankMessage = ref('')
const bankError = ref('')

async function saveBank() {
  if (savingBank.value) return
  bankMessage.value = ''
  bankError.value = ''

  const parts = [bankForm.bankName.trim(), bankForm.bankAccountNo.trim(), bankForm.bankAccountName.trim()]
  if (parts.some(Boolean) && !parts.every(Boolean)) {
    bankError.value = 'Nhập đủ ngân hàng, số tài khoản và chủ tài khoản hoặc để trống cả ba.'
    return
  }
  if (bankForm.bankAccountNo.trim() && !/^\d{6,40}$/.test(bankForm.bankAccountNo.replace(/\s+/g, ''))) {
    bankError.value = 'Số tài khoản chỉ gồm 6–40 chữ số.'
    return
  }

  savingBank.value = true
  try {
    await $fetch('/api/affiliate/profile', {
      method: 'PATCH',
      body: {
        bankName: bankForm.bankName,
        bankAccountNo: bankForm.bankAccountNo,
        bankAccountName: bankForm.bankAccountName,
        taxCode: bankForm.taxCode
      }
    })
    await refresh()
    bankMessage.value = 'Đã lưu thông tin nhận hoa hồng.'
    showToast({ message: 'Đã lưu thông tin nhận hoa hồng', position: 'bottom' })
  } catch (err) {
    bankError.value = apiErrorMessage(err, 'Không lưu được thông tin. Vui lòng thử lại.')
  } finally {
    savingBank.value = false
  }
}

async function join() {
  joining.value = true
  try {
    await $fetch('/api/affiliate', { method: 'POST' })
    await refresh()
    showToast({ message: 'Bạn đã tham gia chương trình', position: 'bottom' })
  } finally {
    joining.value = false
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

    <template v-if="pending && !data">
      <section class="overflow-hidden rounded-xl2 bg-primary p-5 text-white shadow-soft">
        <div class="h-12 w-12 animate-pulse rounded-full bg-white/20" />
        <div class="mt-4 h-5 w-40 animate-pulse rounded bg-white/20" />
        <div class="mt-2 h-4 w-full animate-pulse rounded bg-white/15" />
        <div class="mt-2 h-4 w-3/4 animate-pulse rounded bg-white/15" />
        <div class="mt-4 h-12 w-full animate-pulse rounded-full bg-white/20" />
      </section>
      <section class="card mt-3 space-y-3 p-4">
        <div class="h-4 w-32 animate-pulse rounded bg-paper-deep" />
        <div class="h-10 w-full animate-pulse rounded-xl bg-paper-deep" />
        <div class="grid grid-cols-2 gap-2">
          <div class="h-10 animate-pulse rounded-xl bg-paper-deep" />
          <div class="h-10 animate-pulse rounded-xl bg-paper-deep" />
        </div>
      </section>
      <section class="mt-3 grid grid-cols-2 gap-2">
        <div v-for="tile in 4" :key="tile" class="card h-20 animate-pulse p-3" />
      </section>
      <section class="card mt-3 space-y-3 p-4">
        <div class="h-4 w-28 animate-pulse rounded bg-paper-deep" />
        <div v-for="row in 3" :key="row" class="flex items-center gap-3">
          <div class="h-9 w-9 animate-pulse rounded-full bg-paper-deep" />
          <div class="flex-1 space-y-1.5">
            <div class="h-3.5 w-24 animate-pulse rounded bg-paper-deep" />
            <div class="h-3 w-40 animate-pulse rounded bg-paper-deep" />
          </div>
          <div class="h-4 w-16 animate-pulse rounded bg-paper-deep" />
        </div>
      </section>
    </template>

    <section v-else-if="error && !data" class="card mt-3 p-5 text-center">
      <p class="t-body text-muted">Không tải được thông tin cộng tác viên.</p>
      <button type="button" class="btn-ghost mt-3 px-4 py-2 t-meta" @click="refresh()">Thử lại</button>
    </section>

    <section v-else-if="!affiliate" class="overflow-hidden rounded-xl2 bg-primary p-5 text-white shadow-soft">
      <div class="grid h-12 w-12 place-items-center rounded-full bg-white/15">
        <AppIcon name="gift" size="h-6 w-6" />
      </div>
      <h2 class="mt-4 t-page font-semibold">Chia sẻ, nhận hoa hồng</h2>
      <p class="mt-2 t-body text-white/80">
        Mời bạn bè mua sắm qua liên kết của bạn. Mỗi đơn hàng hợp lệ, bạn nhận
        <strong class="text-white">{{ data?.defaultRate ?? 0 }}%</strong> hoa hồng.
      </p>
      <p class="mt-2 t-meta text-white/60">
        Ghi nhận giới thiệu {{ data?.attributionDays ?? 30 }} ngày · Duyệt sau {{ data?.holdDays ?? 30 }} ngày kể từ khi đơn hoàn tất.
      </p>
      <button type="button" class="mt-4 w-full rounded-full bg-white py-3 t-body font-semibold text-primary disabled:opacity-60" :disabled="joining" @click="join">
        {{ joining ? 'Đang tạo liên kết...' : 'Tham gia miễn phí' }}
      </button>
    </section>

    <template v-else>
      <section class="overflow-hidden rounded-xl2 bg-primary p-5 text-white shadow-soft">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="t-meta text-white/70">Hoa hồng đã ghi nhận</p>
            <p class="mt-1 t-display font-semibold">{{ formatVnd(stats.total) }}</p>
          </div>
          <span class="rounded-full bg-white/15 px-2.5 py-1 t-micro font-semibold">
            {{ affiliate.status === 'active' ? 'Hoạt động' : affiliate.status }}
          </span>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <div class="rounded-xl bg-white/10 p-3">
            <p class="t-micro text-white/70">Chờ duyệt</p>
            <p class="mt-0.5 t-body font-semibold">{{ formatVnd(stats.pending) }}</p>
          </div>
          <div class="rounded-xl bg-white/10 p-3">
            <p class="t-micro text-white/70">Khả dụng</p>
            <p class="mt-0.5 t-body font-semibold">{{ formatVnd(stats.approved) }}</p>
          </div>
          <div class="rounded-xl bg-white/10 p-3">
            <p class="t-micro text-white/70">Đang chi trả</p>
            <p class="mt-0.5 t-body font-semibold">{{ formatVnd(stats.processing) }}</p>
          </div>
          <div class="rounded-xl bg-white/10 p-3">
            <p class="t-micro text-white/70">Đã chi trả</p>
            <p class="mt-0.5 t-body font-semibold">{{ formatVnd(stats.paid) }}</p>
          </div>
        </div>
      </section>

      <section class="card mt-3 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="t-section font-semibold">Liên kết giới thiệu</h2>
            <p class="mt-0.5 t-meta text-muted">
              Mã: {{ affiliate.code }} · Hoa hồng {{ effectiveRate }}%
              <span class="text-muted/70">· {{ affiliate.customRate ? 'tỷ lệ riêng' : 'theo chính sách cửa hàng' }}</span>
            </p>
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

        <p class="mt-2 t-micro text-muted">
          Tỷ lệ hoa hồng được chốt theo chính sách tại thời điểm đơn hàng được thanh toán.
        </p>
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
          <p class="t-section font-semibold">{{ effectiveRate }}%</p>
          <p class="mt-0.5 t-micro text-muted">Hoa hồng</p>
        </div>
      </section>

      <section class="card mt-3 p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="t-section font-semibold">Thông tin nhận hoa hồng</h2>
            <p class="mt-0.5 t-meta text-muted">Dùng để lập phiếu chi và đối soát hoa hồng.</p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 t-micro font-semibold"
            :class="bankReady ? 'bg-primary-soft text-primary' : 'bg-amber-50 text-amber-700'"
          >
            {{ bankReady ? 'Đã đủ thông tin' : 'Chưa cập nhật' }}
          </span>
        </div>

        <form class="mt-3 space-y-3" @submit.prevent="saveBank">
          <label class="block">
            <span class="mb-1.5 block t-body font-medium">Ngân hàng</span>
            <input v-model="bankForm.bankName" type="text" maxlength="120" class="field" placeholder="VD: Vietcombank" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="mb-1.5 block t-body font-medium">Số tài khoản</span>
              <input v-model="bankForm.bankAccountNo" type="text" inputmode="numeric" maxlength="40" class="field" placeholder="0123456789" />
            </label>
            <label class="block">
              <span class="mb-1.5 block t-body font-medium">Mã số thuế</span>
              <input v-model="bankForm.taxCode" type="text" maxlength="20" class="field" placeholder="Không bắt buộc" />
            </label>
          </div>
          <label class="block">
            <span class="mb-1.5 block t-body font-medium">Chủ tài khoản</span>
            <input v-model="bankForm.bankAccountName" type="text" maxlength="120" class="field" placeholder="NGUYEN VAN A" />
          </label>

          <p v-if="bankMessage" class="rounded-xl bg-primary-soft px-3 py-2 t-body text-primary" role="status">{{ bankMessage }}</p>
          <p v-if="bankError" class="rounded-xl bg-discount/10 px-3 py-2 t-body text-discount" role="alert">{{ bankError }}</p>

          <button type="submit" class="btn-primary w-full py-2.5" :disabled="savingBank">
            {{ savingBank ? 'Đang lưu...' : 'Lưu thông tin nhận tiền' }}
          </button>
          <p class="t-micro text-muted">
            Thông tin được snapshot vào phiếu chi tại thời điểm lập phiếu; thay đổi sau đó không ảnh hưởng phiếu đã lập.
          </p>
        </form>
      </section>

      <section class="mt-5">
        <div class="flex items-center justify-between">
          <h2 class="t-section font-semibold">Phiếu chi hoa hồng</h2>
          <span class="t-micro text-muted">{{ payouts.length }} phiếu gần nhất</span>
        </div>
        <p
          v-if="belowThreshold && !hasDraftPayout"
          class="mt-2 rounded-xl2 border border-dashed border-hairline bg-white/50 p-3 t-meta text-muted"
        >
          Đã có <strong class="text-ink">{{ formatVnd(stats.approved) }}</strong> hoa hồng khả dụng.
          Cần thêm {{ formatVnd(remainingToThreshold) }} để đạt hạn mức chi trả {{ formatVnd(payoutThreshold) }}.
        </p>
        <div v-if="payouts.length" class="mt-2 divide-y divide-hairline/60 overflow-hidden rounded-xl2 border border-hairline/70 bg-white/70">
          <NuxtLink
            v-for="payout in payouts"
            :key="payout.id"
            :to="`/account/affiliate/payouts/${payout.id}`"
            class="flex items-center gap-3 p-3.5"
          >
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <AppIcon name="wallet" size="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate t-body font-medium">{{ payout.number }}</p>
              <p class="t-micro text-muted">
                {{ payout.createdAt ? formatDate(payout.createdAt) : '—' }} · {{ payout.commissionCount }} dòng
              </p>
            </div>
            <div class="text-right">
              <p class="t-body font-semibold">{{ formatVnd(payout.netTotal) }}</p>
              <p class="t-micro text-muted">{{ payoutStatusLabel[payout.status] ?? payout.status }}</p>
            </div>
          </NuxtLink>
        </div>
        <p v-else class="mt-2 rounded-xl2 border border-dashed border-hairline bg-white/50 p-5 text-center t-body text-muted">
          Chưa có phiếu chi. Hoa hồng khả dụng sẽ được cửa hàng lập phiếu chi.
        </p>
      </section>

      <section class="mt-5">
        <h2 class="t-section font-semibold">Lịch sử hoa hồng</h2>
        <div v-if="commissions.length" class="mt-2 divide-y divide-hairline/60 overflow-hidden rounded-xl2 border border-hairline/70 bg-white/70">
          <div v-for="item in commissions" :key="item.id" class="flex items-center gap-3 p-3.5">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <AppIcon name="bag" size="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/orders/${item.order.id}`" class="truncate t-body font-medium hover:text-primary">
                {{ formatOrderCode(item.order.id) }}
              </NuxtLink>
              <p class="t-micro text-muted">
                {{ formatDate(item.createdAt) }} · {{ item.rate }}%
                <template v-if="item.status === 'pending' && item.eligibleAt">
                  · dự kiến duyệt {{ formatDate(item.eligibleAt) }}
                </template>
              </p>
              <NuxtLink
                v-if="item.payoutId"
                :to="`/account/affiliate/payouts/${item.payoutId}`"
                class="t-micro font-semibold text-primary"
              >
                Xem phiếu chi
              </NuxtLink>
            </div>
            <div class="text-right">
              <p class="t-body font-semibold text-primary">+{{ formatVnd(item.amount) }}</p>
              <p class="t-micro text-muted">{{ statusLabel[item.status] ?? item.status }}</p>
            </div>
          </div>
        </div>
        <p v-else class="mt-2 rounded-xl2 border border-dashed border-hairline bg-white/50 p-5 text-center t-body text-muted">
          Chưa có hoa hồng. Chia sẻ liên kết để bắt đầu.
        </p>
      </section>

      <section class="card mt-4 p-4">
        <h2 class="t-section font-semibold">Cách hoạt động</h2>
        <p class="mt-1 t-micro text-muted">Chính sách hiện tại của cửa hàng</p>
        <ol class="mt-2 space-y-2 t-meta text-muted">
          <li>1. Sao chép hoặc chia sẻ liên kết giới thiệu của bạn.</li>
          <li>2. Khách truy cập qua liên kết và đặt hàng trong {{ attributionDays }} ngày.</li>
          <li>
            3. Hoa hồng {{ effectiveRate }}% tính trên tiền hàng sau giảm giá (đã gồm GTGT, không gồm phí vận chuyển).
            Tỷ lệ được chốt theo chính sách tại thời điểm đơn hàng được thanh toán.
          </li>
          <li>
            4. Hoa hồng được duyệt sau {{ holdDays }} ngày kể từ khi đơn hoàn tất, nếu không phát sinh hoàn/huỷ hoặc khiếu nại.
          </li>
          <li>
            5. Hoa hồng đã duyệt được cộng dồn theo kỳ đối soát{{ autoReconcile ? ' hàng tháng' : '' }}.
            <template v-if="payoutThreshold > 0">
              Khi tổng hoa hồng khả dụng đạt <strong>{{ formatVnd(payoutThreshold) }}</strong>,
              hệ thống lập phiếu chi{{ autoReconcile ? ' tự động' : ' do cửa hàng khởi tạo' }} để chuyển khoản.
            </template>
            <template v-else>Hệ thống lập phiếu chi khi cửa hàng đối soát hoa hồng đã duyệt.</template>
          </li>
          <li>6. Khi chi trả, thuế TNCN 10% được khấu trừ; phiếu chi kèm bản đối soát có thể in để lưu chứng từ.</li>
        </ol>
      </section>
    </template>
  </div>
</template>
