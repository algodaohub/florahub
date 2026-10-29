<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const email = ref('')
const pending = ref(false)
const message = ref('')
const errorMessage = ref('')

async function submit() {
  message.value = ''
  errorMessage.value = ''
  pending.value = true
  try {
    const response = await $fetch<{ message: string }>('/api/auth/forgot', {
      method: 'POST',
      body: { email: email.value }
    })
    message.value = response.message
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Không thể gửi yêu cầu. Vui lòng thử lại.')
  } finally {
    pending.value = false
  }
}

useHead({ title: 'Quên mật khẩu' })
</script>

<template>
  <div class="w-full max-w-md">
    <div class="card p-5">
      <p class="t-meta font-semibold uppercase tracking-[0.18em] text-primary">Khôi phục tài khoản</p>
      <h1 class="mt-2 t-page font-semibold">Quên mật khẩu?</h1>
      <p class="mt-1 t-body text-muted">Nhập email đã đăng ký, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="mb-1.5 block t-body font-medium">Email</span>
          <input v-model="email" type="email" required autocomplete="email" class="field" placeholder="ban@cuahang.vn" />
        </label>

        <p v-if="message" class="rounded-xl bg-primary-soft px-3 py-2 t-body text-primary" role="status">{{ message }}</p>
        <p v-if="errorMessage" class="rounded-xl bg-discount/10 px-3 py-2 t-body text-discount" role="alert">{{ errorMessage }}</p>

        <button type="submit" class="btn-primary w-full py-3" :disabled="pending">
          {{ pending ? 'Đang gửi...' : 'Gửi hướng dẫn' }}
        </button>
      </form>

      <NuxtLink to="/login" class="mt-4 block text-center t-body font-medium text-primary hover:underline">
        Quay lại đăng nhập
      </NuxtLink>
    </div>
  </div>
</template>
