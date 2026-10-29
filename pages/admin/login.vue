<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { user, ready, refresh, login } = useAdmin()

const email = ref('')
const password = ref('')
const busy = ref(false)
const errorMessage = ref('')

const redirectTo = computed(() => {
  const target = String(route.query.redirect ?? '')
  return target.startsWith('/admin') ? target : '/admin/orders'
})

onMounted(async () => {
  if (!ready.value) await refresh()
  if (user.value) await navigateTo(redirectTo.value)
})

async function submit() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    await login(email.value.trim(), password.value)
    await navigateTo(redirectTo.value)
  } catch (error: any) {
    errorMessage.value =
      error?.data?.statusMessage || error?.statusMessage || 'Không đăng nhập được. Kiểm tra lại kết nối.'
    password.value = ''
  } finally {
    busy.value = false
  }
}

useHead({ title: 'Đăng nhập quản trị' })
</script>

<template>
  <div
    class="grid min-h-dvh w-full place-items-center bg-slate-100 px-4 py-10 text-slate-900"
    style="--font-body: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-family: var(--font-body)"
  >
    <div class="w-full max-w-sm">
      <div class="mb-6 flex items-center gap-2">
        <span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-base font-bold text-white">F</span>
        <div>
          <p class="text-sm font-semibold leading-tight">FloraHub</p>
          <p class="text-xs text-slate-500">Bảng quản trị</p>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 class="text-lg font-semibold">Đăng nhập</h1>
        <p class="mt-1 text-sm text-slate-500">Dùng tài khoản quản trị hoặc nhân viên.</p>

        <form class="mt-5 space-y-3" @submit.prevent="submit">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Email</span>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="username"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              placeholder="ban@florahub.vn"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Mật khẩu</span>
            <input
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              placeholder="••••••••"
            />
          </label>

          <p v-if="errorMessage" class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{{ errorMessage }}</p>

          <button
            type="submit"
            class="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
            :disabled="busy"
          >
            {{ busy ? 'Đang đăng nhập…' : 'Đăng nhập' }}
          </button>
        </form>
      </div>

      <p class="mt-4 text-center text-xs text-slate-500">
        <NuxtLink to="/" class="underline decoration-dotted hover:text-slate-700">← Về cửa hàng</NuxtLink>
      </p>
    </div>
  </div>
</template>
