<script setup lang="ts">
import { buildThemeDeclarations } from '~/utils/theme'

const { config } = useSite()

const themeDeclarations = computed(() => buildThemeDeclarations(config.value))

function titleTemplate(title?: string) {
  if (!title) return config.value.brand.name
  const template = config.value.seo.titleTemplate?.trim()
  if (template) {
    return template.replace('%s', title).replace('%store%', config.value.brand.name)
  }
  return `${title} — ${config.value.brand.name}`
}

useHead(() => ({
  titleTemplate,
  htmlAttrs: { lang: 'vi', style: themeDeclarations.value },
  meta: [
    { name: 'description', content: config.value.seo.description || config.value.brand.description || config.value.brand.tagline || '' },
    ...(config.value.seo.keywords ? [{ name: 'keywords', content: config.value.seo.keywords }] : []),
    ...(config.value.colors.primary ? [{ name: 'theme-color', content: config.value.colors.primary }] : []),
    ...(config.value.seo.ogImage
      ? [
          { property: 'og:image', content: config.value.seo.ogImage },
          { property: 'og:title', content: config.value.brand.name },
          { property: 'og:description', content: config.value.seo.description || config.value.brand.tagline }
        ]
      : [])
  ],
  link: config.value.brand.faviconUrl ? [{ rel: 'icon', href: config.value.brand.faviconUrl }] : []
}))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
