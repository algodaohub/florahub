<script setup lang="ts">
const { site } = useSite()

useHead({ title: 'Về chúng tôi' })
</script>

<template>
  <div class="container-page py-4">
    <AccountHeader title="Về chúng tôi" back-to="/account" />

    <section class="mt-3 space-y-3">
      <div class="card p-5">
        <h1 class="t-page font-semibold">{{ site.siteName }}</h1>
        <p class="mt-1 t-body text-muted">{{ site.tagline }}</p>
        <p class="mt-3 t-body leading-relaxed text-ink/80">{{ site.description }}</p>
      </div>

      <div class="rounded-xl2 border border-hairline/70 bg-white/60 p-5">
        <h2 class="t-section font-semibold">Liên hệ</h2>
        <dl class="mt-3 space-y-2 t-body">
          <div v-if="site.hotline" class="flex justify-between gap-4">
            <dt class="text-muted">Hotline</dt>
            <dd class="text-right font-medium">{{ site.hotline }}</dd>
          </div>
          <div v-if="site.email" class="flex justify-between gap-4">
            <dt class="text-muted">Email</dt>
            <dd class="truncate text-right font-medium">{{ site.email }}</dd>
          </div>
          <div v-if="site.address" class="flex justify-between gap-4">
            <dt class="text-muted">Địa chỉ</dt>
            <dd class="text-right font-medium">{{ site.address }}</dd>
          </div>
        </dl>
      </div>
    </section>
  </div>
</template>
