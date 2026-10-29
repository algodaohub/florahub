<script setup lang="ts">
import type { AdminInvoiceDetail } from '~/types/admin'
import { formatDate, formatVnd } from '~/utils/format'
import { invoiceStatusMeta, vatRateLabel } from '~/utils/accounting'
import { paymentMethodLabel } from '~/utils/admin'

const props = defineProps<{ orderId: string; open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const errorMessage = ref('')
const detail = ref<AdminInvoiceDetail | null>(null)
const fetcher = $fetch as unknown as (input: string, init?: Record<string, unknown>) => Promise<unknown>

async function load() {
  if (!props.orderId) return
  loading.value = true
  errorMessage.value = ''
  try {
    detail.value = (await fetcher(`/api/admin/orders/${props.orderId}/invoice`)) as AdminInvoiceDetail
  } catch (err: any) {
    detail.value = null
    errorMessage.value = err?.data?.statusMessage || err?.statusMessage || 'Không tải được hoá đơn.'
  } finally {
    loading.value = false
  }
}

const invoice = computed(() => detail.value?.invoice ?? null)

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

function printInvoice() {
  window.print()
}

watch(
  () => [props.open, props.orderId] as const,
  ([open]) => {
    if (open) void load()
    else detail.value = null
  },
  { immediate: true }
)

watch(
  () => props.open,
  (open) => {
    if (!import.meta.client) return
    if (open) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  }
)

onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fh-invoice-overlay fixed inset-0 z-[80] overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết hoá đơn GTGT"
      @click.self="emit('close')"
    >
      <div class="mx-auto my-6 w-full max-w-3xl">
        <div class="fh-no-print mb-3 flex items-center justify-between gap-2">
          <p class="text-xs font-semibold uppercase tracking-wider text-white/80">Chi tiết hoá đơn GTGT</p>
          <div class="flex gap-2">
            <button
              v-if="invoice"
              type="button"
              class="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              @click="printInvoice"
            >
              In hoá đơn
            </button>
            <button
              type="button"
              class="rounded-lg bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30 hover:bg-slate-900"
              @click="emit('close')"
            >
              Đóng
            </button>
          </div>
        </div>

        <div class="fh-invoice-sheet rounded-xl bg-white p-5 shadow-xl sm:p-8">
          <div v-if="loading" class="space-y-3">
            <div class="h-6 w-56 animate-pulse rounded bg-slate-100" />
            <div class="h-4 w-40 animate-pulse rounded bg-slate-100" />
            <div class="h-28 animate-pulse rounded bg-slate-100" />
            <div class="h-40 animate-pulse rounded bg-slate-100" />
          </div>

          <div v-else-if="errorMessage" class="py-8 text-center">
            <p class="text-sm text-rose-700">{{ errorMessage }}</p>
            <button
              type="button"
              class="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              @click="load"
            >
              Thử lại
            </button>
          </div>

          <template v-else-if="invoice">
            <header class="border-b border-slate-200 pb-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Mẫu số {{ invoice.seller.invoiceTemplate || '—' }} · Ký hiệu
                    {{ invoice.seller.invoiceSymbol || '—' }}
                  </p>
                  <h2 class="mt-1 text-lg font-bold uppercase tracking-tight text-slate-900">
                    Hoá đơn giá trị gia tăng
                  </h2>
                  <p class="mt-0.5 text-xs text-slate-500">Ngày {{ formatDate(invoice.issuedAt) }}</p>
                </div>
                <div class="text-right">
                  <p class="font-mono text-base font-bold text-slate-900">{{ invoice.number }}</p>
                  <div class="mt-1">
                    <AdminBadge v-bind="invoiceStatusMeta(invoice.status)" />
                  </div>
                </div>
              </div>
            </header>

            <div
              v-if="invoice.status === 'cancelled'"
              class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
            >
              Hoá đơn đã bị huỷ (số được giữ nguyên).
              <span v-if="invoice.cancelledReason">Lý do: {{ invoice.cancelledReason }}</span>
            </div>

            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div class="rounded-lg border border-slate-200 p-3">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Người bán</p>
                <p class="mt-1 text-sm font-semibold text-slate-900">
                  {{ invoice.seller.name || 'Chưa cấu hình tên người bán' }}
                </p>
                <p class="mt-0.5 text-xs text-slate-600">MST: {{ invoice.seller.taxCode || '—' }}</p>
                <p class="mt-0.5 text-xs text-slate-600">{{ invoice.seller.address || '—' }}</p>
              </div>
              <div class="rounded-lg border border-slate-200 p-3">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Người mua</p>
                <p class="mt-1 text-sm font-semibold text-slate-900">{{ invoice.buyer.name || '—' }}</p>
                <p class="mt-0.5 text-xs text-slate-600">
                  Điện thoại: {{ invoice.buyer.phone || '—' }} · MST: —
                </p>
                <p class="mt-0.5 text-xs text-slate-600">{{ invoice.buyer.address || '—' }}</p>
                <p v-if="invoice.buyer.email" class="mt-0.5 text-xs text-slate-500">{{ invoice.buyer.email }}</p>
              </div>
            </div>

            <div class="mt-4 overflow-x-auto">
              <table class="w-full text-left text-sm sm:min-w-[520px]">
                <thead class="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="px-2 py-2 font-semibold">STT</th>
                    <th class="px-2 py-2 font-semibold">Tên hàng hoá, dịch vụ</th>
                    <th class="px-2 py-2 text-center font-semibold">SL</th>
                    <th class="hidden px-2 py-2 text-right font-semibold sm:table-cell">Đơn giá</th>
                    <th class="px-2 py-2 text-right font-semibold">Thành tiền</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="(item, index) in invoice.items" :key="item.id">
                    <td class="px-2 py-2 text-xs text-slate-500">{{ index + 1 }}</td>
                    <td class="px-2 py-2">
                      <p class="font-medium text-slate-800">{{ item.title }}</p>
                      <p v-if="item.variantTitle" class="text-[11px] text-slate-500">{{ item.variantTitle }}</p>
                      <p class="mt-0.5 text-[11px] text-slate-500 sm:hidden">
                        {{ item.quantity }} × {{ formatVnd(item.unitPrice) }}
                      </p>
                    </td>
                    <td class="px-2 py-2 text-center text-slate-600">{{ item.quantity }}</td>
                    <td class="hidden px-2 py-2 text-right tabular-nums text-slate-600 sm:table-cell">{{ formatVnd(item.unitPrice) }}</td>
                    <td class="px-2 py-2 text-right font-semibold tabular-nums">
                      {{ formatVnd(item.unitPrice * item.quantity) }}
                    </td>
                  </tr>
                  <tr v-if="invoice.items.length === 0">
                    <td colspan="5" class="px-2 py-6 text-center text-xs text-slate-400">Đơn không có dòng hàng.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="max-w-sm text-xs leading-relaxed text-slate-500">
                <p>
                  Hình thức thanh toán:
                  <strong class="text-slate-700">{{ paymentMethodLabel(invoice.paymentMethod) }}</strong>
                </p>
                <p class="mt-1">
                  Giá bán đã bao gồm GTGT; thuế GTGT được tách từ tổng thanh toán theo tỷ lệ
                  {{ vatRateLabel(invoice.taxRate) }}.
                </p>
              </div>
              <dl class="w-full max-w-xs space-y-1 text-sm sm:text-right">
                <div class="flex justify-between gap-4">
                  <dt class="text-slate-500">Tạm tính</dt>
                  <dd class="tabular-nums">{{ formatVnd(invoice.subtotal) }}</dd>
                </div>
                <div v-if="invoice.discountTotal" class="flex justify-between gap-4">
                  <dt class="text-slate-500">Giảm giá</dt>
                  <dd class="tabular-nums text-emerald-700">−{{ formatVnd(invoice.discountTotal) }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-slate-500">Phí giao hàng</dt>
                  <dd class="tabular-nums">{{ invoice.shippingTotal ? formatVnd(invoice.shippingTotal) : 'Miễn phí' }}</dd>
                </div>
                <div class="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base font-bold">
                  <dt>Tổng thanh toán</dt>
                  <dd class="tabular-nums">{{ formatVnd(invoice.total) }}</dd>
                </div>
                <div class="flex justify-between gap-4 text-slate-500">
                  <dt>Trong đó GTGT ({{ vatRateLabel(invoice.taxRate) }})</dt>
                  <dd class="tabular-nums">{{ formatVnd(invoice.taxTotal) }}</dd>
                </div>
                <div class="flex justify-between gap-4 text-slate-500">
                  <dt>Tiền hàng chưa thuế</dt>
                  <dd class="tabular-nums">{{ formatVnd(invoice.net) }}</dd>
                </div>
              </dl>
            </div>

            <div class="mt-8 grid grid-cols-2 gap-4 border-t border-dashed border-slate-300 pt-4 text-center text-xs text-slate-500">
              <div>
                <p class="font-semibold text-slate-700">Người mua hàng</p>
                <p class="mt-0.5">(Ký, ghi rõ họ tên)</p>
              </div>
              <div>
                <p class="font-semibold text-slate-700">Người bán hàng</p>
                <p class="mt-0.5">(Ký, ghi rõ họ tên)</p>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
@media print {
  body * {
    visibility: hidden !important;
  }
  .fh-invoice-sheet,
  .fh-invoice-sheet * {
    visibility: visible !important;
  }
  .fh-invoice-overlay {
    position: static !important;
    overflow: visible !important;
    background: #fff !important;
    padding: 0 !important;
  }
  .fh-invoice-sheet {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    max-width: none;
    margin: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .fh-no-print {
    display: none !important;
  }
}
</style>
