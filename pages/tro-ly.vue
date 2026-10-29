<script setup lang="ts">
import type { ProductCard as ProductCardType } from '~/types'

definePageMeta({ title: 'Trợ lý tư vấn' })

type Message = {
  role: 'user' | 'assistant'
  content: string
  products?: ProductCardType[]
}

const messages = ref<Message[]>([
  {
    role: 'assistant',
    content:
      'Chào bạn, mình là trợ lý mua sắm FloraHub. Bạn cần hoa hay quà cho dịp gì? Cho mình biết dịp, ngân sách và màu bạn thích là mình gợi ý nhanh hơn.'
  }
])
const input = ref('')
const busy = ref(false)
const errorMessage = ref('')
const scroller = ref<HTMLElement | null>(null)

const suggestions = ['Hoa sinh nhật dưới 500k', 'Quà tặng 8/3', 'Hoa khai trương', 'Bó hồng pastel']

function scrollDown() {
  nextTick(() => {
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
  })
}

async function send(text?: string) {
  const message = (text ?? input.value).trim()
  if (!message || busy.value) return

  input.value = ''
  errorMessage.value = ''
  messages.value.push({ role: 'user', content: message })
  busy.value = true
  scrollDown()

  const history = messages.value
    .slice(0, -1)
    .slice(-8)
    .map((item) => ({ role: item.role, content: item.content }))

  try {
    const data = await $fetch<{
      reply: string
      products: ProductCardType[]
    }>('/api/assistant/chat', {
      method: 'POST',
      body: { message, history }
    })

    messages.value.push({
      role: 'assistant',
      content: data.reply,
      products: data.products
    })
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không kết nối được trợ lý. Thử lại giúp mình nhé.'
  } finally {
    busy.value = false
    scrollDown()
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-9rem)] flex-col">
    <section class="container-page pt-4">
      <h1 class="t-page">Trợ lý tư vấn</h1>
      <p class="mt-1 t-meta leading-relaxed text-muted">
        Hỏi về dịp, ngân sách, màu hoa hay cách chọn quà — trợ lý tư vấn trước, chỉ gợi ý sản phẩm khi thật sự phù hợp.
      </p>
      <div class="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        <button
          v-for="item in suggestions"
          :key="item"
          type="button"
          class="shrink-0 rounded-full border border-hairline bg-white/80 px-3 py-1.5 t-meta font-medium text-ink hover:border-primary hover:text-primary"
          :disabled="busy"
          @click="send(item)"
        >
          {{ item }}
        </button>
      </div>
    </section>

    <section ref="scroller" class="container-page mt-3 flex-1 space-y-4 pb-3">
      <div v-for="(message, index) in messages" :key="index" class="space-y-3">
        <div class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
          <p
            class="max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 t-body leading-relaxed"
            :class="message.role === 'user' ? 'bg-primary text-white' : 'border border-hairline bg-white/90 text-ink'"
          >
            {{ message.content }}
          </p>
        </div>

        <template v-if="message.products?.length">
          <p class="t-micro font-semibold uppercase tracking-wide text-muted">Sản phẩm phù hợp</p>
          <div class="space-y-2">
            <ProductCard v-for="product in message.products" :key="product.id" :product="product" layout="row" compact />
          </div>
        </template>
      </div>

      <p v-if="busy" class="t-meta text-muted">Đang tìm sản phẩm…</p>
      <p v-if="errorMessage" class="t-meta font-medium text-discount">{{ errorMessage }}</p>
    </section>

    <div class="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-hairline bg-paper/95 pb-2 pt-2 backdrop-blur">
      <form class="container-page flex items-end gap-2" @submit.prevent="send()">
        <label class="sr-only" for="assistant-input">Câu hỏi cho trợ lý</label>
        <textarea
          id="assistant-input"
          v-model="input"
          rows="1"
          maxlength="500"
          placeholder="Ví dụ: hoa sinh nhật cho mẹ, ngân sách 400k…"
          class="field max-h-24 min-h-10 flex-1 resize-none py-2.5 t-body"
          @keydown.enter.exact.prevent="send()"
        />
        <button
          type="submit"
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white disabled:opacity-50"
          :disabled="busy || !input.trim()"
          aria-label="Gửi câu hỏi"
        >
          <AppIcon name="chevron" size="h-5 w-5" />
        </button>
      </form>
    </div>
  </div>
</template>
