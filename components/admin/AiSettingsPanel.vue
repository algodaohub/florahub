<script setup lang="ts">
type AiConfig = {
  provider: '9router' | 'openai' | 'anthropic' | 'custom'
  baseUrl: string
  model: string
  models: string[]
  availableModels: string[]
  hasKey: boolean
  keyHint: string
}

const presets = {
  '9router': { baseUrl: 'http://127.0.0.1:20128/v1', model: 'oc/deepseek-v4.1-flash-free' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-4-5' },
  custom: { baseUrl: '', model: '' }
}

const form = reactive({
  provider: '9router' as AiConfig['provider'],
  baseUrl: presets['9router'].baseUrl,
  model: presets['9router'].model,
  modelsText: '',
  apiKey: ''
})
const meta = reactive({ hasKey: false, keyHint: '' })
const availableModels = ref<string[]>([])
const loading = ref(true)
const busy = ref(false)
const message = ref('')
const errorMessage = ref('')

function apply(data: AiConfig) {
  form.provider = data.provider
  form.baseUrl = data.baseUrl
  form.model = data.model
  form.modelsText = data.models.join('\n')
  meta.hasKey = data.hasKey
  meta.keyHint = data.keyHint
  availableModels.value = data.availableModels
}

async function load(fetchModels = false) {
  try {
    const data = await $fetch<AiConfig>(`/api/admin/ai${fetchModels ? '?models=1' : ''}`)
    apply(data)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không tải được cấu hình AI.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

function usePreset(provider: AiConfig['provider'] = form.provider) {
  form.provider = provider
  form.baseUrl = presets[provider].baseUrl
  if (!availableModels.value.includes(form.model)) form.model = presets[provider].model
}

async function refreshModels() {
  busy.value = true
  errorMessage.value = ''
  try {
    const data = await $fetch<AiConfig>('/api/admin/ai?models=1')
    apply(data)
    form.modelsText = data.availableModels.join('\n')
    message.value = `Đã tải ${data.availableModels.length} model khả dụng.`
    setTimeout(() => { message.value = '' }, 3000)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không lấy được danh sách model.'
  } finally {
    busy.value = false
  }
}

async function save() {
  if (busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const data = await $fetch<AiConfig>('/api/admin/ai', {
      method: 'PUT',
      body: {
        provider: form.provider,
        baseUrl: form.baseUrl,
        model: form.model,
        models: form.modelsText.split('\n').map((item) => item.trim()).filter(Boolean),
        apiKey: form.apiKey.trim() || undefined
      }
    })
    apply(data)
    form.apiKey = ''
    message.value = 'Đã lưu cấu hình AI. Model này được dùng ngay khi gen nội dung.'
    setTimeout(() => { message.value = '' }, 3500)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không lưu được cấu hình AI.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-4">
    <div>
      <h2 class="text-lg font-semibold">Mô hình AI cho nội dung sản phẩm</h2>
      <p class="mt-1 text-sm text-slate-500">
        Chọn nhà cung cấp, model mặc định và danh sách model khách được chọn khi bấm “Gen bằng AI”.
        Máy cài đặt mới mặc định dùng 9router local.
      </p>
    </div>

    <div v-if="loading" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
      Đang tải…
    </div>

    <template v-else>
      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Nhà cung cấp</h3>
          <button
            type="button"
            class="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            @click="usePreset('9router')"
          >
            Dùng 9router local
          </button>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Provider</span>
            <select
              v-model="form.provider"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              @change="usePreset()"
            >
              <option value="9router">9router (local, mặc định)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="custom">OpenAI-compatible khác</option>
            </select>
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Base URL</span>
            <input
              v-model="form.baseUrl"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
              placeholder="http://127.0.0.1:20128/v1"
            />
          </label>

          <label class="block sm:col-span-2">
            <span class="mb-1 block text-xs font-medium text-slate-600">Model mặc định</span>
            <input
              v-model="form.model"
              list="ai-model-options"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
              placeholder="oc/deepseek-v4.1-flash-free"
            />
            <datalist id="ai-model-options">
              <option v-for="model in availableModels" :key="model" :value="model" />
            </datalist>
          </label>

          <label class="block sm:col-span-2">
            <span class="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Model khách được chọn (mỗi dòng một model)</span>
              <button
                type="button"
                class="font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                :disabled="busy"
                @click="refreshModels"
              >
                Lấy danh sách từ provider
              </button>
            </span>
            <textarea
              v-model="form.modelsText"
              rows="5"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
              placeholder="oc/deepseek-v4.1-flash-free"
            />
          </label>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 class="text-sm font-semibold">API key</h3>
        <p class="mt-1 text-xs text-slate-500">
          Key chỉ lưu phía server, không trả lại trình duyệt.
          <template v-if="meta.hasKey">Đang dùng key {{ meta.keyHint }} — để trống nếu không đổi.</template>
          <template v-else>Chưa có key.</template>
        </p>
        <input
          v-model="form.apiKey"
          type="password"
          autocomplete="new-password"
          class="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
          :placeholder="meta.hasKey ? 'Để trống để giữ key cũ' : 'Dán API key vào đây'"
        />
        <p class="mt-2 text-xs text-slate-500">
          9router: chạy <code class="rounded bg-slate-100 px-1">npm install -g 9router</code>, mở
          <a href="http://127.0.0.1:20128" target="_blank" rel="noopener" class="font-medium text-emerald-700 hover:underline">localhost:20128</a>
          để lấy key.
        </p>
      </section>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          :disabled="busy"
          @click="save"
        >
          {{ busy ? 'Đang lưu…' : 'Lưu cấu hình' }}
        </button>
        <p v-if="message" class="text-xs font-medium text-emerald-700">{{ message }}</p>
        <p v-if="errorMessage" class="text-xs font-medium text-rose-700">{{ errorMessage }}</p>
      </div>
    </template>
  </div>
</template>
