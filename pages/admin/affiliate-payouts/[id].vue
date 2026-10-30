<script setup lang="ts">
import type { AdminAffiliatePayoutDetail } from '~/types/admin'
import { formatDate, formatDateTime, formatVnd } from '~/utils/format'
import { payoutMethodLabel, payoutStatusMeta } from '~/utils/admin'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Phiếu chi hoa hồng' })

const route = useRoute()
const requestFetch = useRequestFetch()
const id = String(route.params.id ?? '')

const { data, pending, error, refresh } = await useAsyncData<AdminAffiliatePayoutDetail>(
  `admin-affiliate-payout-${id}`,
  () => requestFetch<AdminAffiliatePayoutDetail>(`/api/admin/affiliate-payouts/${id}`)
)

const payout = computed(() => data.value?.payout ?? null)
const statement = computed(() => data.value?.statement ?? null)
const statusMeta = computed(() => payoutStatusMeta(payout.value?.status ?? ''))
const isDraft = computed(() => payout.value?.status === 'draft')

const message = ref('')
const actionError = ref('')

const payModalOpen = ref(false)
const paySaving = ref(false)
const payError = ref('')
const payForm = reactive({ method: 'bank_transfer', reference: '', note: '' })

const cancelModalOpen = ref(false)
const cancelSaving = ref(false)
const cancelError = ref('')
const cancelNote = ref('')

function openPayModal() {
  payError.value = ''
  payForm.method = payout.value?.method || 'bank_transfer'
  payForm.reference = ''
  payForm.note = ''
  payModalOpen.value = true
}

async function submitPay() {
  if (paySaving.value) return
  paySaving.value = true
  payError.value = ''
  actionError.value = ''
  try {
    await $fetch(`/api/admin/affiliate-payouts/${id}/pay`, {
      method: 'POST',
      body: {
        method: payForm.method,
        reference: payForm.reference,
        note: payForm.note
      }
    })
    payModalOpen.value = false
    message.value = 'Đã xác nhận chi trả và khoá hoa hồng trong phiếu.'
    await refresh()
  } catch (err: any) {
    payError.value = err?.data?.statusMessage || err?.statusMessage || 'Không xác nhận được phiếu chi.'
  } finally {
    paySaving.value = false
  }
}

function openCancelModal() {
  cancelError.value = ''
  cancelNote.value = ''
  cancelModalOpen.value = true
}

async function submitCancel() {
  if (cancelSaving.value) return
  if (cancelNote.value.trim().length < 3) {
    cancelError.value = 'Vui lòng nhập lý do huỷ phiếu.'
    return
  }
  cancelSaving.value = true
  cancelError.value = ''
  actionError.value = ''
  try {
    await $fetch(`/api/admin/affiliate-payouts/${id}/cancel`, {
      method: 'POST',
      body: { note: cancelNote.value }
    })
    cancelModalOpen.value = false
    message.value = 'Đã huỷ phiếu nháp; hoa hồng trở về trạng thái khả dụng.'
    await refresh()
  } catch (err: any) {
    cancelError.value = err?.data?.statusMessage || err?.statusMessage || 'Không huỷ được phiếu chi.'
  } finally {
    cancelSaving.value = false
  }
}

useHead({ title: 'Phiếu chi hoa hồng' })
</script>

<template>
  <div class="w-full space-y-4">
    <div v-if="pending && !data" class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div class="space-y-2">
          <div class="h-3 w-28 animate-pulse rounded bg-slate-200" />
          <div class="h-6 w-48 animate-pulse rounded bg-slate-200" />
          <div class="h-3 w-36 animate-pulse rounded bg-slate-200" />
        </div>
        <div class="flex gap-2">
          <div class="h-8 w-28 animate-pulse rounded-lg bg-slate-200" />
          <div class="h-8 w-24 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>
      <div class="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />
      <div class="h-[520px] animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>

    <div v-else-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      <p>Không tải được phiếu chi.</p>
      <button type="button" class="mt-2 rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold" @click="refresh()">
        Thử lại
      </button>
    </div>

    <template v-else-if="payout">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <NuxtLink to="/admin/affiliate-payouts" class="text-xs font-semibold text-slate-500 hover:text-emerald-700">
            ← Danh sách phiếu chi
          </NuxtLink>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <h2 class="font-mono text-lg font-semibold">{{ payout.number }}</h2>
            <AdminBadge v-bind="statusMeta" />
          </div>
          <p class="mt-0.5 text-sm text-slate-500">
            {{ payout.affiliateName || payout.affiliateCode || '—' }} · Lập {{ payout.createdAt ? formatDate(payout.createdAt) : '—' }}
          </p>
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
          <template v-if="isDraft">
            <button
              type="button"
              class="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
              @click="openPayModal"
            >
              Xác nhận đã chi
            </button>
            <button
              type="button"
              class="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              @click="openCancelModal"
            >
              Huỷ nháp
            </button>
          </template>
        </div>
      </div>

      <p v-if="message" class="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700" role="status">{{ message }}</p>
      <p v-if="actionError" class="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700" role="alert">{{ actionError }}</p>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Người nhận</p>
            <p class="mt-1 text-sm font-semibold text-slate-800">
              <NuxtLink
                v-if="payout.affiliateId"
                :to="`/admin/affiliates/${payout.affiliateId}`"
                class="hover:text-emerald-700"
              >
                {{ payout.affiliateName || payout.affiliateCode }}
              </NuxtLink>
              <span v-else>{{ payout.affiliateName || '—' }}</span>
            </p>
            <p class="mt-0.5 text-xs text-slate-500">
              <span class="font-mono">{{ payout.affiliateCode }}</span>
              <template v-if="payout.affiliateEmail"> · {{ payout.affiliateEmail }}</template>
            </p>
            <p class="mt-0.5 text-xs text-slate-500">MST: {{ payout.taxCode || '—' }}</p>
            <p class="mt-2 text-xs text-slate-600">{{ payout.bankName || '—' }} · {{ payout.bankAccountNo || '—' }}</p>
            <p class="text-xs text-slate-500">{{ payout.bankAccountName || '—' }}</p>
          </div>

          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Số liệu chi trả</p>
            <dl class="mt-1 space-y-1 text-sm">
              <div class="flex justify-between gap-4">
                <dt class="text-slate-500">Tổng hoa hồng ({{ payout.commissionCount }} dòng)</dt>
                <dd class="tabular-nums">{{ formatVnd(payout.grossTotal) }}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-slate-500">Thuế TNCN ({{ payout.taxRate }}%)</dt>
                <dd class="tabular-nums text-rose-700">−{{ formatVnd(payout.taxTotal) }}</dd>
              </div>
              <div class="flex justify-between gap-4 border-t border-slate-200 pt-1 font-semibold">
                <dt>Thực chi</dt>
                <dd class="tabular-nums">{{ formatVnd(payout.netTotal) }}</dd>
              </div>
            </dl>
          </div>

          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Chi trả</p>
            <p class="mt-1 text-xs text-slate-600">Hình thức: {{ payoutMethodLabel(payout.method) }}</p>
            <p class="mt-0.5 text-xs text-slate-600">Mã giao dịch: {{ payout.reference || '—' }}</p>
            <p class="mt-0.5 text-xs text-slate-600">
              Ngày chi: {{ payout.paidAt ? formatDateTime(payout.paidAt) : 'Chưa chi' }}
            </p>
            <p v-if="statement" class="mt-0.5 text-xs text-slate-600">
              Kỳ đối soát:
              {{ statement.periodFrom || statement.periodTo ? `${statement.periodFrom ? formatDate(statement.periodFrom) : '…'} – ${statement.periodTo ? formatDate(statement.periodTo) : '…'}` : 'Tất cả hoa hồng khả dụng' }}
            </p>
            <p v-if="payout.note" class="mt-2 whitespace-pre-line text-xs text-slate-500">Ghi chú: {{ payout.note }}</p>
          </div>
        </div>
      </section>

      <AffiliatePaymentStatement :statement="statement" />

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 class="text-sm font-semibold">Dòng hoa hồng trong phiếu</h3>
        <div class="mt-2 overflow-x-auto">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-3 py-2 font-semibold">Mã đơn</th>
                <th class="px-3 py-2 font-semibold">Hoàn tất</th>
                <th class="px-3 py-2 text-right font-semibold">Tiền hàng</th>
                <th class="px-3 py-2 text-center font-semibold">Tỷ lệ</th>
                <th class="px-3 py-2 text-right font-semibold">Hoa hồng</th>
                <th class="px-3 py-2 text-right font-semibold"> </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="pending">
                <td v-for="cell in 6" :key="`skeleton-${cell}`" class="px-3 py-3">
                  <div class="h-4 w-full animate-pulse rounded bg-slate-100" />
                </td>
              </tr>
              <tr v-else-if="(data?.lines.length ?? 0) === 0">
                <td colspan="6" class="px-3 py-8 text-center text-xs text-slate-400">Phiếu chưa có dòng hoa hồng.</td>
              </tr>
              <template v-else>
                <tr v-for="line in data?.lines ?? []" :key="line.commissionId">
                  <td class="px-3 py-3 font-mono text-xs text-slate-700">{{ line.orderCode || '—' }}</td>
                  <td class="px-3 py-3 text-xs text-slate-500">{{ line.completedAt ? formatDate(line.completedAt) : '—' }}</td>
                  <td class="px-3 py-3 text-right tabular-nums text-slate-600">{{ formatVnd(line.goodsTotal) }}</td>
                  <td class="px-3 py-3 text-center text-slate-600">{{ line.rate }}%</td>
                  <td class="px-3 py-3 text-right font-semibold tabular-nums">{{ formatVnd(line.amount) }}</td>
                  <td class="px-3 py-3 text-right">
                    <NuxtLink
                      v-if="line.orderId"
                      :to="`/admin/orders/${line.orderId}`"
                      class="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Đơn hàng
                    </NuxtLink>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="payModalOpen"
        class="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label="Xác nhận chi trả"
        @click.self="payModalOpen = false"
      >
        <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <h3 class="text-base font-semibold">Xác nhận đã chi</h3>
          <p class="mt-0.5 text-xs text-slate-500">
            Hoa hồng trong phiếu sẽ được khoá ở trạng thái đã chi. Thao tác này không thể hoàn tác.
          </p>

          <dl class="mt-3 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-slate-500">Số phiếu</dt>
              <dd class="font-mono text-xs font-semibold">{{ payout?.number }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-500">Thực chi</dt>
              <dd class="font-semibold tabular-nums">{{ formatVnd(payout?.netTotal ?? 0) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-500">Ngân hàng nhận</dt>
              <dd class="text-xs">{{ payout?.bankName || '—' }} · {{ payout?.bankAccountNo || '—' }}</dd>
            </div>
          </dl>

          <form class="mt-4 space-y-3" @submit.prevent="submitPay">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Hình thức chi</span>
              <select v-model="payForm.method" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                <option value="cash">Tiền mặt</option>
                <option value="other">Khác</option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Mã giao dịch / chứng từ</span>
              <input v-model="payForm.reference" type="text" maxlength="120" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Ghi chú</span>
              <textarea v-model="payForm.note" rows="2" maxlength="500" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>

            <p v-if="payError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ payError }}</p>

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                @click="payModalOpen = false"
              >
                Đóng
              </button>
              <button
                type="submit"
                class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                :disabled="paySaving"
              >
                {{ paySaving ? 'Đang xác nhận…' : 'Xác nhận đã chi' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div
        v-if="cancelModalOpen"
        class="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label="Huỷ phiếu nháp"
        @click.self="cancelModalOpen = false"
      >
        <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <h3 class="text-base font-semibold">Huỷ phiếu nháp</h3>
          <p class="mt-0.5 text-xs text-slate-500">
            Hoa hồng trong phiếu sẽ trở về trạng thái khả dụng và có thể lập phiếu chi mới.
          </p>

          <form class="mt-4 space-y-3" @submit.prevent="submitCancel">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Lý do huỷ</span>
              <textarea v-model="cancelNote" rows="3" maxlength="400" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>

            <p v-if="cancelError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ cancelError }}</p>

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                @click="cancelModalOpen = false"
              >
                Giữ phiếu
              </button>
              <button
                type="submit"
                class="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                :disabled="cancelSaving"
              >
                {{ cancelSaving ? 'Đang huỷ…' : 'Huỷ phiếu' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
