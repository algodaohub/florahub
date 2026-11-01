<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Cấu hình' })

const route = useRoute()

const TABS = [
  { key: 'storefront', label: 'Cửa hàng' },
  { key: 'shipping', label: 'Vận chuyển' },
  { key: 'payments', label: 'Thanh toán' },
  { key: 'ai', label: 'Mô hình AI' },
  { key: 'assistant', label: 'Tài liệu trợ lý' }
] as const

type TabKey = (typeof TABS)[number]['key']

const active = computed<TabKey>(() => {
  const q = String(route.query.tab ?? '')
  return (TABS.find((tab) => tab.key === q)?.key ?? 'storefront') as TabKey
})

function select(key: TabKey) {
  if (key === active.value) return
  navigateTo({ path: '/admin/settings', query: { tab: key } })
}
</script>

<template>
  <div class="w-full space-y-4">
    <div class="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="rounded-lg px-3.5 py-2 text-sm font-medium transition"
        :class="
          active === tab.key
            ? 'bg-emerald-700 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        "
        @click="select(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <AdminStorefrontEditor v-if="active === 'storefront'" />
    <AdminShippingSettingsPanel v-else-if="active === 'shipping'" />
    <AdminPaymentSettingsPanel v-else-if="active === 'payments'" />
    <AdminAiSettingsPanel v-else-if="active === 'ai'" />
    <AdminAssistantDocsPanel v-else-if="active === 'assistant'" />
  </div>
</template>
