<script setup lang="ts">
import type { AdminAccounting, AdminAccountingInvoice } from '~/types/admin'
import { formatDate, formatDateTime, formatVnd } from '~/utils/format'
import { invoiceStatusMeta, vatRateLabel } from '~/utils/accounting'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Kế toán' })

const requestFetch = useRequestFetch()

function pad(value: number) {
  return String(value).padStart(2, '0')
}
function dateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const now = new Date()
const from = ref(dateInput(new Date(now.getFullYear(), now.getMonth(), 1)))
const to = ref(dateInput(now))

const { data, pending, error, refresh } = await useAsyncData<AdminAccounting>(
  'admin-accounting',
  () => requestFetch<AdminAccounting>('/api/admin/accounting', { query: { from: from.value, to: to.value } }),
  { watch: [from, to] }
)

const summary = computed(() => data.value?.summary ?? null)
const entries = computed(() => data.value?.entries ?? [])
const invoices = computed(() => data.value?.invoices ?? [])
const daily = computed(() => data.value?.daily ?? [])
const maxDaily = computed(() => Math.max(1, ...daily.value.map((day) => Math.abs(day.gross))))
const accounts = computed(() => data.value?.accounts ?? [])
const accountTotals = computed(() =>
  accounts.value.reduce(
    (sum, row) => ({
      openingDebit: sum.openingDebit + row.openingDebit,
      openingCredit: sum.openingCredit + row.openingCredit,
      periodDebit: sum.periodDebit + row.periodDebit,
      periodCredit: sum.periodCredit + row.periodCredit,
      closingDebit: sum.closingDebit + row.closingDebit,
      closingCredit: sum.closingCredit + row.closingCredit
    }),
    { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0 }
  )
)
const booksBalanced = computed(
  () =>
    accountTotals.value.periodDebit === accountTotals.value.periodCredit &&
    accountTotals.value.closingDebit === accountTotals.value.closingCredit
)

function balanceLabel(debit: number, credit: number) {
  if (debit) return `Nợ ${formatVnd(debit)}`
  if (credit) return `Có ${formatVnd(credit)}`
  return '—'
}

const RANGE_PRESETS = [
  { key: 'month', label: 'Tháng này' },
  { key: 'quarter', label: 'Quý này' },
  { key: 'year', label: 'Năm nay' }
] as const

function applyRange(kind: (typeof RANGE_PRESETS)[number]['key']) {
  const today = new Date()
  if (kind === 'month') {
    from.value = dateInput(new Date(today.getFullYear(), today.getMonth(), 1))
  } else if (kind === 'quarter') {
    const quarterStart = Math.floor(today.getMonth() / 3) * 3
    from.value = dateInput(new Date(today.getFullYear(), quarterStart, 1))
  } else {
    from.value = dateInput(new Date(today.getFullYear(), 0, 1))
  }
  to.value = dateInput(today)
}

const settingsForm = reactive({
  sellerName: '',
  sellerTaxCode: '',
  sellerAddress: '',
  invoiceSymbol: '',
  invoiceTemplate: ''
})
watch(
  data,
  (value) => {
    if (!value) return
    settingsForm.sellerName = value.settings.sellerName
    settingsForm.sellerTaxCode = value.settings.sellerTaxCode
    settingsForm.sellerAddress = value.settings.sellerAddress
    settingsForm.invoiceSymbol = value.settings.invoiceSymbol
    settingsForm.invoiceTemplate = value.settings.invoiceTemplate
  },
  { immediate: true }
)

const saving = ref(false)
const message = ref('')
const errorMessage = ref('')

async function saveSettings() {
  if (saving.value) return
  saving.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    await $fetch('/api/admin/accounting', {
      method: 'PUT',
      body: {
        sellerName: settingsForm.sellerName,
        sellerTaxCode: settingsForm.sellerTaxCode,
        sellerAddress: settingsForm.sellerAddress,
        invoiceSymbol: settingsForm.invoiceSymbol,
        invoiceTemplate: settingsForm.invoiceTemplate
      }
    })
    await refresh()
    message.value = 'Đã lưu thông tin người bán.'
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.statusMessage || 'Không lưu được thông tin.'
  } finally {
    saving.value = false
  }
}

const TAB_ITEMS = [
  { key: 'journal', label: 'Sổ nhật ký chung' },
  { key: 'invoices', label: 'Sổ hoá đơn' },
  { key: 'sales', label: 'Bảng kê bán ra' }
] as const

const tab = ref<(typeof TAB_ITEMS)[number]['key']>('journal')

const activeInvoices = computed(() => invoices.value.filter((invoice) => invoice.status !== 'cancelled'))

const cancellingId = ref('')
const cancelReason = ref('')
const invoiceViewId = ref('')

async function cancelInvoice(invoice: AdminAccountingInvoice) {
  if (cancelReason.value.trim().length < 3) {
    errorMessage.value = 'Vui lòng nhập lý do huỷ hoá đơn.'
    return
  }
  try {
    await $fetch(`/api/admin/orders/${invoice.id}/invoice`, {
      method: 'POST',
      body: { action: 'cancel', reason: cancelReason.value }
    })
    cancellingId.value = ''
    cancelReason.value = ''
    message.value = `Đã huỷ hoá đơn ${invoice.number}.`
    await refresh()
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.statusMessage || 'Không huỷ được hoá đơn.'
  }
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function exportJournal() {
  downloadCsv(`so-nhat-ky-${from.value}-${to.value}.csv`, [
    ['Ngày', 'Mã đơn', 'Diễn giải', 'TK', 'Tên tài khoản', 'TK đối ứng', 'Nợ', 'Có', 'Số hoá đơn'],
    ...entries.value.map((line) => [
      formatDate(line.date),
      line.orderCode,
      line.description,
      line.account,
      line.accountName,
      line.counterAccounts.map((counter) => `${counter.account} ${counter.name}`).join(', '),
      line.debit || '',
      line.credit || '',
      line.invoiceNumber
    ])
  ])
}

function exportInvoices() {
  downloadCsv(`so-hoa-don-${from.value}-${to.value}.csv`, [
    ['STT', 'Số hoá đơn', 'Ngày', 'Người mua', 'Email', 'Doanh số chưa thuế', 'Thuế GTGT', 'Tổng', 'Trạng thái'],
    ...invoices.value.map((invoice, index) => [
      index + 1,
      invoice.number,
      formatDate(invoice.issuedAt),
      invoice.customer,
      invoice.email,
      invoice.net,
      invoice.taxTotal,
      invoice.total,
      invoiceStatusMeta(invoice.status).label
    ])
  ])
}

function exportSales() {
  const issued = invoices.value.filter((invoice) => invoice.status !== 'cancelled')
  downloadCsv(`bang-ke-ban-ra-${from.value}-${to.value}.csv`, [
    ['STT', 'Số hoá đơn', 'Ngày', 'Tên người mua', 'MST người mua', 'Doanh số chưa thuế', 'Thuế GTGT', 'Tổng thanh toán'],
    ...issued.map((invoice, index) => [
      index + 1,
      invoice.number,
      formatDate(invoice.issuedAt),
      invoice.customer,
      '',
      invoice.net,
      invoice.taxTotal,
      invoice.total
    ])
  ])
}

useHead({ title: 'Kế toán' })
</script>

<template>
  <div class="w-full space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold">Kế toán</h2>
        <p class="text-sm text-slate-500">
          Sổ nhật ký kép, hoá đơn tuần tự và bảng kê bán ra · VND, giá đã bao gồm GTGT.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2 self-start">
        <button
          v-for="preset in RANGE_PRESETS"
          :key="preset.key"
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          @click="applyRange(preset.key)"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>

    <div
      v-if="message"
      class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
    >
      {{ message }}
    </div>
    <div v-if="errorMessage" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ errorMessage }}
    </div>
    <div v-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
      Không tải được sổ kế toán. {{ (error as any)?.data?.statusMessage || '' }}
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div class="flex flex-wrap items-end gap-2 text-xs text-slate-500">
        <label class="flex flex-col gap-1">
          <span class="font-medium text-slate-400">Từ ngày</span>
          <input
            v-model="from"
            type="date"
            class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-emerald-600"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="font-medium text-slate-400">Đến ngày</span>
          <input
            v-model="to"
            type="date"
            class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-emerald-600"
          />
        </label>
        <span class="ml-auto text-[11px] text-slate-400">
          Thuế GTGT đang áp dụng:
          <strong class="text-slate-600">{{ vatRateLabel(data?.vatRate ?? 0) }}</strong>
          · <NuxtLink to="/admin/storefront" class="text-emerald-700 hover:underline">đổi ở Cửa hàng</NuxtLink>
        </span>
      </div>
    </div>

    <div v-if="pending && !summary" class="h-24 animate-pulse rounded-xl bg-white" />

    <template v-else-if="summary">
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <AdminStatTile
          label="Doanh thu chưa thuế"
          tone="emerald"
          :value="formatVnd(summary.netRevenue)"
          :hint="`${summary.ordersCompleted} đơn hoàn tất`"
        />
        <AdminStatTile label="Thuế GTGT đầu ra" tone="sky" :value="formatVnd(summary.vatOutput)" hint="TK 3331" />
        <AdminStatTile label="Tiền mặt" tone="slate" :value="formatVnd(summary.cash)" hint="TK 111" />
        <AdminStatTile label="Tiền gửi ngân hàng" tone="slate" :value="formatVnd(summary.bank)" hint="TK 112" />
        <AdminStatTile
          label="Phải thu khách hàng"
          tone="amber"
          :value="formatVnd(summary.receivable)"
          hint="TK 131 — đơn chưa thu"
        />
        <AdminStatTile
          label="Hàng bán bị trả lại"
          tone="rose"
          :value="formatVnd(summary.returns)"
          hint="TK 5212 — hoàn tiền"
        />
        <AdminStatTile
          label="Tổng doanh số"
          tone="emerald"
          :value="formatVnd(summary.grossSales)"
          hint="gồm GTGT"
        />
        <AdminStatTile
          label="Hoá đơn"
          tone="violet"
          :value="`${summary.invoicesIssued} đã xuất`"
          :hint="`${summary.invoicesCancelled} đã huỷ`"
        />
      </div>

      <div v-if="daily.length" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Doanh thu theo ngày</h3>
          <span class="text-[11px] text-slate-400">gồm GTGT</span>
        </div>
        <div class="mt-3 space-y-1.5">
          <div v-for="day in daily" :key="day.date" class="flex items-center gap-2 text-[11px]">
            <span class="w-16 shrink-0 text-slate-500">{{ formatDate(day.date) }}</span>
            <span class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <span
                class="block h-full rounded-full"
                :class="day.gross < 0 ? 'bg-rose-400' : 'bg-emerald-500'"
                :style="{ width: `${Math.max(3, (Math.abs(day.gross) / maxDaily) * 100)}%` }"
              />
            </span>
            <span class="w-24 shrink-0 text-right tabular-nums text-slate-600">{{ formatVnd(day.gross) }}</span>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 class="text-sm font-semibold">Số dư tài khoản</h3>
            <p class="mt-0.5 text-[11px] text-slate-400">
              Dư đầu kỳ từ các bút toán trước {{ formatDate(from) }} · dư cuối kỳ = dư đầu kỳ + phát sinh trong kỳ.
            </p>
          </div>
          <span
            class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            :class="booksBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
          >
            {{ booksBalanced ? 'Cân đối Nợ – Có' : 'Lệch Nợ – Có' }}
          </span>
        </div>

        <div v-if="accounts.length" class="divide-y divide-slate-100 sm:hidden">
          <div v-for="row in accounts" :key="row.account" class="px-4 py-3">
            <p class="text-xs">
              <span class="font-semibold text-slate-700">{{ row.account }}</span>
              <span class="text-slate-400"> · {{ row.name }}</span>
            </p>
            <div class="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <p>
                <span class="text-slate-400">Dư đầu kỳ</span>
                <span class="block font-semibold tabular-nums text-slate-700">
                  {{ balanceLabel(row.openingDebit, row.openingCredit) }}
                </span>
              </p>
              <p>
                <span class="text-slate-400">Dư cuối kỳ</span>
                <span class="block font-semibold tabular-nums text-slate-700">
                  {{ balanceLabel(row.closingDebit, row.closingCredit) }}
                </span>
              </p>
              <p>
                <span class="text-slate-400">Phát sinh Nợ</span>
                <span class="block tabular-nums text-slate-600">
                  {{ row.periodDebit ? formatVnd(row.periodDebit) : '—' }}
                </span>
              </p>
              <p>
                <span class="text-slate-400">Phát sinh Có</span>
                <span class="block tabular-nums text-slate-600">
                  {{ row.periodCredit ? formatVnd(row.periodCredit) : '—' }}
                </span>
              </p>
            </div>
          </div>
          <div class="flex items-center justify-between gap-2 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold text-slate-600">
            <span>Tổng cộng</span>
            <span class="text-right tabular-nums">
              PS Nợ {{ formatVnd(accountTotals.periodDebit) }} · PS Có {{ formatVnd(accountTotals.periodCredit) }}
            </span>
          </div>
        </div>

        <div v-if="accounts.length" class="hidden w-full overflow-x-auto sm:block">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th rowspan="2" class="px-4 py-2 font-semibold">Tài khoản</th>
                <th colspan="2" class="border-l border-slate-200 px-4 py-2 text-center font-semibold">Số dư đầu kỳ</th>
                <th colspan="2" class="border-l border-slate-200 px-4 py-2 text-center font-semibold">
                  Phát sinh trong kỳ
                </th>
                <th colspan="2" class="border-l border-slate-200 px-4 py-2 text-center font-semibold">
                  Số dư cuối kỳ
                </th>
              </tr>
              <tr>
                <th class="border-l border-slate-200 px-4 py-1.5 text-right font-semibold">Nợ</th>
                <th class="px-4 py-1.5 text-right font-semibold">Có</th>
                <th class="border-l border-slate-200 px-4 py-1.5 text-right font-semibold">Nợ</th>
                <th class="px-4 py-1.5 text-right font-semibold">Có</th>
                <th class="border-l border-slate-200 px-4 py-1.5 text-right font-semibold">Nợ</th>
                <th class="px-4 py-1.5 text-right font-semibold">Có</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in accounts" :key="row.account">
                <td class="px-4 py-2.5 text-xs">
                  <span class="font-semibold text-slate-700">{{ row.account }}</span>
                  <span class="block text-[10px] text-slate-400">{{ row.name }}</span>
                </td>
                <td class="border-l border-slate-100 px-4 py-2.5 text-right tabular-nums">
                  {{ row.openingDebit ? formatVnd(row.openingDebit) : '—' }}
                </td>
                <td class="px-4 py-2.5 text-right tabular-nums">
                  {{ row.openingCredit ? formatVnd(row.openingCredit) : '—' }}
                </td>
                <td class="border-l border-slate-100 px-4 py-2.5 text-right tabular-nums">
                  {{ row.periodDebit ? formatVnd(row.periodDebit) : '—' }}
                </td>
                <td class="px-4 py-2.5 text-right tabular-nums">
                  {{ row.periodCredit ? formatVnd(row.periodCredit) : '—' }}
                </td>
                <td class="border-l border-slate-100 px-4 py-2.5 text-right font-semibold tabular-nums">
                  {{ row.closingDebit ? formatVnd(row.closingDebit) : '—' }}
                </td>
                <td class="px-4 py-2.5 text-right font-semibold tabular-nums">
                  {{ row.closingCredit ? formatVnd(row.closingCredit) : '—' }}
                </td>
              </tr>
            </tbody>
            <tfoot class="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold">
              <tr>
                <td class="px-4 py-2">Tổng cộng</td>
                <td class="border-l border-slate-200 px-4 py-2 text-right tabular-nums">
                  {{ formatVnd(accountTotals.openingDebit) }}
                </td>
                <td class="px-4 py-2 text-right tabular-nums">{{ formatVnd(accountTotals.openingCredit) }}</td>
                <td class="border-l border-slate-200 px-4 py-2 text-right tabular-nums">
                  {{ formatVnd(accountTotals.periodDebit) }}
                </td>
                <td class="px-4 py-2 text-right tabular-nums">{{ formatVnd(accountTotals.periodCredit) }}</td>
                <td class="border-l border-slate-200 px-4 py-2 text-right tabular-nums">
                  {{ formatVnd(accountTotals.closingDebit) }}
                </td>
                <td class="px-4 py-2 text-right tabular-nums">{{ formatVnd(accountTotals.closingCredit) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p v-else class="px-4 py-10 text-center text-sm text-slate-400">
          Chưa có số dư hay phát sinh trong kỳ.
        </p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div class="flex gap-1">
            <button
              v-for="item in TAB_ITEMS"
              :key="item.key"
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-semibold"
              :class="tab === item.key ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'"
              @click="tab = item.key"
            >
              {{ item.label }}
            </button>
          </div>
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            @click="tab === 'journal' ? exportJournal() : tab === 'invoices' ? exportInvoices() : exportSales()"
          >
            Xuất CSV
          </button>
        </div>

        <div v-if="tab === 'journal'" class="divide-y divide-slate-100 sm:hidden">
          <p v-if="entries.length === 0" class="px-4 py-10 text-center text-sm text-slate-400">
            Chưa có bút toán trong kỳ.
          </p>
          <div v-for="line in entries" :key="line.id" class="px-4 py-3">
            <div class="flex items-center justify-between gap-2">
              <NuxtLink :to="`/admin/orders/${line.orderId}`" class="font-mono text-xs font-semibold text-emerald-800">
                {{ line.orderCode }}
              </NuxtLink>
              <span class="text-[10px] text-slate-400">
                {{ formatDate(line.date) }} · {{ line.refType === 'refund' ? 'Hoàn tiền' : 'Bán hàng' }}
              </span>
            </div>
            <p class="mt-0.5 text-xs text-slate-600">{{ line.description }}</p>
            <div class="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
              <span>
                <span class="font-semibold text-slate-700">{{ line.account }}</span>
                <span class="text-slate-400"> · {{ line.accountName }}</span>
              </span>
              <span class="font-semibold tabular-nums" :class="line.debit ? 'text-emerald-700' : 'text-rose-700'">
                {{ line.debit ? `Nợ ${formatVnd(line.debit)}` : `Có ${formatVnd(line.credit)}` }}
              </span>
            </div>
            <p v-if="line.counterAccounts.length" class="mt-1 text-[11px] text-slate-500">
              Đối ứng:
              <template v-for="(counter, index) in line.counterAccounts" :key="counter.account">
                <span class="font-semibold text-slate-700">{{ counter.account }}</span>
                <span class="text-slate-400"> · {{ counter.name }}</span>
                <span class="tabular-nums text-slate-400">({{ formatVnd(counter.amount) }})</span>
                <span v-if="index < line.counterAccounts.length - 1">, </span>
              </template>
            </p>
          </div>
        </div>

        <div v-if="tab === 'journal'" class="hidden w-full overflow-x-auto sm:block">
          <table class="w-full min-w-[860px] text-left text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-2 font-semibold">Ngày</th>
                <th class="px-4 py-2 font-semibold">Chứng từ</th>
                <th class="px-4 py-2 font-semibold">Diễn giải</th>
                <th class="px-4 py-2 font-semibold">Tài khoản</th>
                <th class="px-4 py-2 font-semibold">Đối ứng</th>
                <th class="px-4 py-2 text-right font-semibold">Nợ</th>
                <th class="px-4 py-2 text-right font-semibold">Có</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="entries.length === 0">
                <td colspan="7" class="px-4 py-10 text-center text-sm text-slate-400">
                  Chưa có bút toán trong kỳ.
                </td>
              </tr>
              <tr v-for="line in entries" :key="line.id">
                <td class="px-4 py-2.5 text-xs text-slate-500">{{ formatDate(line.date) }}</td>
                <td class="px-4 py-2.5">
                  <NuxtLink :to="`/admin/orders/${line.orderId}`" class="font-mono text-xs font-semibold text-emerald-800 hover:underline">
                    {{ line.orderCode }}
                  </NuxtLink>
                  <p class="text-[10px] text-slate-400">{{ line.refType === 'refund' ? 'Hoàn tiền' : 'Bán hàng' }}</p>
                </td>
                <td class="px-4 py-2.5 text-xs text-slate-600">{{ line.description }}</td>
                <td class="px-4 py-2.5 text-xs">
                  <span class="font-semibold">{{ line.account }}</span>
                  <span class="text-slate-400"> · {{ line.accountName }}</span>
                </td>
                <td class="px-4 py-2.5 text-xs">
                  <template v-if="line.counterAccounts.length">
                    <p v-for="counter in line.counterAccounts" :key="counter.account">
                      <span class="font-semibold text-slate-700">{{ counter.account }}</span>
                      <span class="text-slate-400"> · {{ counter.name }}</span>
                      <span class="block text-[10px] tabular-nums text-slate-400">{{ formatVnd(counter.amount) }}</span>
                    </p>
                  </template>
                  <span v-else class="text-slate-300">—</span>
                </td>
                <td class="px-4 py-2.5 text-right tabular-nums">{{ line.debit ? formatVnd(line.debit) : '—' }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums">{{ line.credit ? formatVnd(line.credit) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="tab === 'invoices'" class="w-full overflow-x-auto">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-2 font-semibold">Số hoá đơn</th>
                <th class="px-4 py-2 font-semibold">Ngày</th>
                <th class="px-4 py-2 font-semibold">Người mua</th>
                <th class="px-4 py-2 text-right font-semibold">Chưa thuế</th>
                <th class="px-4 py-2 text-right font-semibold">GTGT</th>
                <th class="px-4 py-2 text-right font-semibold">Tổng</th>
                <th class="px-4 py-2 font-semibold">Trạng thái</th>
                <th class="px-4 py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="invoices.length === 0">
                <td colspan="8" class="px-4 py-10 text-center text-sm text-slate-400">
                  Chưa có hoá đơn trong kỳ.
                </td>
              </tr>
              <template v-for="invoice in invoices" :key="invoice.id">
                <tr>
                  <td class="px-4 py-2.5 font-mono text-xs font-semibold">{{ invoice.number }}</td>
                  <td class="px-4 py-2.5 text-xs text-slate-500">{{ formatDateTime(invoice.issuedAt) }}</td>
                  <td class="px-4 py-2.5">
                    <p class="text-xs font-medium text-slate-700">{{ invoice.customer }}</p>
                    <p class="text-[10px] text-slate-400">{{ invoice.email }}</p>
                  </td>
                  <td class="px-4 py-2.5 text-right tabular-nums">{{ formatVnd(invoice.net) }}</td>
                  <td class="px-4 py-2.5 text-right tabular-nums">{{ formatVnd(invoice.taxTotal) }}</td>
                  <td class="px-4 py-2.5 text-right font-semibold tabular-nums">{{ formatVnd(invoice.total) }}</td>
                  <td class="px-4 py-2.5">
                    <AdminBadge v-bind="invoiceStatusMeta(invoice.status)" />
                    <p v-if="invoice.cancelledReason" class="mt-0.5 text-[10px] text-rose-600">
                      {{ invoice.cancelledReason }}
                    </p>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      class="text-xs font-semibold text-slate-700 hover:underline"
                      @click="invoiceViewId = invoice.id"
                    >
                      Xem
                    </button>
                    <button
                      v-if="invoice.status === 'issued'"
                      type="button"
                      class="ml-2 text-xs font-semibold text-rose-700 hover:underline"
                      @click="cancellingId = invoice.id; cancelReason = ''"
                    >
                      Huỷ
                    </button>
                    <NuxtLink
                      :to="`/admin/orders/${invoice.id}`"
                      class="ml-2 text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Mở
                    </NuxtLink>
                  </td>
                </tr>
                <tr v-if="cancellingId === invoice.id" class="bg-rose-50/60">
                  <td colspan="8" class="px-4 py-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-[11px] text-rose-700">
                        Huỷ {{ invoice.number }} (giữ số): nhập lý do rồi xác nhận.
                      </span>
                      <input
                        v-model="cancelReason"
                        class="min-w-[220px] flex-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs outline-none focus:border-rose-500"
                        placeholder="Lý do huỷ hoá đơn"
                      />
                      <button
                        type="button"
                        class="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white"
                        @click="cancelInvoice(invoice)"
                      >
                        Xác nhận
                      </button>
                      <button
                        type="button"
                        class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                        @click="cancellingId = ''"
                      >
                        Bỏ
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div v-else class="w-full overflow-x-auto">
          <div class="border-b border-slate-100 px-4 py-2.5 text-[11px] text-slate-500">
            Bảng kê bán ra theo mẫu PL 01-1/GTGT (chưa gồm hoá đơn đã huỷ).
          </div>
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-2 font-semibold">STT</th>
                <th class="px-4 py-2 font-semibold">Số hoá đơn</th>
                <th class="px-4 py-2 font-semibold">Ngày</th>
                <th class="px-4 py-2 font-semibold">Người mua</th>
                <th class="px-4 py-2 font-semibold">MST</th>
                <th class="px-4 py-2 text-right font-semibold">Chưa thuế</th>
                <th class="px-4 py-2 text-right font-semibold">GTGT</th>
                <th class="px-4 py-2 text-right font-semibold">Tổng</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="activeInvoices.length === 0">
                <td colspan="8" class="px-4 py-10 text-center text-sm text-slate-400">
                  Chưa có hoá đơn hợp lệ trong kỳ.
                </td>
              </tr>
              <tr v-for="(invoice, index) in activeInvoices" :key="invoice.id">
                <td class="px-4 py-2.5 text-xs text-slate-500">{{ index + 1 }}</td>
                <td class="px-4 py-2.5 font-mono text-xs font-semibold">{{ invoice.number }}</td>
                <td class="px-4 py-2.5 text-xs text-slate-500">{{ formatDate(invoice.issuedAt) }}</td>
                <td class="px-4 py-2.5 text-xs">{{ invoice.customer }}</td>
                <td class="px-4 py-2.5 text-xs text-slate-400">—</td>
                <td class="px-4 py-2.5 text-right tabular-nums">{{ formatVnd(invoice.net) }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums">{{ formatVnd(invoice.taxTotal) }}</td>
                <td class="px-4 py-2.5 text-right font-semibold tabular-nums">{{ formatVnd(invoice.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 class="text-sm font-semibold">Thông tin người bán</h3>
        <p class="mt-0.5 text-[11px] text-slate-400">
          Dùng cho sổ hoá đơn. Chỉ quản trị viên được sửa.
        </p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Tên đơn vị / hộ kinh doanh</span>
            <input
              v-model="settingsForm.sellerName"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Mã số thuế</span>
            <input
              v-model="settingsForm.sellerTaxCode"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
          <label class="block sm:col-span-2">
            <span class="mb-1 block text-xs font-medium text-slate-600">Địa chỉ</span>
            <input
              v-model="settingsForm.sellerAddress"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Ký hiệu hoá đơn</span>
            <input
              v-model="settingsForm.invoiceSymbol"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              placeholder="VD: 1C26TAA"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Mẫu số</span>
            <input
              v-model="settingsForm.invoiceTemplate"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              placeholder="VD: 1/001"
            />
          </label>
        </div>
        <button
          type="button"
          class="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          :disabled="saving"
          @click="saveSettings"
        >
          {{ saving ? 'Đang lưu…' : 'Lưu thông tin' }}
        </button>
      </div>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[11px] leading-relaxed text-slate-500">
        <p class="font-semibold text-slate-600">Phạm vi hạch toán</p>
        <p class="mt-1">
          Ghi nhận doanh thu tại thời điểm đơn hoàn tất (VAS 14); giá bán đã bao gồm GTGT nên thuế được tách từ
          tổng. Tài khoản dùng chung TT 200/2014 và TT 133/2016: 111, 112, 131, 511, 3331, 5212.
        </p>
        <p class="mt-1">
          Chưa hạch toán giá vốn (632/156) vì hệ thống chưa có dữ liệu giá nhập. Hoá đơn ở đây là sổ theo dõi nội
          bộ; hoá đơn điện tử cần phát hành qua nhà cung cấp được cấp phép.
        </p>
      </div>
    </template>

    <AdminInvoiceDetail :order-id="invoiceViewId" :open="!!invoiceViewId" @close="invoiceViewId = ''" />
  </div>
</template>
