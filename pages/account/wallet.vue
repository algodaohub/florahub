<script setup lang="ts">
import type { Wallet, WalletTransaction } from '~/types'

type TopupRequest = {
  id: string
  code: string
  amount: number
  payment: {
    method: string
    bankName: string
    bankId: string
    accountNo: string
    accountName: string
    qrUrl: string
    instructions: string
  }
}

const { data, refresh } = await useFetch<{ wallet: Wallet; transactions: WalletTransaction[] }>(
  '/api/account/wallet',
  { key: 'account-wallet' }
)

const amount = ref(100000)
const pending = ref(false)
const message = ref('')
const errorMessage = ref('')
const topupRequest = ref<TopupRequest | null>(null)
let poll: ReturnType<typeof setInterval> | null = null

const quickAmounts = [50000, 100000, 200000, 500000]

const showBank = ref(false)
const bank = reactive({
  bankName: data.value?.wallet.bankName ?? '',
  bankAccount: data.value?.wallet.bankAccount ?? '',
  bankHolder: data.value?.wallet.bankHolder ?? ''
})

function stopPolling() {
  if (poll) clearInterval(poll)
  poll = null
}

function startPolling() {
  stopPolling()
  poll = setInterval(async () => {
    await refresh()
    const code = topupRequest.value?.code
    if (!code) return
    const tx = data.value?.transactions.find((item) => item.code === code)
    if (tx?.status === 'paid') {
      message.value = `Đã nạp ${formatVnd(tx.amount)} vào ví.`
      topupRequest.value = null
      stopPolling()
    }
  }, 10000)
}

async function topup() {
  message.value = ''
  errorMessage.value = ''
  pending.value = true
  try {
    const result = await $fetch<{ topup: TopupRequest }>('/api/account/wallet/topup', {
      method: 'POST',
      body: { amount: Number(amount.value) }
    })
    topupRequest.value = result.topup
    startPolling()
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Không thể tạo mã nạp tiền. Vui lòng thử lại.')
  } finally {
    pending.value = false
  }
}

async function saveBank() {
  pending.value = true
  message.value = ''
  errorMessage.value = ''
  try {
    await $fetch('/api/account/wallet', { method: 'PATCH', body: bank })
    await refresh()
    showBank.value = false
    message.value = 'Đã lưu thông tin ngân hàng.'
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Không thể lưu thông tin ngân hàng.')
  } finally {
    pending.value = false
  }
}

onBeforeUnmount(stopPolling)

useHead({ title: 'Ví' })
</script>

<template>
  <div class="container-page py-4">
    <AccountHeader title="Ví" back-to="/account" />

    <section class="mt-3 overflow-hidden rounded-xl2 bg-primary p-5 text-white shadow-soft">
      <p class="t-meta text-white/70">Số dư khả dụng</p>
      <p class="mt-1 t-display font-semibold">{{ formatVnd(data?.wallet.balance ?? 0) }}</p>
      <p class="mt-2 t-meta text-white/70">Dùng ví để thanh toán đơn hàng nhanh hơn.</p>
    </section>

    <section class="card mt-3 p-4">
      <h1 class="t-section font-semibold">Nạp tiền vào ví</h1>
      <p class="mt-1 t-micro text-muted">Chuyển khoản đúng nội dung, hệ thống tự cộng tiền qua SePay.</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="value in quickAmounts"
          :key="value"
          type="button"
          class="rounded-full border px-3 py-1.5 t-meta font-semibold transition"
          :class="Number(amount) === value ? 'border-primary bg-primary text-white' : 'border-hairline bg-white/70 text-ink/70'"
          @click="amount = value"
        >
          {{ formatVnd(value) }}
        </button>
      </div>

      <div class="mt-3 flex gap-2">
        <input v-model.number="amount" type="number" min="10000" max="50000000" step="10000" class="field py-2.5" />
        <button type="button" class="btn-primary shrink-0 px-4" :disabled="pending" @click="topup">
          {{ pending ? 'Đang tạo…' : 'Lấy mã QR' }}
        </button>
      </div>

      <div v-if="topupRequest" class="mt-3 rounded-xl2 border border-primary/25 bg-primary-soft/40 p-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="t-body font-semibold text-primary">Chờ thanh toán {{ formatVnd(topupRequest.amount) }}</p>
            <p class="mt-0.5 t-micro text-muted">Tự cập nhật sau khi nhận đúng nội dung.</p>
          </div>
          <span class="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 t-micro font-semibold text-accent">Chờ chuyển</span>
        </div>

        <div class="mt-3 rounded-xl border border-hairline/60 bg-white p-3 text-center">
          <img
            :src="topupRequest.payment.qrUrl"
            alt="Mã QR nạp tiền vào ví"
            width="200"
            height="200"
            class="mx-auto h-[190px] w-[190px] object-contain"
            loading="eager"
          />
          <p class="mt-1 t-micro text-muted">Mở app ngân hàng và quét mã</p>
        </div>

        <dl class="mt-2 divide-y divide-hairline/50 rounded-xl border border-hairline/60 bg-white/70 px-3">
          <div class="flex items-center justify-between gap-3 py-2">
            <dt class="t-meta text-muted">Ngân hàng</dt>
            <dd class="text-right t-meta font-medium">{{ topupRequest.payment.bankName }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 py-2">
            <dt class="t-meta text-muted">Số tài khoản</dt>
            <dd class="truncate text-right t-meta font-medium">{{ topupRequest.payment.accountNo }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 py-2">
            <dt class="t-meta text-muted">Chủ tài khoản</dt>
            <dd class="truncate text-right t-meta font-medium">{{ topupRequest.payment.accountName }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 py-2">
            <dt class="t-meta text-muted">Nội dung</dt>
            <dd class="truncate text-right t-meta font-semibold">{{ topupRequest.code }}</dd>
          </div>
        </dl>
      </div>

      <p v-if="message" class="mt-3 rounded-xl bg-primary-soft px-3 py-2 t-body text-primary" role="status">{{ message }}</p>
      <p v-if="errorMessage" class="mt-3 rounded-xl bg-discount/10 px-3 py-2 t-body text-discount" role="alert">{{ errorMessage }}</p>
    </section>

    <section class="card mt-3 p-4">
      <div class="flex items-center justify-between">
        <h2 class="t-section font-semibold">Tài khoản ngân hàng</h2>
        <button type="button" class="t-meta font-semibold text-primary hover:underline" @click="showBank = !showBank">
          {{ showBank ? 'Đóng' : 'Cập nhật' }}
        </button>
      </div>
      <p v-if="!showBank" class="mt-2 t-body text-muted">
        <template v-if="data?.wallet.bankAccount">
          {{ data.wallet.bankName }} · {{ data.wallet.bankAccount }} · {{ data.wallet.bankHolder }}
        </template>
        <template v-else>Chưa liên kết tài khoản ngân hàng.</template>
      </p>

      <form v-else class="mt-3 space-y-3" @submit.prevent="saveBank">
        <input v-model="bank.bankName" type="text" class="field py-2" placeholder="Tên ngân hàng" />
        <input v-model="bank.bankAccount" type="text" class="field py-2" placeholder="Số tài khoản" />
        <input v-model="bank.bankHolder" type="text" class="field py-2 uppercase" placeholder="Chủ tài khoản" />
        <button type="submit" class="btn-primary w-full py-2.5" :disabled="pending">Lưu thông tin</button>
      </form>
    </section>

    <section class="mt-4">
      <h2 class="t-section font-semibold">Lịch sử giao dịch</h2>
      <div v-if="data?.transactions.length" class="mt-2 divide-y divide-hairline/60 rounded-xl2 border border-hairline/70 bg-white/70">
        <div v-for="item in data.transactions" :key="item.id" class="flex items-center justify-between gap-3 p-3.5">
          <div class="min-w-0">
            <p class="t-body font-medium">{{ item.note || (item.type === 'topup' ? 'Nạp tiền' : 'Thanh toán') }}</p>
            <p class="t-micro text-muted">
              {{ formatDate(item.createdAt) }}
              <span v-if="item.status === 'pending'" class="text-accent"> · Chờ thanh toán</span>
            </p>
          </div>
          <p
            class="shrink-0 t-body font-semibold"
            :class="item.status === 'pending' ? 'text-muted' : item.amount >= 0 ? 'text-primary' : 'text-discount'"
          >
            {{ item.amount >= 0 ? '+' : '' }}{{ formatVnd(item.amount) }}
          </p>
        </div>
      </div>
      <p v-else class="mt-2 rounded-xl2 border border-dashed border-hairline bg-white/50 p-5 text-center t-body text-muted">
        Chưa có giao dịch nào.
      </p>
    </section>
  </div>
</template>
