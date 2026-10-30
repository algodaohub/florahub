<script setup lang="ts">
import type { AffiliateStatement } from '~/types'
import { formatDate, formatVnd } from '~/utils/format'
import { payoutMethodLabel, payoutStatusMeta } from '~/utils/admin'

const props = withDefaults(
  defineProps<{
    statement: AffiliateStatement | null
    loading?: boolean
    error?: string
    showPrint?: boolean
  }>(),
  { loading: false, error: '', showPrint: true }
)

const emit = defineEmits<{ retry: [] }>()

const statusMeta = computed(() => payoutStatusMeta(props.statement?.status ?? ''))
const periodLabel = computed(() => {
  const from = props.statement?.periodFrom
  const to = props.statement?.periodTo
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`
  if (from) return `Từ ${formatDate(from)}`
  if (to) return `Đến ${formatDate(to)}`
  return 'Toàn bộ hoa hồng khả dụng'
})

function printStatement() {
  if (!import.meta.client || !props.statement) return
  window.print()
}
</script>

<template>
  <div class="fh-affiliate-statement">
    <div v-if="showPrint && statement" class="fh-no-print mb-3 flex items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Bản đối soát hoa hồng</p>
      <button
        type="button"
        class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        @click="printStatement"
      >
        In phiếu chi
      </button>
    </div>

    <div class="fh-affiliate-sheet relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div v-if="loading" class="space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <div class="h-3 w-40 animate-pulse rounded bg-slate-100" />
            <div class="h-6 w-64 animate-pulse rounded bg-slate-100" />
            <div class="h-3 w-28 animate-pulse rounded bg-slate-100" />
          </div>
          <div class="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="h-24 animate-pulse rounded-lg bg-slate-100" />
          <div class="h-24 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div class="space-y-2">
          <div v-for="row in 4" :key="row" class="h-9 animate-pulse rounded bg-slate-100" />
        </div>
        <div class="ml-auto h-24 w-full max-w-xs animate-pulse rounded-lg bg-slate-100" />
      </div>

      <div v-else-if="error" class="py-10 text-center">
        <p class="text-sm text-rose-700">{{ error }}</p>
        <button
          type="button"
          class="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          @click="emit('retry')"
        >
          Thử lại
        </button>
      </div>

      <div v-else-if="!statement" class="py-10 text-center text-sm text-slate-400">
        Chưa có dữ liệu phiếu chi.
      </div>

      <template v-else>
        <div
          v-if="statement.status === 'draft'"
          class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none"
          aria-hidden="true"
        >
          <span class="rotate-[-20deg] text-[88px] font-black uppercase tracking-[0.2em] text-rose-500/10 sm:text-[128px]">
            Nháp
          </span>
        </div>

        <div class="relative z-10">
          <header class="border-b border-slate-200 pb-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {{ statement.seller.name || 'Đơn vị chi trả' }}
                </p>
                <h2 class="mt-1 text-lg font-bold uppercase tracking-tight text-slate-900">
                  Phiếu chi hoa hồng cộng tác viên
                </h2>
                <p class="mt-0.5 text-xs text-slate-500">
                  Số {{ statement.number }} · Lập ngày {{ formatDate(statement.issuedAt) }}
                </p>
              </div>
              <div class="text-right">
                <AdminBadge v-bind="statusMeta" />
                <p v-if="statement.paidAt" class="mt-1 text-[11px] text-slate-500">
                  Đã chi {{ formatDate(statement.paidAt) }}
                </p>
                <p v-else-if="statement.cancelledAt" class="mt-1 text-[11px] text-slate-500">
                  Huỷ {{ formatDate(statement.cancelledAt) }}
                </p>
              </div>
            </div>
            <p class="mt-3 text-xs text-slate-500">
              Kỳ đối soát: <strong class="text-slate-700">{{ periodLabel }}</strong>
            </p>
          </header>

          <div
            v-if="statement.status === 'cancelled'"
            class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            Phiếu chi đã bị huỷ; hoa hồng trong phiếu được trả lại trạng thái khả dụng.
          </div>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div class="rounded-lg border border-slate-200 p-3">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Đơn vị chi trả</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">{{ statement.seller.name || '—' }}</p>
              <p class="mt-0.5 text-xs text-slate-600">MST: {{ statement.seller.taxCode || '—' }}</p>
              <p class="mt-0.5 text-xs text-slate-600">{{ statement.seller.address || '—' }}</p>
              <p class="mt-0.5 text-xs text-slate-500">
                {{ statement.seller.phone || '—' }}<template v-if="statement.seller.email"> · {{ statement.seller.email }}</template>
              </p>
            </div>
            <div class="rounded-lg border border-slate-200 p-3">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Người nhận hoa hồng</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">{{ statement.affiliate.name || '—' }}</p>
              <p class="mt-0.5 text-xs text-slate-600">
                Mã CTV: {{ statement.affiliate.code || '—' }} · MST: {{ statement.affiliate.taxCode || '—' }}
              </p>
              <p v-if="statement.affiliate.email" class="mt-0.5 text-xs text-slate-500">{{ statement.affiliate.email }}</p>
              <div class="mt-2 rounded-md bg-slate-50 px-2 py-1.5">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nhận tiền</p>
                <p class="mt-0.5 text-xs text-slate-700">
                  {{ statement.affiliate.bankName || '—' }} · {{ statement.affiliate.bankAccountNo || '—' }}
                </p>
                <p class="text-xs text-slate-600">{{ statement.affiliate.bankAccountName || '—' }}</p>
              </div>
            </div>
          </div>

          <div class="mt-4 overflow-x-auto">
            <table class="w-full text-left text-sm sm:min-w-[620px]">
              <thead class="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-2 py-2 font-semibold">STT</th>
                  <th class="px-2 py-2 font-semibold">Mã đơn</th>
                  <th class="hidden px-2 py-2 font-semibold sm:table-cell">Hoàn tất</th>
                  <th class="px-2 py-2 text-right font-semibold">Tiền hàng</th>
                  <th class="px-2 py-2 text-center font-semibold">Tỷ lệ</th>
                  <th class="px-2 py-2 text-right font-semibold">Hoa hồng</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(line, index) in statement.lines" :key="line.commissionId">
                  <td class="px-2 py-2 text-xs text-slate-500">{{ index + 1 }}</td>
                  <td class="px-2 py-2">
                    <p class="font-medium text-slate-800">{{ line.orderCode || '—' }}</p>
                    <p class="text-[11px] text-slate-500 sm:hidden">
                      {{ line.completedAt ? formatDate(line.completedAt) : '—' }}
                    </p>
                  </td>
                  <td class="hidden px-2 py-2 text-xs text-slate-500 sm:table-cell">
                    {{ line.completedAt ? formatDate(line.completedAt) : '—' }}
                  </td>
                  <td class="px-2 py-2 text-right tabular-nums text-slate-600">{{ formatVnd(line.goodsTotal) }}</td>
                  <td class="px-2 py-2 text-center text-slate-600">{{ line.rate }}%</td>
                  <td class="px-2 py-2 text-right font-semibold tabular-nums">{{ formatVnd(line.amount) }}</td>
                </tr>
                <tr v-if="statement.lines.length === 0">
                  <td colspan="6" class="px-2 py-6 text-center text-xs text-slate-400">Phiếu chưa có dòng hoa hồng.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="max-w-sm text-xs leading-relaxed text-slate-500">
              <p>
                Hình thức chi:
                <strong class="text-slate-700">{{ payoutMethodLabel(statement.method) }}</strong>
              </p>
              <p v-if="statement.reference" class="mt-1">Mã giao dịch: {{ statement.reference }}</p>
              <p v-if="statement.note" class="mt-1 whitespace-pre-line">Ghi chú: {{ statement.note }}</p>
              <p class="mt-1">
                Hoa hồng tính trên tiền hàng sau giảm giá (đã gồm GTGT, không gồm phí vận chuyển).
                Thuế TNCN {{ statement.totals.taxRate }}% được khấu trừ khi chi trả.
              </p>
            </div>
            <dl class="w-full max-w-xs space-y-1 text-sm sm:text-right">
              <div class="flex justify-between gap-4">
                <dt class="text-slate-500">Tổng hoa hồng ({{ statement.totals.count }} dòng)</dt>
                <dd class="tabular-nums">{{ formatVnd(statement.totals.gross) }}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-slate-500">Thuế TNCN ({{ statement.totals.taxRate }}%)</dt>
                <dd class="tabular-nums text-rose-700">−{{ formatVnd(statement.totals.tax) }}</dd>
              </div>
              <div class="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base font-bold">
                <dt>Thực chi</dt>
                <dd class="tabular-nums">{{ formatVnd(statement.totals.net) }}</dd>
              </div>
            </dl>
          </div>

          <p class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Số tiền bằng chữ: <strong class="text-slate-800">{{ statement.totals.netInWords }}</strong>
          </p>

          <div class="mt-8 grid grid-cols-2 gap-4 border-t border-dashed border-slate-300 pt-4 text-center text-xs text-slate-500 sm:grid-cols-4">
            <div>
              <p class="font-semibold text-slate-700">Người lập phiếu</p>
              <p class="mt-0.5">(Ký, ghi rõ họ tên)</p>
            </div>
            <div>
              <p class="font-semibold text-slate-700">Kế toán</p>
              <p class="mt-0.5">(Ký, ghi rõ họ tên)</p>
            </div>
            <div>
              <p class="font-semibold text-slate-700">Đại diện cửa hàng</p>
              <p class="mt-0.5">(Ký, ghi rõ họ tên)</p>
            </div>
            <div>
              <p class="font-semibold text-slate-700">Người nhận tiền</p>
              <p class="mt-0.5">(Ký, ghi rõ họ tên)</p>
            </div>
          </div>

          <p class="mt-4 text-center text-[10px] text-slate-400">
            Phiếu chi xác nhận việc chi trả hoa hồng cộng tác viên và không thay thế hoá đơn giá trị gia tăng.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
@media print {
  body * {
    visibility: hidden !important;
  }
  .fh-affiliate-sheet,
  .fh-affiliate-sheet * {
    visibility: visible !important;
  }
  .fh-affiliate-sheet {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    max-width: none;
    margin: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .fh-no-print {
    display: none !important;
  }
}
</style>
