<script setup lang="ts">
type Doc = {
  id: string
  title: string
  content: string
  tags: string
  isActive: boolean
  forTraining: boolean
  sortOrder: number
  updatedAt: string
}

const CONTENT_MAX = 20000

const { data, pending, refresh } = await useAsyncData<{ items: Doc[] }>('admin-assistant-docs', () =>
  useRequestFetch()<{ items: Doc[] }>('/api/admin/assistant-docs')
)

type Brief = { content: string; model: string; updatedAt: string } | null
type TrainingState = { total: number; brief: Brief }

const { data: training, refresh: refreshTraining } = await useAsyncData<TrainingState>('admin-training-examples', () =>
  useRequestFetch()<TrainingState>('/api/admin/training-examples')
)

const form = reactive({ id: '', title: '', content: '', tags: '', isActive: true, forTraining: false, sortOrder: 0 })
const busy = ref(false)
const briefBusy = ref(false)
const trainBusy = ref(false)
const message = ref('')
const errorMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const trainingDocCount = computed(() => (data.value?.items ?? []).filter((doc) => doc.forTraining).length)

async function runTrainingAction(label: string, fn: () => Promise<unknown>, successText: (result: any) => string) {
  if (briefBusy.value || trainBusy.value) return
  const flag = label === 'brief' ? briefBusy : trainBusy
  flag.value = true
  errorMessage.value = ''
  try {
    const result: any = await fn()
    await Promise.all([refresh(), refreshTraining()])
    message.value = successText(result)
    setTimeout(() => { if (message.value) message.value = '' }, 5000)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không thực hiện được. Kiểm tra cấu hình AI (tab AI).'
  } finally {
    flag.value = false
  }
}

function generateBrief() {
  return runTrainingAction(
    'brief',
    () => $fetch('/api/admin/assistant-docs/brief', { method: 'POST' }),
    () => 'Đã chưng cất chỉ dẫn huấn luyện. Trợ lý sẽ dùng chỉ dẫn này ở câu trả lời tiếp theo.'
  )
}

function generateQa() {
  return runTrainingAction(
    'train',
    () => $fetch<{ created: number; batch: string }>('/api/admin/assistant-docs/train', { method: 'POST' }),
    (result) => `Đã sinh ${result.created} cặp Q/A (đợt ${result.batch}). Tải file JSONL để fine-tune.`
  )
}

async function clearQa() {
  if (!confirm('Xoá toàn bộ bộ câu hỏi mẫu đã sinh?')) return
  return runTrainingAction('train', () => $fetch('/api/admin/training-examples', { method: 'DELETE' }), () => 'Đã xoá bộ Q/A.')
}

function reset() {
  form.id = ''
  form.title = ''
  form.content = ''
  form.tags = ''
  form.isActive = true
  form.forTraining = false
  form.sortOrder = 0
}

function edit(doc: Doc) {
  form.id = doc.id
  form.title = doc.title
  form.content = doc.content
  form.tags = doc.tags
  form.isActive = doc.isActive
  form.forTraining = doc.forTraining
  form.sortOrder = doc.sortOrder
  message.value = ''
  errorMessage.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  errorMessage.value = ''

  if (files.length > 1) {
    busy.value = true
    let ok = 0
    const failed: string[] = []
    try {
      for (const file of files) {
        try {
          const text = await file.text()
          if (!text.trim()) { failed.push(file.name); continue }
          await $fetch('/api/admin/assistant-docs', {
            method: 'POST',
            body: {
              title: file.name.replace(/\.[^.]+$/, '').slice(0, 200),
              content: text.slice(0, CONTENT_MAX),
              forTraining: true
            }
          })
          ok += 1
        } catch {
          failed.push(file.name)
        }
      }
      await refresh()
      message.value = `Đã nhập ${ok}/${files.length} tài liệu vào kho (gắn cờ Training AI).${failed.length ? ` Lỗi: ${failed.join(', ')}` : ''}`
      setTimeout(() => { message.value = '' }, 6000)
    } finally {
      busy.value = false
    }
    return
  }

  const file = files[0]
  try {
    const text = await file.text()
    if (!text.trim()) {
      errorMessage.value = `File "${file.name}" rỗng hoặc không phải văn bản.`
      return
    }
    if (form.id) reset()
    form.title = file.name.replace(/\.[^.]+$/, '').slice(0, 200)
    form.content = text.length > CONTENT_MAX ? text.slice(0, CONTENT_MAX) : text
    form.forTraining = true
    if (text.length > CONTENT_MAX) {
      message.value = `File dài ${text.length.toLocaleString('vi')} ký tự, đã cắt còn ${CONTENT_MAX.toLocaleString('vi')}.`
    }
  } catch {
    errorMessage.value = 'Không đọc được file.'
  }
}

/* ---- Obsidian-style: markdown preview, wiki-links, tags ---- */

const previewMode = ref(false)
const previewHtml = ref('')
const filterTag = ref('')

function wikiTargets(content: string) {
  return [...content.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)].map((m) => m[1].trim())
}

const INLINE_TAG_RE = /(?<![\w#\[(])#([\p{L}][\p{L}\p{N}_-]*)/gu

function inlineTags(content: string) {
  return [...content.matchAll(INLINE_TAG_RE)].map((m) => m[1])
}

function preprocessWiki(text: string) {
  let out = text.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_m, title, alias) => `[${(alias || title).trim()}](#wiki-${encodeURIComponent(String(title).trim())})`
  )
  out = out.replace(INLINE_TAG_RE, '[#$1](#tag-$1)')
  return out
}

async function renderMarkdown(text: string) {
  if (!text) return ''
  const { marked } = await import('marked')
  const { default: DOMPurify } = await import('dompurify')
  const html = marked.parse(preprocessWiki(text), { async: false }) as string
  return DOMPurify.sanitize(html)
}

watch([previewMode, () => form.content], async () => {
  if (previewMode.value) previewHtml.value = await renderMarkdown(form.content)
})

const docsList = computed(() => data.value?.items ?? [])

const filteredDocs = computed(() => {
  if (!filterTag.value) return docsList.value
  const needle = filterTag.value.toLowerCase()
  return docsList.value.filter(
    (doc) =>
      doc.tags.toLowerCase().includes(needle) ||
      inlineTags(doc.content).some((tag) => tag.toLowerCase() === needle)
  )
})

const allTags = computed(() => {
  const set = new Set<string>()
  for (const doc of docsList.value) {
    for (const tag of doc.tags.split(',').map((item) => item.trim()).filter(Boolean)) set.add(tag)
    for (const tag of inlineTags(doc.content)) set.add(tag)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'))
})

function backlinksFor(doc: Doc) {
  return docsList.value.filter(
    (other) => other.id !== doc.id && wikiTargets(other.content).some((t) => t.toLowerCase() === doc.title.toLowerCase())
  )
}

const editorBacklinks = computed(() => {
  const current = docsList.value.find((doc) => doc.id === form.id)
  return current ? backlinksFor(current) : []
})

const editorOutgoing = computed(() => [...new Set(wikiTargets(form.content))])

/* Bộ chọn tài liệu để chèn liên kết [[…]] */
const contentEl = ref<HTMLTextAreaElement | null>(null)
const linkSearch = ref('')
const showLinkPicker = ref(false)

const linkCandidates = computed(() => {
  const q = linkSearch.value.trim().toLowerCase()
  const others = docsList.value.filter((doc) => doc.id !== form.id)
  const matched = q ? others.filter((doc) => doc.title.toLowerCase().includes(q)) : others
  return matched.slice(0, 8)
})

async function insertLink(title: string) {
  const snippet = `[[${title.trim()}]]`
  previewMode.value = false
  await nextTick()
  const ta = contentEl.value
  if (ta) {
    const start = ta.selectionStart ?? form.content.length
    const end = ta.selectionEnd ?? form.content.length
    const before = form.content.slice(0, start)
    const after = form.content.slice(end)
    const lead = before && !/\s$/.test(before) ? ' ' : ''
    const tail = after && !/^\s/.test(after) ? ' ' : ''
    form.content = before + lead + snippet + tail + after
    ta.focus()
    const caret = start + lead.length + snippet.length + tail.length
    ta.setSelectionRange(caret, caret)
  } else {
    form.content += (form.content && !/\s$/.test(form.content) ? ' ' : '') + snippet
  }
  linkSearch.value = ''
  showLinkPicker.value = false
}

function closeLinkPicker() {
  setTimeout(() => { showLinkPicker.value = false }, 150)
}

function openDocByTitle(title: string) {
  const target = docsList.value.find((doc) => doc.title.toLowerCase() === title.toLowerCase())
  if (target) {
    edit(target)
    return
  }
  reset()
  form.title = title.slice(0, 200)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function onPreviewClick(event: MouseEvent) {
  const link = (event.target as HTMLElement | null)?.closest('a')
  const href = link?.getAttribute('href') ?? ''
  if (href.startsWith('#wiki-')) {
    event.preventDefault()
    openDocByTitle(decodeURIComponent(href.slice(6)))
  } else if (href.startsWith('#tag-')) {
    event.preventDefault()
    filterTag.value = decodeURIComponent(href.slice(5))
  } else if (href.startsWith('#')) {
    event.preventDefault()
  }
}

async function save() {
  if (busy.value) return
  if (!form.title.trim() || !form.content.trim()) {
    errorMessage.value = 'Nhập tiêu đề và nội dung tài liệu.'
    return
  }

  busy.value = true
  errorMessage.value = ''
  try {
    const body = {
      title: form.title.trim(),
      content: form.content.trim(),
      tags: form.tags.trim(),
      isActive: form.isActive,
      forTraining: form.forTraining,
      sortOrder: form.sortOrder
    }
    if (form.id) {
      await $fetch(`/api/admin/assistant-docs/${form.id}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/admin/assistant-docs', { method: 'POST', body })
    }
    reset()
    await refresh()
    message.value = 'Đã lưu tài liệu. Trợ lý dùng ngay ở câu hỏi tiếp theo.'
    setTimeout(() => { message.value = '' }, 3500)
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không lưu được tài liệu.'
  } finally {
    busy.value = false
  }
}

async function remove(doc: Doc) {
  if (!confirm(`Xoá tài liệu "${doc.title}"?`)) return
  busy.value = true
  try {
    await $fetch(`/api/admin/assistant-docs/${doc.id}`, { method: 'DELETE' })
    if (form.id === doc.id) reset()
    await refresh()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Không xoá được tài liệu.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_520px]">
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold">Tài liệu tư vấn cho trợ lý</h2>
        <p class="mt-1 text-sm text-slate-500">
          Trợ lý chọn tài liệu liên quan theo từ khoá và ghép vào câu trả lời. Có thể upload file .md/.txt để nhập
          nhanh và đánh dấu làm dữ liệu huấn luyện AI.
        </p>
      </div>

      <section class="rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-slate-800">Huấn luyện AI</h3>
            <p class="mt-0.5 text-[11px] leading-snug text-slate-500">
              {{ trainingDocCount }} tài liệu đang được đánh dấu Training AI.
              Chỉ dẫn: {{ training?.brief ? `tạo bởi ${training.brief.model || 'AI'} lúc ${new Date(training.brief.updatedAt).toLocaleString('vi-VN')}` : 'chưa chưng cất' }}
              · Q/A mẫu: {{ training?.total ?? 0 }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
              :disabled="briefBusy || trainBusy || !trainingDocCount"
              @click="generateBrief"
            >
              {{ briefBusy ? 'Đang chưng cất…' : 'Chưng cất chỉ dẫn' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
              :disabled="briefBusy || trainBusy || !trainingDocCount"
              @click="generateQa"
            >
              {{ trainBusy ? 'Đang sinh…' : 'Sinh bộ Q/A' }}
            </button>
            <a
              v-if="training?.total"
              href="/api/admin/training-examples/export"
              download
              class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Tải JSONL
            </a>
            <button
              v-if="training?.total"
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              :disabled="briefBusy || trainBusy"
              @click="clearQa"
            >
              Xoá Q/A
            </button>
          </div>
        </div>
        <details v-if="training?.brief" class="mt-3">
          <summary class="cursor-pointer text-xs font-medium text-slate-500">Xem chỉ dẫn đang dùng</summary>
          <pre class="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">{{ training.brief.content }}</pre>
        </details>
      </section>

      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="tag in allTags"
          :key="tag"
          type="button"
          class="rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition"
          :class="filterTag === tag ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-500 hover:text-emerald-700'"
          @click="filterTag = filterTag === tag ? '' : tag"
        >
          #{{ tag }}
        </button>
        <button
          v-if="filterTag"
          type="button"
          class="text-[11px] font-medium text-slate-400 hover:text-rose-600"
          @click="filterTag = ''"
        >
          bỏ lọc ×
        </button>
      </div>

      <div v-if="pending" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        Đang tải…
      </div>

      <p v-else-if="!docsList.length" class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Chưa có tài liệu. Thêm tài liệu đầu tiên ở khung bên cạnh.
      </p>

      <p v-else-if="!filteredDocs.length" class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        Không có tài liệu nào mang thẻ #{{ filterTag }}.
      </p>

      <div v-else class="space-y-2">
        <article
          v-for="doc in filteredDocs"
          :key="doc.id"
          class="rounded-xl border bg-white p-3 shadow-sm"
          :class="doc.isActive ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                {{ doc.title }}
                <span v-if="doc.forTraining" class="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  Training AI
                </span>
              </p>
              <p class="mt-0.5 text-[11px] text-slate-500">
                Thứ tự {{ doc.sortOrder }} · {{ doc.isActive ? 'Đang dùng' : 'Tạm tắt' }}
                <span v-if="doc.tags"> · {{ doc.tags }}</span>
              </p>
            </div>
            <div class="flex shrink-0 gap-1">
              <button type="button" class="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50" @click="edit(doc)">
                Sửa
              </button>
              <button type="button" class="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50" :disabled="busy" @click="remove(doc)">
                Xoá
              </button>
            </div>
          </div>
          <p class="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-slate-500">{{ doc.content }}</p>
          <p v-if="backlinksFor(doc).length" class="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
            ← liên kết từ
            <button
              v-for="from in backlinksFor(doc)"
              :key="from.id"
              type="button"
              class="font-medium text-emerald-700 hover:underline"
              @click="edit(from)"
            >
              {{ from.title }}
            </button>
          </p>
        </article>
      </div>
    </div>

    <section class="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">{{ form.id ? 'Sửa tài liệu' : 'Thêm tài liệu' }}</h3>
        <button v-if="form.id" type="button" class="text-xs font-medium text-slate-500 hover:text-emerald-700" @click="reset">
          Tạo mới
        </button>
      </div>

      <div class="mt-3 space-y-3">
        <div>
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".md,.markdown,.txt,.skill,.text,text/markdown,text/plain"
            class="hidden"
            @change="onFilePicked"
          />
          <button
            type="button"
            class="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-500 hover:text-emerald-700"
            @click="fileInput?.click()"
          >
            Upload .md / .txt / .skill — chọn nhiều file để nhập hàng loạt
          </button>
        </div>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Tiêu đề</span>
          <input v-model="form.title" maxlength="200" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" placeholder="Chính sách giao hoa trong ngày" />
        </label>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Từ khoá (cách nhau bằng dấu phẩy)</span>
          <input v-model="form.tags" maxlength="300" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" placeholder="giao hàng, freeship, sinh nhật" />
        </label>

        <div class="relative">
          <input
            v-model="linkSearch"
            type="text"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            placeholder="🔗 Chọn tài liệu để liên kết…"
            @focus="showLinkPicker = true"
            @blur="closeLinkPicker"
          />
          <div
            v-if="showLinkPicker && (linkCandidates.length || linkSearch.trim())"
            class="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            <button
              v-for="candidate in linkCandidates"
              :key="candidate.id"
              type="button"
              class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-emerald-50"
              @mousedown.prevent="insertLink(candidate.title)"
            >
              <span class="truncate">{{ candidate.title }}</span>
              <span class="shrink-0 text-[10px]" :class="candidate.isActive ? 'text-slate-400' : 'text-amber-600'">
                {{ candidate.isActive ? 'đang dùng' : 'tạm tắt' }}
              </span>
            </button>
            <button
              v-if="linkSearch.trim() && !linkCandidates.some((c) => c.title.toLowerCase() === linkSearch.trim().toLowerCase())"
              type="button"
              class="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-1.5 text-left text-sm text-emerald-700 hover:bg-emerald-50"
              @mousedown.prevent="insertLink(linkSearch.trim())"
            >
              ➕ Liên kết tới tài liệu mới “{{ linkSearch.trim() }}”
            </button>
          </div>
        </div>

        <div>
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs font-medium text-slate-600">Nội dung</span>
            <div class="flex rounded-lg border border-slate-200 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                class="rounded-md px-2 py-0.5"
                :class="!previewMode ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'"
                @click="previewMode = false"
              >
                Viết
              </button>
              <button
                type="button"
                class="rounded-md px-2 py-0.5"
                :class="previewMode ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'"
                @click="previewMode = true"
              >
                Xem
              </button>
            </div>
          </div>
          <textarea
            v-if="!previewMode"
            ref="contentEl"
            v-model="form.content"
            rows="10"
            maxlength="20000"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-emerald-600"
            placeholder="Hỗ trợ Markdown kiểu Obsidian: ## heading, - list, **bold**, [[Tên tài liệu khác]], #giao-hang…"
          />
          <div
            v-else
            class="doc-preview min-h-40 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700"
            @click="onPreviewClick"
            v-html="previewHtml"
          />
          <p class="mt-1 text-[10px] leading-snug text-slate-400">
            [[Tên tài liệu]] để liên kết nội bộ (click để nhảy / tạo mới), #tag để gán thẻ.
          </p>
          <div v-if="editorOutgoing.length" class="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]">
            <span class="text-slate-400">Liên kết tới:</span>
            <button
              v-for="link in editorOutgoing"
              :key="link"
              type="button"
              class="rounded border px-1.5 py-0.5 font-medium"
              :class="docsList.some(d => d.title.toLowerCase() === link.toLowerCase()) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'"
              @click="openDocByTitle(link)"
            >
              {{ link }}
            </button>
          </div>
          <div v-if="editorBacklinks.length" class="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
            <span class="text-slate-400">Được liên kết từ:</span>
            <button
              v-for="from in editorBacklinks"
              :key="from.id"
              type="button"
              class="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-medium text-slate-600 hover:border-emerald-400"
              @click="edit(from)"
            >
              {{ from.title }}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label class="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input v-model="form.isActive" type="checkbox" class="h-4 w-4" />
            Đang dùng
          </label>
          <label class="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input v-model="form.forTraining" type="checkbox" class="h-4 w-4 accent-violet-600" />
            Dữ liệu huấn luyện AI
          </label>
          <label class="flex items-center gap-2 text-xs font-medium text-slate-600">
            Thứ tự
            <input v-model.number="form.sortOrder" type="number" min="0" max="9999" class="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
          </label>
        </div>

        <button
          type="button"
          class="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          :disabled="busy"
          @click="save"
        >
          {{ busy ? 'Đang lưu…' : form.id ? 'Lưu thay đổi' : 'Thêm tài liệu' }}
        </button>
        <p v-if="message" class="text-xs font-medium text-emerald-700">{{ message }}</p>
        <p v-if="errorMessage" class="text-xs font-medium text-rose-700">{{ errorMessage }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.doc-preview :deep(h1),
.doc-preview :deep(h2),
.doc-preview :deep(h3) {
  margin: 0.75em 0 0.35em;
  font-weight: 600;
  color: #1e293b;
}
.doc-preview :deep(h1) { font-size: 1.15em; }
.doc-preview :deep(h2) { font-size: 1.05em; }
.doc-preview :deep(h3) { font-size: 1em; }
.doc-preview :deep(p) { margin: 0.4em 0; }
.doc-preview :deep(ul),
.doc-preview :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.4em;
}
.doc-preview :deep(ul) { list-style: disc; }
.doc-preview :deep(ol) { list-style: decimal; }
.doc-preview :deep(li) { margin: 0.15em 0; }
.doc-preview :deep(strong) { font-weight: 600; }
.doc-preview :deep(code) {
  border-radius: 4px;
  background: #e2e8f0;
  padding: 0.1em 0.35em;
  font-size: 0.85em;
}
.doc-preview :deep(pre) {
  overflow-x: auto;
  border-radius: 8px;
  background: #0f172a;
  padding: 0.6em 0.8em;
  color: #e2e8f0;
  font-size: 0.8em;
}
.doc-preview :deep(pre code) {
  background: transparent;
  padding: 0;
  color: inherit;
}
.doc-preview :deep(blockquote) {
  border-left: 3px solid #cbd5e1;
  margin: 0.5em 0;
  padding-left: 0.8em;
  color: #64748b;
}
.doc-preview :deep(table) {
  margin: 0.5em 0;
  border-collapse: collapse;
  font-size: 0.85em;
}
.doc-preview :deep(th),
.doc-preview :deep(td) {
  border: 1px solid #cbd5e1;
  padding: 0.25em 0.5em;
}
.doc-preview :deep(a) {
  color: #047857;
  text-decoration: underline;
  cursor: pointer;
}
.doc-preview :deep(hr) {
  border-color: #cbd5e1;
  margin: 0.8em 0;
}
</style>
