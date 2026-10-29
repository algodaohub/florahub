<script setup lang="ts">
import type { OrderDetail } from '~/types'

const props = defineProps<{ order: OrderDetail }>()

const { config } = useSite()

const payments = computed(() => config.value.payments)
const paid = computed(() => props.order.paymentStatus === 'paid' || props.order.status === 'completed')
const cancelled = computed(() => props.order.status === 'cancelled')
const method = computed(() => {
  const value = props.order.paymentMethod
  return value === 'qr' || value === 'cod' || value === 'sepay' ? value : resolvePaymentMethod(payments.value)
})
const qrReady = computed(() => isQrPaymentReady(payments.value))
const showQr = computed(() => !paid.value && !cancelled.value && method.value === 'qr')

const paying = ref(false)
const payError = ref('')

const autoConfirm = computed(() => Boolean(payments.value.qr.webhookReady || payments.value.qr.apiReady))

async function payWithSepay() {
  if (paying.value) return
  paying.value = true
  payError.value = ''
  try {
    const redirecting = await startSepayCheckout(props.order.id)
    if (!redirecting) window.location.reload()
  } catch (error: unknown) {
    payError.value = apiErrorMessage(error, 'Không thể mở cổng thanh toán. Vui lòng thử lại.')
  } finally {
    paying.value = false
  }
}

const transferNote = computed(() => formatOrderCode(props.order.id))
const qrUrl = computed(() =>
  buildVietQrUrl(payments.value, { amount: props.order.total, addInfo: transferNote.value })
)

const qrFailed = ref(false)
const copied = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const statusText = computed(() => {
  if (cancelled.value) return 'Đơn đã huỷ'
  if (paid.value) return 'Đã thanh toán'
  if (method.value === 'cod') return 'Thanh toán khi nhận hàng'
  if (method.value === 'sepay') return 'Chờ thanh toán online'
  return 'Chờ thanh toán'
})

const heading = computed(() => {
  if (cancelled.value) return 'Đơn hàng đã huỷ'
  if (paid.value) return 'Thanh toán hoàn tất'
  return 'Đặt hàng thành công'
})

async function copy(label: string, value: string) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    copied.value = label
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = ''
    }, 1600)
  } catch {
    copied.value = ''
  }
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <section
    aria-labelledby="order-payment-card-title"
    class="overflow-hidden rounded-[20px] border shadow-card"
    :class="cancelled ? 'border-hairline bg-white/50' : 'border-primary/25 bg-gradient-to-b from-primary-soft/70 to-white/40'"
  >
    <div class="flex items-start gap-3 px-4 pb-3 pt-4">
      <span
        class="grid h-10 w-10 shrink-0 place-items-center rounded-full"
        :class="cancelled ? 'bg-paper-deep text-muted' : 'bg-primary text-white'"
      >
        <AppIcon :name="paid ? 'check' : cancelled ? 'close' : 'receipt'" size="h-5 w-5" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 id="order-payment-card-title" class="t-section font-semibold leading-tight">{{ heading }}</h2>
        <p class="mt-0.5 truncate t-meta text-muted">
          {{ transferNote }} · {{ formatDateTimeNumeric(order.createdAt) }}
        </p>
      </div>
      <span
        class="shrink-0 rounded-full px-2.5 py-1 t-micro font-semibold"
        :class="
          cancelled
            ? 'bg-discount/10 text-discount'
            : paid
              ? 'bg-primary-soft text-primary'
              : 'bg-accent-soft text-accent'
        "
      >
        {{ statusText }}
      </span>
    </div>

    <div class="flex items-baseline justify-between gap-3 px-4">
      <p class="t-meta text-muted">Số tiền</p>
      <p class="t-page font-semibold leading-none text-primary">{{ formatVnd(order.total) }}</p>
    </div>

    <div v-if="showQr" class="px-4 pb-4 pt-3">
      <div class="rounded-[18px] border border-hairline/60 bg-white p-3 text-center">
        <img
          v-if="qrUrl && !qrFailed"
          :src="qrUrl"
          alt="Mã QR chuyển khoản"
          width="220"
          height="220"
          class="mx-auto h-[210px] w-[210px] object-contain"
          loading="eager"
          @error="qrFailed = true"
        />
        <div v-else class="grid h-[150px] place-items-center px-4 t-meta text-muted">
          {{ qrReady ? 'Không tải được mã QR. Vui lòng chuyển khoản theo thông tin bên dưới.' : 'Cửa hàng chưa cấu hình tài khoản nhận chuyển khoản QR.' }}
        </div>
        <p class="mt-1 t-micro text-muted">Mở app ngân hàng và quét mã để thanh toán đúng số tiền</p>
      </div>

      <dl class="mt-3 divide-y divide-hairline/50 rounded-[16px] border border-hairline/60 bg-white/70 px-3">
        <div v-if="payments.qr.bankName || payments.qr.bankId" class="flex items-center justify-between gap-3 py-2.5">
          <dt class="t-meta text-muted">Ngân hàng</dt>
          <dd class="text-right t-meta font-medium">{{ payments.qr.bankName || payments.qr.bankId }}</dd>
        </div>
        <div v-if="payments.qr.accountNo" class="flex items-center justify-between gap-3 py-2.5">
          <dt class="t-meta text-muted">Số tài khoản</dt>
          <dd class="flex min-w-0 items-center gap-1.5">
            <span class="truncate t-meta font-medium">{{ formatBankAccount(payments.qr.accountNo) }}</span>
            <button
              type="button"
              class="shrink-0 rounded-full p-1 text-primary active:bg-primary-soft"
              :aria-label="`Sao chép số tài khoản`"
              @click="copy('account', payments.qr.accountNo)"
            >
              <AppIcon name="clipboard" size="h-4 w-4" />
            </button>
          </dd>
        </div>
        <div v-if="payments.qr.accountName" class="flex items-center justify-between gap-3 py-2.5">
          <dt class="t-meta text-muted">Chủ tài khoản</dt>
          <dd class="truncate text-right t-meta font-medium">{{ payments.qr.accountName }}</dd>
        </div>
        <div class="flex items-center justify-between gap-3 py-2.5">
          <dt class="t-meta text-muted">Nội dung</dt>
          <dd class="flex min-w-0 items-center gap-1.5">
            <span class="truncate t-meta font-semibold">{{ transferNote }}</span>
            <button
              type="button"
              class="shrink-0 rounded-full p-1 text-primary active:bg-primary-soft"
              aria-label="Sao chép nội dung chuyển khoản"
              @click="copy('note', transferNote)"
            >
              <AppIcon name="clipboard" size="h-4 w-4" />
            </button>
          </dd>
        </div>
      </dl>

      <p class="mt-2 t-micro text-muted">
        {{
          copied
            ? 'Đã sao chép.'
            : autoConfirm
              ? 'Trang tự cập nhật ngay khi tiền về. Ghi đúng nội dung để khớp giao dịch nhanh.'
              : 'Ghi đúng nội dung chuyển khoản để cửa hàng đối chiếu.'
        }}
      </p>
    </div>

    <div v-else-if="!cancelled" class="px-4 pb-4 pt-3">
      <div class="flex items-start gap-2.5 rounded-[16px] border border-hairline/60 bg-white/70 px-3 py-2.5">
        <AppIcon
          :name="method === 'cod' ? 'truck' : method === 'sepay' ? 'wallet' : 'check'"
          size="h-4 w-4"
          class="mt-0.5 shrink-0 text-primary"
        />
        <p class="t-meta leading-snug text-muted">
          {{
            paid
              ? 'Đơn hàng đã được thanh toán đầy đủ.'
              : method === 'cod'
                ? 'Thanh toán khi nhận hàng. Vui lòng chuẩn bị số tiền trên khi nhận đơn.'
                : method === 'sepay'
                  ? 'Thanh toán online qua SePay bằng thẻ quốc tế, VietQR hoặc NAPAS.'
                  : 'Cửa hàng sẽ xác nhận thanh toán sau khi nhận được chuyển khoản.'
          }}
        </p>
      </div>
      <button
        v-if="method === 'sepay' && !paid"
        type="button"
        class="btn-primary mt-3 w-full"
        :disabled="paying"
        @click="payWithSepay"
      >
        {{ paying ? 'Đang mở cổng thanh toán…' : 'Thanh toán ngay' }}
      </button>
      <p v-if="payError" class="mt-2 t-micro text-discount">{{ payError }}</p>
      <p v-if="copied" class="mt-2 t-micro text-muted">Đã sao chép.</p>
    </div>
  </section>
</template>
