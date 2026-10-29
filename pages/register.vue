<script setup lang="ts">
definePageMeta({ layout: 'blank' })

const route = useRoute()
const { user, register } = useAuth()

const firstName = ref('')
const lastName = ref('')
const phone = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const accepted = ref(true)
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
  if (!accepted.value) {
    errorMessage.value = 'Vui lòng đồng ý với điều khoản sử dụng.'
    return
  }
  pending.value = true
  try {
    await register({
      firstName: firstName.value,
      lastName: lastName.value,
      phone: phone.value,
      email: email.value,
      password: password.value,
      confirmPassword: confirmPassword.value
    })
    await navigateTo(redirect.value)
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Không thể tạo tài khoản. Vui lòng thử lại.')
  } finally {
    pending.value = false
  }
}

useHead({ title: 'Đăng ký' })
</script>

<template>
  <div class="w-full max-w-lg">
    <div class="card p-5">
      <p class="t-meta font-semibold uppercase tracking-[0.18em] text-primary">Thành viên mới</p>
      <h1 class="mt-2 t-page font-semibold">Tạo tài khoản</h1>
      <p class="mt-1 t-body text-muted">Lưu địa chỉ giao hàng, nhận thông báo đơn hàng và nạp ví nhanh hơn.</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1.5 block t-body font-medium">Họ</span>
            <input v-model="lastName" type="text" required autocomplete="family-name" class="field" placeholder="Nguyễn" />
          </label>
          <label class="block">
            <span class="mb-1.5 block t-body font-medium">Tên</span>
            <input v-model="firstName" type="text" required autocomplete="given-name" class="field" placeholder="Lan" />
          </label>
        </div>

        <label class="block">
          <span class="mb-1.5 block t-body font-medium">Số điện thoại</span>
          <input
            v-model="phone"
            type="tel"
            required
            inputmode="numeric"
            autocomplete="tel"
            class="field"
            placeholder="0901 234 567"
          />
        </label>

        <label class="block">
          <span class="mb-1.5 block t-body font-medium">Email</span>
          <input v-model="email" type="email" required autocomplete="email" class="field" placeholder="ban@cuahang.vn" />
        </label>

        <label class="block">
          <span class="mb-1.5 block t-body font-medium">Mật khẩu</span>
          <span class="relative block">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              minlength="8"
              autocomplete="new-password"
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

        <label class="block">
          <span class="mb-1.5 block t-body font-medium">Nhập lại mật khẩu</span>
          <input
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            required
            minlength="8"
            autocomplete="new-password"
            class="field"
            placeholder="Nhập lại mật khẩu"
          />
        </label>

        <label class="flex items-start gap-2 t-meta text-muted">
          <input v-model="accepted" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-hairline text-primary" />
          <span>Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật.</span>
        </label>

        <p v-if="errorMessage" class="rounded-xl bg-discount/10 px-3 py-2 t-body text-discount" role="alert">
          {{ errorMessage }}
        </p>

        <button type="submit" class="btn-primary w-full py-3" :disabled="pending">
          {{ pending ? 'Đang tạo tài khoản...' : 'Đăng ký' }}
        </button>
      </form>

      <p class="mt-4 text-center t-body text-muted">
        Đã có tài khoản?
        <NuxtLink :to="{ path: '/login', query: route.query }" class="font-medium text-primary hover:underline">Đăng nhập</NuxtLink>
      </p>
    </div>
  </div>
</template>
