<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Tài liệu trợ lý' })

type Doc = {
  id: string
  title: string
  content: string
  tags: string
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

const requestFetch = useRequestFetch()
const { data, pending, refresh } = await useAsyncData<{ items: Doc[] }>('admin-assistant-docs', () =>
  requestFetch<{ items: Doc[] }>('/api/admin/assistant-docs')
)

const form = reactive({ id: '', title: '', content: '', tags: '', isActive: true, sortOrder: 0 })
const busy = ref(false)
const message = ref('')
const errorMessage = ref('')

function reset() {
  form.id = ''
  form.title = ''
  form.content = ''
  form.tags = ''
  form.isActive = true
  form.sortOrder = 0
}

function edit(doc: Doc) {
  form.id = doc.id
  form.title = doc.title
  form.content = doc.content
  form.tags = doc.tags
  form.isActive = doc.isActive
  form.sortOrder = doc.sortOrder
  message.value = ''
  errorMessage.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold">Tài liệu tư vấn cho trợ lý</h2>
        <p class="mt-1 text-sm text-slate-500">
          Trợ lý chọn tài liệu liên quan theo từ khoá và ghép vào câu trả lời. Giá và tồn kho luôn lấy từ sản phẩm,
          tài liệu chỉ bổ sung chính sách, quy trình, cách chọn hoa.
        </p>
      </div>

      <div v-if="pending" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        Đang tải…
      </div>

      <p v-else-if="!data?.items.length" class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Chưa có tài liệu. Thêm tài liệu đầu tiên ở khung bên cạnh.
      </p>

      <div v-else class="space-y-2">
        <article
          v-for="doc in data.items"
          :key="doc.id"
          class="rounded-xl border bg-white p-3 shadow-sm"
          :class="doc.isActive ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold">{{ doc.title }}</p>
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
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Tiêu đề</span>
          <input v-model="form.title" maxlength="200" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" placeholder="Chính sách giao hoa trong ngày" />
        </label>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Từ khoá (cách nhau bằng dấu phẩy)</span>
          <input v-model="form.tags" maxlength="300" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" placeholder="giao hàng, freeship, sinh nhật" />
        </label>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-600">Nội dung</span>
          <textarea v-model="form.content" rows="10" maxlength="20000" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-emerald-600" placeholder="Thông tin trợ lý được phép dùng khi tư vấn…" />
        </label>

        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input v-model="form.isActive" type="checkbox" class="h-4 w-4" />
            Đang dùng
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
