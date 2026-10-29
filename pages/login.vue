<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const route = useRoute()
const { user, login } = useAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const pending = ref(false)
const errorMessage = ref('')

const redirect = computed(() => {
  const value = route.query.redirect
  return typeof value === 'string' && value.startsWith('/') ? value : '/account'
})

if (user.value) await navigateTo(redirect.value)

async function submit() {
  errorMessage.value = ''
  pending.value = true
  try {
    await login(email.value, password.value)
    await navigateTo(redirect.value)
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Không thể đăng nhập. Vui lòng thử lại.')
  } finally {
    pending.value = false
  }
}

useHead({ title: 'Đăng nhập' })
</script>

<template>
  <div class="w-full max-w-md">
    <div class="card p-5">
      <p class="t-meta font-semibold uppercase tracking-[0.18em] text-primary">Tài khoản</p>
      <h1 class="mt-2 t-page font-semibold">Đăng nhập</h1>
      <p class="mt-1 t-body text-muted">Theo dõi đơn hàng, địa chỉ giao hàng và ví thanh toán của bạn.</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="mb-1.5 block t-body font-medium">Email</span>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="field"
            placeholder="ban@cuahang.vn"
          />
        </label>

        <label class="block">
          <span class="mb-1.5 block t-body font-medium">Mật khẩu</span>
          <span class="relative block">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              autocomplete="current-password"
              class="field pr-16"
              placeholder="Tối thiểu 8 ký tự"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-3 t-meta font-medium text-muted hover:text-primary"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Ẩn' : 'Hiện' }}
            </button>
          </span>
        </label>

        <p v-if="errorMessage" class="rounded-xl bg-discount/10 px-3 py-2 t-body text-discount" role="alert">
          {{ errorMessage }}
        </p>

        <button type="submit" class="btn-primary w-full py-3" :disabled="pending">
          {{ pending ? 'Đang đăng nhập...' : 'Đăng nhập' }}
        </button>
      </form>

      <div class="mt-4 flex items-center justify-between t-body">
        <NuxtLink to="/forgot-password" class="font-medium text-primary hover:underline">Quên mật khẩu?</NuxtLink>
        <NuxtLink :to="{ path: '/register', query: route.query }" class="font-medium text-primary hover:underline">
          Tạo tài khoản
        </NuxtLink>
      </div>
    </div>

  </div>
</template>
