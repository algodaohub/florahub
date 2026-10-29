<script setup lang="ts">
import type { Address } from '~/types'

const { data, refresh, pending } = await useFetch<{ addresses: Address[] }>('/api/account/addresses', {
  key: 'account-addresses',
  lazy: !import.meta.server
})

const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const errorMessage = ref('')

const form = reactive({
  label: 'Nhà riêng',
  recipient: '',
  phone: '',
  line1: '',
  ward: '',
  city: '',
  isDefault: false
})

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    label: 'Nhà riêng',
    recipient: '',
    phone: '',
    line1: '',
    ward: '',
    city: '',
    isDefault: false
  })
  errorMessage.value = ''
}

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(address: Address) {
  editingId.value = address.id
  Object.assign(form, {
    label: address.label,
    recipient: address.recipient,
    phone: address.phone,
    line1: address.line1,
    ward: address.ward,
    city: address.city,
    isDefault: address.isDefault
  })
  errorMessage.value = ''
  showForm.value = true
}

async function save() {
  if (saving.value) return
  errorMessage.value = ''

  const recipient = form.recipient.trim()
  const phone = normalizePhone(form.phone)
  const line1 = form.line1.trim()

  if (!recipient) {
    errorMessage.value = 'Vui lòng nhập tên người nhận.'
    return
  }
  if (!isValidVietnamesePhone(phone)) {
    errorMessage.value = 'Số điện thoại không hợp lệ. Ví dụ: 0901234567.'
    return
  }
  if (!form.city) {
    errorMessage.value = 'Vui lòng chọn tỉnh / thành phố.'
    return
  }
  if (!form.ward) {
    errorMessage.value = 'Vui lòng chọn phường / xã / đặc khu.'
    return
  }
  if (!line1) {
    errorMessage.value = 'Vui lòng nhập địa chỉ chi tiết (số nhà, đường).'
    return
  }

  saving.value = true
  try {
    const body = { ...form, recipient, phone, line1 }
    if (editingId.value) {
      await $fetch(`/api/account/addresses/${editingId.value}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/account/addresses', { method: 'POST', body })
    }
    await refresh()
    showForm.value = false
    resetForm()
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Không thể lưu địa chỉ. Vui lòng thử lại.')
  } finally {
    saving.value = false
  }
}

async function makeDefault(address: Address) {
  await $fetch(`/api/account/addresses/${address.id}`, { method: 'PATCH', body: { isDefault: true } })
  await refresh()
}

async function remove(address: Address) {
  if (!window.confirm(`Xoá địa chỉ ${address.label}?`)) return
  await $fetch(`/api/account/addresses/${address.id}`, { method: 'DELETE' })
  await refresh()
}

useHead({ title: 'Địa chỉ giao hàng' })
</script>

<template>
  <div class="container-page py-4">
    <AccountHeader title="Địa chỉ" back-to="/account" />

    <div class="mt-3 flex items-center justify-between gap-3">
      <div>
        <h1 class="t-page font-semibold">Địa chỉ giao hàng</h1>
        <p class="mt-0.5 t-meta text-muted">Lưu địa chỉ để thanh toán nhanh hơn.</p>
      </div>
      <button type="button" class="btn-primary shrink-0 px-4 py-2" @click="openCreate">Thêm địa chỉ</button>
    </div>

    <form v-if="showForm" class="card mt-3 space-y-3 p-4" @submit.prevent="save">
      <div class="flex items-center justify-between">
        <h2 class="t-section font-semibold">{{ editingId ? 'Sửa địa chỉ' : 'Địa chỉ mới' }}</h2>
        <button type="button" class="t-meta text-muted hover:text-primary" @click="showForm = false">Đóng</button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block t-meta font-medium text-muted">Nhãn</span>
          <input v-model="form.label" type="text" class="field py-2" placeholder="Nhà riêng" />
        </label>
        <label class="block">
          <span class="mb-1 block t-meta font-medium text-muted">Người nhận</span>
          <input v-model="form.recipient" type="text" required class="field py-2" />
        </label>
      </div>

      <label class="block">
        <span class="mb-1 block t-meta font-medium text-muted">Số điện thoại</span>
        <input v-model="form.phone" type="tel" inputmode="numeric" required class="field py-2" />
      </label>

      <AddressRegionFields
        v-model:city="form.city"
        v-model:ward="form.ward"
        required
        id-prefix="account-region"
      />

      <label class="block">
        <span class="mb-1 block t-meta font-medium text-muted">Địa chỉ chi tiết</span>
        <input v-model="form.line1" type="text" required class="field py-2" placeholder="Số nhà, đường" autocomplete="street-address" />
      </label>

      <label class="flex items-center gap-2 t-body">
        <input v-model="form.isDefault" type="checkbox" class="h-4 w-4 rounded border-hairline text-primary" />
        Đặt làm địa chỉ mặc định
      </label>

      <p v-if="errorMessage" class="rounded-xl bg-discount/10 px-3 py-2 t-body text-discount" role="alert">{{ errorMessage }}</p>

      <button type="submit" class="btn-primary w-full py-2.5" :disabled="saving">
        {{ saving ? 'Đang lưu...' : 'Lưu địa chỉ' }}
      </button>
    </form>

    <div v-if="pending" class="mt-4">
      <SkeletonOrders :rows="2" />
    </div>

    <div v-else-if="data?.addresses.length" class="mt-3 space-y-2">
      <article
        v-for="address in data.addresses"
        :key="address.id"
        class="rounded-xl2 border border-hairline/70 bg-white/75 p-4 shadow-card"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="t-body font-semibold">{{ address.recipient }} · {{ address.phone }}</p>
              <span v-if="address.isDefault" class="rounded-full bg-primary-soft px-2 py-0.5 t-micro font-semibold text-primary">Mặc định</span>
            </div>
            <p class="mt-1 t-meta text-muted">
              {{ address.line1 }}<template v-if="address.ward">, {{ address.ward }}</template>, {{ address.city }}
            </p>
            <p class="mt-1 t-micro text-muted">{{ address.label }}</p>
          </div>
          <button type="button" class="t-meta font-medium text-primary hover:underline" @click="openEdit(address)">Sửa</button>
        </div>
        <div class="mt-3 flex items-center gap-3 border-t border-hairline/60 pt-2 t-meta">
          <button v-if="!address.isDefault" type="button" class="text-primary hover:underline" @click="makeDefault(address)">
            Đặt mặc định
          </button>
          <button type="button" class="text-discount hover:underline" @click="remove(address)">Xoá</button>
        </div>
      </article>
    </div>

    <p v-else class="mt-4 rounded-xl2 border border-dashed border-hairline bg-white/50 p-6 text-center t-body text-muted">
      Chưa có địa chỉ nào. Thêm địa chỉ để giao hàng nhanh hơn.
    </p>
  </div>
</template>
