<script setup lang="ts">
import type { AccountNotification } from '~/types'

const { data, refresh } = await useFetch<{ notifications: AccountNotification[]; unread: number }>(
  '/api/account/notifications',
  { key: 'account-notifications' }
)

const marking = ref(false)

async function markRead(item: AccountNotification) {
  if (item.read) return
  await $fetch(`/api/account/notifications/${item.id}`, { method: 'PATCH' })
  await refresh()
}

async function markAll() {
  marking.value = true
  try {
    await $fetch('/api/account/notifications/read-all', { method: 'POST' })
    await refresh()
  } finally {
    marking.value = false
  }
}

useHead({ title: 'Thông báo' })
</script>

<template>
  <div class="container-page py-4">
    <AccountHeader title="Thông báo" back-to="/account" />

    <div class="mt-3 flex items-end justify-between gap-3">
      <div>
        <h1 class="t-page font-semibold">Thông báo</h1>
        <p class="mt-0.5 t-meta text-muted">{{ data?.unread ?? 0 }} thông báo chưa đọc</p>
      </div>
      <button
        type="button"
        class="t-meta font-semibold text-primary hover:underline disabled:opacity-40"
        :disabled="marking || !data?.unread"
        @click="markAll"
      >
        Đọc tất cả
      </button>
    </div>

    <div v-if="data?.notifications.length" class="mt-3 space-y-2">
      <button
        v-for="item in data.notifications"
        :key="item.id"
        type="button"
        class="flex w-full gap-3 rounded-xl2 border p-4 text-left transition"
        :class="item.read ? 'border-hairline/60 bg-white/50' : 'border-primary/20 bg-primary-soft/40'"
        @click="markRead(item)"
      >
        <span class="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-primary shadow-soft">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" stroke-linejoin="round" />
            <path d="M10 21h4" stroke-linecap="round" />
          </svg>
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-start gap-2">
            <span class="t-body font-semibold" :class="item.read ? 'text-ink/70' : 'text-ink'">{{ item.title }}</span>
            <span v-if="!item.read" class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-discount" />
          </span>
          <span class="mt-1 block t-meta leading-relaxed text-muted">{{ item.body }}</span>
          <span class="mt-2 block t-micro uppercase tracking-wide text-muted/70">{{ formatDate(item.createdAt) }}</span>
        </span>
      </button>
    </div>

    <p v-else class="mt-4 rounded-xl2 border border-dashed border-hairline bg-white/50 p-6 text-center t-body text-muted">
      Bạn chưa có thông báo nào.
    </p>
  </div>
</template>
