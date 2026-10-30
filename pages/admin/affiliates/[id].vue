<script setup lang="ts">
import type {
  AdminAffiliateClickItem,
  AdminAffiliateCommissionItem,
  AdminAffiliateDetail
} from '~/types/admin'
import type { AffiliatePayoutSummary } from '~/types'
import { formatDate, formatDateTime, formatOrderCode, formatVnd } from '~/utils/format'
import { commissionStatusMeta, payoutStatusMeta, type BadgeTone } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Cộng tác viên' })

type CommissionPage = {
  page: number
  perPage: number
  total: number
  totalPages: number
  holdDays: number
  items: AdminAffiliateCommissionItem[]
}

type ClickPage = {
  page: number
  perPage: number
  total: number
  totalPages: number
  items: AdminAffiliateClickItem[]
}

type PayoutPage = {
  page: number
  perPage: number
  total: number
  totalPages: number
  items: AffiliatePayoutSummary[]
}

const route = useRoute()
const requestFetch = useRequestFetch()
const id = String(route.params.id ?? '')

const { data, pending, error, refresh } = await useAsyncData<AdminAffiliateDetail>(
  `admin-affiliate-${id}`,
  () => requestFetch<AdminAffiliateDetail>(`/api/admin/affiliates/${id}`)
)

const affiliate = computed(() => data.value?.affiliate ?? null)
const user = computed(() => data.value?.user ?? null)
const stats = computed(() => data.value?.stats ?? { pending: 0, approved: 0, processing: 0, paid: 0, total: 0 })
const available = computed(() => data.value?.available ?? { count: 0, gross: 0, tax: 0, net: 0 })
const defaults = computed(
  () =>
    data.value?.defaults ?? {
      rate: 0,
      holdDays: 30,
      attributionDays: 30,
      payoutThreshold: 0,
      autoReconcile: true
    }
)

const AFFILIATE_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: 'Hoạt động', tone: 'green' },
  suspended: { label: 'Tạm dừng', tone: 'rose' }
}

const statusMeta = computed(
  () => AFFILIATE_STATUS_META[affiliate.value?.status ?? ''] ?? { label: affiliate.value?.status || '—', tone: 'gray' as BadgeTone }
)

const form = reactive({
  commissionRate: 0,
  customRate: false,
  status: 'active',
  bankName: '',
  bankAccountNo: '',
  bankAccountName: '',
  taxCode: ''
})

watch(
  data,
  (value) => {
    if (!value) return
    form.commissionRate = value.affiliate.commissionRate
    form.customRate = value.affiliate.customRate
    form.status = value.affiliate.status || 'active'
    form.bankName = value.affiliate.bankName
    form.bankAccountNo = value.affiliate.bankAccountNo
    form.bankAccountName = value.affiliate.bankAccountName
    form.taxCode = value.affiliate.taxCode
  },
  { immediate: true }
)

watch(
  () => form.customRate,
  (enabled) => {
    if (enabled && !form.commissionRate) form.commissionRate = defaults.value.rate
  }
)

const savedBankReady = computed(() => {
  const current = affiliate.value
  if (!current) return false
  return Boolean(current.bankName && current.bankAccountNo && current.bankAccountName)
})

const saving = ref(false)
const message = ref('')
const errorMessage = ref('')

async function saveProfile() {
  if (saving.value) return
  message.value = ''
  errorMessage.value = ''

  if (form.customRate && (form.commissionRate < 0 || form.commissionRate > 100)) {
    errorMessage.value = 'Tỷ lệ hoa hồng phải từ 0 đến 100%.'
    return
  }
  const bankParts = [form.bankName.trim(), form.bankAccountNo.trim(), form.bankAccountName.trim()]
  if (bankParts.some(Boolean) && !bankParts.every(Boolean)) {
    errorMessage.value = 'Nhập đủ ngân hàng, số tài khoản và chủ tài khoản hoặc để trống cả ba.'
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/admin/affiliates/${id}`, {
      method: 'PATCH',
      body: {
        customRate: form.customRate,
        ...(form.customRate ? { commissionRate: form.commissionRate } : {}),
        status: form.status,
        bankName: form.bankName,
        bankAccountNo: form.bankAccountNo,
        bankAccountName: form.bankAccountName,
        taxCode: form.taxCode
      }
    })
    await refresh()
    message.value = 'Đã lưu hồ sơ cộng tác viên.'
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.statusMessage || 'Không lưu được hồ sơ.'
  } finally {
    saving.value = false
  }
}

const TAB_ITEMS = [
  { key: 'commissions', label: 'Hoa hồng' },
  { key: 'clicks', label: 'Lượt truy cập' },
  { key: 'payouts', label: 'Phiếu chi' }
] as const

const tab = ref<(typeof TAB_ITEMS)[number]['key']>('commissions')

const commissionStatus = ref('')
const commissionPage = ref(1)
const clickPage = ref(1)
const payoutPage = ref(1)

const commissionsQuery = computed(() => ({
  page: commissionPage.value,
  perPage: 20,
  status: commissionStatus.value
}))

const {
  data: commissionData,
  pending: commissionsPending,
  refresh: refreshCommissions
} = await useAsyncData<CommissionPage>(
  `admin-affiliate-commissions-${id}`,
  () => requestFetch<CommissionPage>(`/api/admin/affiliates/${id}/commissions`, { query: commissionsQuery.value }),
  { watch: [commissionsQuery] }
)

const { data: clickData, pending: clicksPending, refresh: refreshClicks } = await useAsyncData<ClickPage>(
  `admin-affiliate-clicks-${id}`,
  () => requestFetch<ClickPage>(`/api/admin/affiliates/${id}/clicks`, { query: { page: clickPage.value, perPage: 30 } }),
  { watch: [clickPage] }
)

const { data: payoutData, pending: payoutsPending } = await useAsyncData<PayoutPage>(
  `admin-affiliate-payouts-${id}`,
  () => requestFetch<PayoutPage>(`/api/admin/affiliates/${id}/payouts`, { query: { page: payoutPage.value, perPage: 20 } }),
  { watch: [payoutPage] }
)

watch(commissionStatus, () => {
  commissionPage.value = 1
})

const payoutModalOpen = ref(false)
const payoutSaving = ref(false)
const payoutError = ref('')
const payoutForm = reactive({ periodFrom: '', periodTo: '', note: '' })

function openPayoutModal() {
  payoutError.value = ''
  payoutForm.periodFrom = ''
  payoutForm.periodTo = ''
  payoutForm.note = ''
  payoutModalOpen.value = true
}

async function submitPayout() {
  if (payoutSaving.value || !savedBankReady.value || available.value.count === 0) return
  payoutSaving.value = true
  payoutError.value = ''
  try {
    const result = await $fetch<{ payout: { id: string } }>('/api/admin/affiliate-payouts', {
      method: 'POST',
      body: {
        affiliate: id,
        periodFrom: payoutForm.periodFrom || undefined,
        periodTo: payoutForm.periodTo || undefined,
        note: payoutForm.note
      }
    })
    await navigateTo(`/admin/affiliate-payouts/${result.payout.id}`)
  } catch (err: any) {
    payoutError.value = err?.data?.statusMessage || err?.statusMessage || 'Không lập được phiếu chi.'
  } finally {
    payoutSaving.value = false
  }
}

function orderLink(orderId: string) {
  return orderId ? `/admin/orders/${orderId}` : ''
}

useHead({ title: 'Chi tiết cộng tác viên' })
</script>

<template>
  <div class="w-full space-y-4">
    <div v-if="pending && !data" class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div class="space-y-2">
          <div class="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div class="h-6 w-56 animate-pulse rounded bg-slate-200" />
          <div class="h-3 w-40 animate-pulse rounded bg-slate-200" />
        </div>
        <div class="h-7 w-24 animate-pulse rounded-full bg-slate-200" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="tile in 4" :key="tile" class="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
      <div class="grid gap-4 lg:grid-cols-3">
        <div class="h-96 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-2" />
        <div class="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
      <div class="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>

    <div v-else-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      <p>Không tải được hồ sơ cộng tác viên.</p>
      <button type="button" class="mt-2 rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold" @click="refresh()">
        Thử lại
      </button>
    </div>

    <template v-else-if="affiliate">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <NuxtLink to="/admin/affiliates" class="text-xs font-semibold text-slate-500 hover:text-emerald-700">
            ← Danh sách cộng tác viên
          </NuxtLink>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-semibold">{{ user?.displayName || affiliate.code }}</h2>
            <AdminBadge v-bind="statusMeta" />
          </div>
          <p class="mt-0.5 text-sm text-slate-500">
            <span class="font-mono">{{ affiliate.code }}</span>
            <template v-if="user?.email"> · {{ user.email }}</template>
            <template v-if="user?.phone"> · {{ user.phone }}</template>
          </p>
          <p class="mt-0.5 text-xs text-slate-400">Tham gia {{ affiliate.createdAt ? formatDate(affiliate.createdAt) : '—' }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            :disabled="pending"
            @click="refresh()"
          >
            {{ pending ? 'Đang tải…' : 'Làm mới' }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
            @click="openPayoutModal"
          >
            Lập phiếu chi
          </button>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <template v-if="pending">
          <div v-for="tile in 4" :key="tile" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div class="mt-2 h-6 w-28 animate-pulse rounded bg-slate-100" />
          </div>
        </template>
        <template v-else>
          <AdminStatTile label="Chờ duyệt" :value="formatVnd(stats.pending)" hint="Chưa hết thời gian giữ" tone="amber" />
          <AdminStatTile label="Khả dụng" :value="formatVnd(stats.approved)" hint="Sẵn sàng lập phiếu" tone="sky" />
          <AdminStatTile label="Đang chi trả" :value="formatVnd(stats.processing)" hint="Trong phiếu nháp" tone="violet" />
          <AdminStatTile label="Đã chi trả" :value="formatVnd(stats.paid)" hint="Hoa hồng đã khoá" tone="emerald" />
        </template>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold">Hồ sơ &amp; chính sách</h3>
              <p class="mt-0.5 text-xs text-slate-500">Tỷ lệ hoa hồng và thông tin nhận tiền dùng khi lập phiếu chi.</p>
            </div>
          </div>

          <form class="mt-4 space-y-4" @submit.prevent="saveProfile">
            <div class="rounded-lg border border-slate-200 p-3">
              <label class="flex items-start gap-2">
                <input v-model="form.customRate" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500" />
                <span>
                  <span class="block text-sm font-medium text-slate-800">Dùng tỷ lệ riêng cho cộng tác viên</span>
                  <span class="block text-xs text-slate-500">
                    Mặc định theo chính sách cửa hàng hiện tại: {{ defaults.rate }}%. Tỷ lệ được chốt tại thời điểm đơn hàng thanh toán.
                  </span>
                </span>
              </label>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">Tỷ lệ hoa hồng (%)</span>
                  <input
                    v-model.number="form.commissionRate"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    :disabled="!form.customRate"
                    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">Trạng thái</span>
                  <select v-model="form.status" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="active">Hoạt động</option>
                    <option value="suspended">Tạm dừng</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="rounded-lg border border-slate-200 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Thông tin nhận tiền</p>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">Ngân hàng</span>
                  <input v-model="form.bankName" type="text" maxlength="120" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">Số tài khoản</span>
                  <input
                    v-model="form.bankAccountNo"
                    type="text"
                    inputmode="numeric"
                    maxlength="40"
                    class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">Chủ tài khoản</span>
                  <input v-model="form.bankAccountName" type="text" maxlength="120" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-600">Mã số thuế (TNCN)</span>
                  <input v-model="form.taxCode" type="text" maxlength="20" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
              </div>
              <p class="mt-2 text-[11px] text-slate-400">
                Thông tin ngân hàng được snapshot vào phiếu chi tại thời điểm lập phiếu.
              </p>
            </div>

            <p v-if="message" class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{{ message }}</p>
            <p v-if="errorMessage" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorMessage }}</p>

            <div class="flex justify-end">
              <button
                type="submit"
                class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                :disabled="saving"
              >
                {{ saving ? 'Đang lưu…' : 'Lưu hồ sơ' }}
              </button>
            </div>
          </form>
        </section>

        <div class="space-y-4">
          <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 class="text-sm font-semibold">Hoa hồng khả dụng</h3>
            <p class="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{{ formatVnd(available.net) }}</p>
            <p class="text-xs text-slate-500">Thực chi sau khấu trừ TNCN 10%</p>

            <dl class="mt-3 space-y-1 text-sm">
              <div class="flex justify-between">
                <dt class="text-slate-500">{{ available.count }} dòng hoa hồng</dt>
                <dd class="tabular-nums">{{ formatVnd(available.gross) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-slate-500">Thuế TNCN 10%</dt>
                <dd class="tabular-nums text-rose-700">−{{ formatVnd(available.tax) }}</dd>
              </div>
            </dl>

            <div v-if="!savedBankReady" class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Chưa đủ thông tin ngân hàng để nhận hoa hồng. Cập nhật ở biểu mẫu bên cạnh trước khi lập phiếu chi.
            </div>

            <div
              v-if="defaults.payoutThreshold > 0 && available.gross > 0 && available.gross < defaults.payoutThreshold"
              class="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800"
            >
              Chưa đạt hạn mức {{ formatVnd(defaults.payoutThreshold) }}. Còn thiếu
              {{ formatVnd(defaults.payoutThreshold - available.gross) }}; hoa hồng sẽ tiếp tục cộng dồn và
              {{ defaults.autoReconcile ? 'được lập phiếu tự động vào kỳ đối soát tới.' : 'chờ admin đối soát.' }}
            </div>

            <button
              type="button"
              class="mt-3 w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              :disabled="available.count === 0 || pending"
              @click="openPayoutModal"
            >
              {{ available.count === 0 ? 'Chưa có hoa hồng khả dụng' : 'Lập phiếu chi' }}
            </button>
          </section>

          <section class="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Chính sách hiện tại</p>
            <p class="mt-2">
              Ghi nhận giới thiệu: <strong class="text-slate-700">{{ defaults.attributionDays }} ngày</strong>
            </p>
            <p class="mt-1">
              Giữ hoa hồng: <strong class="text-slate-700">{{ defaults.holdDays }} ngày</strong> sau khi đơn hoàn tất.
            </p>
            <p class="mt-1">
              Tỷ lệ mặc định: <strong class="text-slate-700">{{ defaults.rate }}%</strong>
            </p>
            <p class="mt-1">
              Hạn mức chi trả:
              <strong class="text-slate-700">
                {{ defaults.payoutThreshold > 0 ? formatVnd(defaults.payoutThreshold) : 'Không giới hạn' }}
              </strong>
              <span class="text-slate-400">
                · {{ defaults.autoReconcile ? 'tự động đối soát hàng tháng' : 'đối soát thủ công' }}
              </span>
            </p>
            <p class="mt-2 leading-relaxed text-slate-400">
              Hoa hồng tính trên tiền hàng sau giảm giá (đã gồm GTGT, không gồm phí vận chuyển) và chốt tại thời điểm thanh toán.
            </p>
          </section>
        </div>
      </div>

      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 pt-3">
          <button
            v-for="item in TAB_ITEMS"
            :key="item.key"
            type="button"
            class="rounded-t-lg border-b-2 px-3 py-2 text-sm font-semibold"
            :class="
              tab === item.key
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            "
            @click="tab = item.key"
          >
            {{ item.label }}
          </button>
          <button
            v-if="tab === 'commissions'"
            type="button"
            class="ml-auto mb-2 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            @click="refreshCommissions()"
          >
            Làm mới
          </button>
        </div>

        <div v-if="tab === 'commissions'">
          <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
            <select v-model="commissionStatus" class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">
              <option value="">Mọi trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Khả dụng</option>
              <option value="processing">Đang chi trả</option>
              <option value="paid">Đã chi trả</option>
              <option value="cancelled">Đã huỷ</option>
            </select>
            <span class="text-xs text-slate-400">{{ commissionData?.total ?? 0 }} dòng</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[720px] text-left text-sm">
              <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-3 py-2 font-semibold">Đơn hàng</th>
                  <th class="px-3 py-2 font-semibold">Ngày tạo</th>
                  <th class="px-3 py-2 text-center font-semibold">Tỷ lệ</th>
                  <th class="px-3 py-2 text-right font-semibold">Hoa hồng</th>
                  <th class="px-3 py-2 font-semibold">Trạng thái</th>
                  <th class="px-3 py-2 font-semibold">Duyệt / chi</th>
                  <th class="px-3 py-2 text-right font-semibold">Phiếu chi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <template v-if="commissionsPending">
                  <tr v-for="row in 5" :key="`commission-skeleton-${row}`">
                    <td class="px-3 py-3"><div class="h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="mx-auto h-4 w-8 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="h-5 w-20 animate-pulse rounded-full bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="ml-auto h-4 w-16 animate-pulse rounded bg-slate-100" /></td>
                  </tr>
                </template>
                <tr v-else-if="(commissionData?.items.length ?? 0) === 0">
                  <td colspan="7" class="px-3 py-8 text-center text-xs text-slate-400">Chưa có hoa hồng.</td>
                </tr>
                <template v-else>
                  <tr v-for="item in commissionData?.items ?? []" :key="item.id">
                    <td class="px-3 py-3">
                      <NuxtLink
                        v-if="item.order.id"
                        :to="orderLink(item.order.id)"
                        class="font-mono text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        {{ formatOrderCode(item.order.id) }}
                      </NuxtLink>
                      <span v-else class="text-xs text-slate-400">—</span>
                    </td>
                    <td class="px-3 py-3 text-xs text-slate-500">{{ item.createdAt ? formatDate(item.createdAt) : '—' }}</td>
                    <td class="px-3 py-3 text-center text-slate-600">{{ item.rate }}%</td>
                    <td class="px-3 py-3 text-right font-semibold tabular-nums">{{ formatVnd(item.amount) }}</td>
                    <td class="px-3 py-3"><AdminBadge v-bind="commissionStatusMeta(item.status)" /></td>
                    <td class="px-3 py-3 text-xs text-slate-500">
                      <template v-if="item.paidAt">Chi {{ formatDate(item.paidAt) }}</template>
                      <template v-else-if="item.approvedAt">Duyệt {{ formatDate(item.approvedAt) }}</template>
                      <template v-else-if="item.eligibleAt">Dự kiến {{ formatDate(item.eligibleAt) }}</template>
                      <template v-else>—</template>
                    </td>
                    <td class="px-3 py-3 text-right">
                      <NuxtLink
                        v-if="item.payoutId"
                        :to="`/admin/affiliate-payouts/${item.payoutId}`"
                        class="text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        Xem phiếu
                      </NuxtLink>
                      <span v-else class="text-xs text-slate-400">—</span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <AdminPagination
            v-if="!commissionsPending && commissionData"
            :page="commissionData.page"
            :total-pages="commissionData.totalPages"
            :total="commissionData.total"
            :per-page="commissionData.perPage"
            @update:page="commissionPage = $event"
          />
        </div>

        <div v-else-if="tab === 'clicks'">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[560px] text-left text-sm">
              <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-3 py-2 font-semibold">Đường dẫn</th>
                  <th class="px-3 py-2 font-semibold">Nguồn</th>
                  <th class="px-3 py-2 text-right font-semibold">Thời điểm</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <template v-if="clicksPending">
                  <tr v-for="row in 5" :key="`click-skeleton-${row}`">
                    <td class="px-3 py-3"><div class="h-4 w-40 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="h-4 w-48 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="ml-auto h-4 w-28 animate-pulse rounded bg-slate-100" /></td>
                  </tr>
                </template>
                <tr v-else-if="(clickData?.items.length ?? 0) === 0">
                  <td colspan="3" class="px-3 py-8 text-center text-xs text-slate-400">Chưa có lượt truy cập.</td>
                </tr>
                <template v-else>
                  <tr v-for="item in clickData?.items ?? []" :key="item.id">
                    <td class="px-3 py-3 font-mono text-xs text-slate-700">{{ item.path || '/' }}</td>
                    <td class="max-w-[320px] truncate px-3 py-3 text-xs text-slate-500">{{ item.referrer || 'Trực tiếp' }}</td>
                    <td class="px-3 py-3 text-right text-xs text-slate-500">{{ item.createdAt ? formatDateTime(item.createdAt) : '—' }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <AdminPagination
            v-if="!clicksPending && clickData"
            :page="clickData.page"
            :total-pages="clickData.totalPages"
            :total="clickData.total"
            :per-page="clickData.perPage"
            @update:page="clickPage = $event"
          />
        </div>

        <div v-else>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[720px] text-left text-sm">
              <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-3 py-2 font-semibold">Số phiếu</th>
                  <th class="px-3 py-2 text-right font-semibold">Tổng hoa hồng</th>
                  <th class="px-3 py-2 text-right font-semibold">TNCN</th>
                  <th class="px-3 py-2 text-right font-semibold">Thực chi</th>
                  <th class="px-3 py-2 text-center font-semibold">Dòng</th>
                  <th class="px-3 py-2 font-semibold">Trạng thái</th>
                  <th class="px-3 py-2 text-right font-semibold">Ngày lập</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <template v-if="payoutsPending">
                  <tr v-for="row in 4" :key="`payout-skeleton-${row}`">
                    <td class="px-3 py-3"><div class="h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="ml-auto h-4 w-16 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="mx-auto h-4 w-8 animate-pulse rounded bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="h-5 w-20 animate-pulse rounded-full bg-slate-100" /></td>
                    <td class="px-3 py-3"><div class="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                  </tr>
                </template>
                <tr v-else-if="(payoutData?.items.length ?? 0) === 0">
                  <td colspan="7" class="px-3 py-8 text-center text-xs text-slate-400">Chưa có phiếu chi.</td>
                </tr>
                <template v-else>
                  <tr v-for="item in payoutData?.items ?? []" :key="item.id">
                    <td class="px-3 py-3">
                      <NuxtLink :to="`/admin/affiliate-payouts/${item.id}`" class="font-mono text-xs font-semibold text-emerald-700 hover:underline">
                        {{ item.number }}
                      </NuxtLink>
                    </td>
                    <td class="px-3 py-3 text-right tabular-nums">{{ formatVnd(item.grossTotal) }}</td>
                    <td class="px-3 py-3 text-right tabular-nums text-rose-700">−{{ formatVnd(item.taxTotal) }}</td>
                    <td class="px-3 py-3 text-right font-semibold tabular-nums">{{ formatVnd(item.netTotal) }}</td>
                    <td class="px-3 py-3 text-center text-slate-600">{{ item.commissionCount }}</td>
                    <td class="px-3 py-3"><AdminBadge v-bind="payoutStatusMeta(item.status)" /></td>
                    <td class="px-3 py-3 text-right text-xs text-slate-500">{{ item.createdAt ? formatDate(item.createdAt) : '—' }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <AdminPagination
            v-if="!payoutsPending && payoutData"
            :page="payoutData.page"
            :total-pages="payoutData.totalPages"
            :total="payoutData.total"
            :per-page="payoutData.perPage"
            @update:page="payoutPage = $event"
          />
        </div>
      </section>
    </template>

    <Teleport to="body">
      <div
        v-if="payoutModalOpen"
        class="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label="Lập phiếu chi hoa hồng"
        @click.self="payoutModalOpen = false"
      >
        <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold">Lập phiếu chi hoa hồng</h3>
              <p class="mt-0.5 text-xs text-slate-500">Phiếu được tạo ở trạng thái nháp, chưa chi trả.</p>
            </div>
            <button type="button" class="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Đóng" @click="payoutModalOpen = false">
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <dl class="mt-4 space-y-1 rounded-lg bg-slate-50 px-3 py-3 text-sm">
            <div class="flex justify-between">
              <dt class="text-slate-500">Hoa hồng khả dụng ({{ available.count }} dòng)</dt>
              <dd class="tabular-nums">{{ formatVnd(available.gross) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-500">Thuế TNCN 10%</dt>
              <dd class="tabular-nums text-rose-700">−{{ formatVnd(available.tax) }}</dd>
            </div>
            <div class="flex justify-between border-t border-slate-200 pt-1 text-base font-bold">
              <dt>Thực chi</dt>
              <dd class="tabular-nums">{{ formatVnd(available.net) }}</dd>
            </div>
          </dl>

          <div v-if="!savedBankReady" class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Cộng tác viên chưa có đủ thông tin ngân hàng. Cập nhật hồ sơ trước khi lập phiếu chi.
          </div>

          <form class="mt-4 space-y-3" @submit.prevent="submitPayout">
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">Từ ngày</span>
                <input v-model="payoutForm.periodFrom" type="date" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-600">Đến ngày</span>
                <input v-model="payoutForm.periodTo" type="date" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
            <p class="text-[11px] text-slate-400">Để trống cả hai nếu muốn gộp toàn bộ hoa hồng khả dụng.</p>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Ghi chú</span>
              <textarea v-model="payoutForm.note" rows="2" maxlength="500" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>

            <p v-if="payoutError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ payoutError }}</p>

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                @click="payoutModalOpen = false"
              >
                Huỷ
              </button>
              <button
                type="submit"
                class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                :disabled="payoutSaving || !savedBankReady || available.count === 0"
              >
                {{ payoutSaving ? 'Đang lập…' : 'Tạo phiếu nháp' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
