<script setup lang="ts">
const { user, updateProfile } = useAuth()

const firstName = ref(user.value?.firstName ?? '')
const lastName = ref(user.value?.lastName ?? '')
const phone = ref(user.value?.phone ?? '')
const pending = ref(false)
const message = ref('')
const errorMessage = ref('')

async function submit() {
  message.value = ''
  errorMessage.value = ''
  pending.value = true
  try {
    await updateProfile({
      firstName: firstName.value,
      lastName: lastName.value,
      phone: phone.value
    })
    message.value = 'Đã lưu thông tin cá nhân.'
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Không thể lưu thông tin. Vui lòng thử lại.')
  } finally {
    pending.value = false
  }
}

useHead({ title: 'Hồ sơ' })
</script>

<template>
  <div class="container-page py-4">
    <AccountHeader title="Hồ sơ" back-to="/account" />

    <section class="mt-3 card p-4">
      <h1 class="t-page font-semibold">Hồ sơ cá nhân</h1>
      <p class="mt-1 t-body text-muted">Thông tin này dùng để liên hệ và giao hàng.</p>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1.5 block t-body font-medium">Họ</span>
            <input v-model="lastName" type="text" required autocomplete="family-name" class="field" />
          </label>
          <label class="block">
            <span class="mb-1.5 block t-body font-medium">Tên</span>
            <input v-model="firstName" type="text" required autocomplete="given-name" class="field" />
          </label>
        </div>

        <label class="block">
          <span class="mb-1.5 block t-body font-medium">Số điện thoại</span>
          <input v-model="phone" type="tel" inputmode="numeric" autocomplete="tel" class="field" placeholder="0901 234 567" />
        </label>

        <label class="block">
          <span class="mb-1.5 block t-body font-medium">Email</span>
          <input :value="user?.email" type="email" class="field bg-paper-deep/40" readonly />
          <span class="mt-1 block t-micro text-muted">Email dùng để đăng nhập và không thể thay đổi tại đây.</span>
        </label>

        <p v-if="message" class="rounded-xl bg-primary-soft px-3 py-2 t-body text-primary" role="status">{{ message }}</p>
        <p v-if="errorMessage" class="rounded-xl bg-discount/10 px-3 py-2 t-body text-discount" role="alert">{{ errorMessage }}</p>

        <button type="submit" class="btn-primary w-full py-3" :disabled="pending">
          {{ pending ? 'Đang lưu...' : 'Lưu thay đổi' }}
        </button>
      </form>
    </section>
  </div>
</template>
