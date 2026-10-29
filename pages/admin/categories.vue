<script setup lang="ts">
import type { AdminCategory } from '~/types/admin'

definePageMeta({ layout: 'admin', middleware: 'admin', title: 'Danh mục' })

const requestFetch = useRequestFetch()
const { data, pending, error, refresh } = await useAsyncData<{ items: AdminCategory[] }>('admin-categories', () =>
  requestFetch<{ items: AdminCategory[] }>('/api/admin/categories')
)

const items = computed(() => data.value?.items ?? [])
const query = ref('')
const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return items.value
  return items.value.filter(
    (item) =>
      item.name.toLowerCase().includes(needle) ||
      item.slug.toLowerCase().includes(needle) ||
      (item.parent?.name ?? '').toLowerCase().includes(needle)
  )
})

type Draft = {
  name: string
  slug: string
  parent: string
  description: string
  imageUrl: string
  seoTitle: string
  seoDescription: string
  sortOrder: number
  isActive: boolean
}

function emptyDraft(): Draft {
  return {
    name: '',
    slug: '',
    parent: '',
    description: '',
    imageUrl: '',
    seoTitle: '',
    seoDescription: '',
    sortOrder: 0,
    isActive: true
  }
}

const draft = reactive<Draft>(emptyDraft())
const editingId = ref('')
const slugTouched = ref(false)
const busy = ref(false)
const message = ref('')
const formError = ref('')
const imageInput = ref<HTMLInputElement | null>(null)
const imageBusy = ref(false)

function pickCategoryImage() {
  imageInput.value?.click()
}

async function uploadCategoryImage(event: Event) {
  if (!editingId.value) {
    formError.value = 'Lưu danh mục trước khi tải ảnh.'
    return
  }
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    formError.value = 'Ảnh danh mục tối đa 5 MB.'
    return
  }
  if (!file.type.startsWith('image/')) {
    formError.value = 'Tệp phải là ảnh.'
    return
  }
  imageBusy.value = true
  formError.value = ''
  try {
    const body = new FormData()
    body.set('file', file)
    const result = await $fetch<{ imageUrl: string }>(`/api/admin/categories/${editingId.value}/image`, {
      method: 'POST',
      body
    })
    draft.imageUrl = result.imageUrl
  } catch (error: any) {
    formError.value = error?.data?.statusMessage || 'Không tải được ảnh danh mục.'
  } finally {
    imageBusy.value = false
    input.value = ''
  }
}

async function removeCategoryImage() {
  if (!editingId.value) return
  imageBusy.value = true
  formError.value = ''
  try {
    const result = await $fetch<{ imageUrl: string }>(`/api/admin/categories/${editingId.value}/image`, {
      method: 'DELETE'
    })
    draft.imageUrl = result.imageUrl
  } catch (error: any) {
    formError.value = error?.data?.statusMessage || 'Không xoá được ảnh danh mục.'
  } finally {
    imageBusy.value = false
  }
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

watch(
  () => draft.name,
  (value) => {
    if (slugTouched.value || editingId.value) return
    draft.slug = slugify(value)
  }
)

function resetForm() {
  Object.assign(draft, emptyDraft())
  editingId.value = ''
  slugTouched.value = false
  formError.value = ''
}

function edit(category: AdminCategory) {
  editingId.value = category.id
  Object.assign(draft, {
    name: category.name,
    slug: category.slug,
    parent: category.parent?.id ?? '',
    description: category.description,
    imageUrl: category.imageUrl,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    sortOrder: category.sortOrder,
    isActive: category.isActive
  })
  slugTouched.value = true
  formError.value = ''
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

const parentOptions = computed(() => items.value.filter((item) => item.id !== editingId.value))

async function save() {
  if (busy.value) return
  formError.value = ''
  if (!draft.name.trim()) {
    formError.value = 'Nhập tên danh mục.'
    return
  }

  busy.value = true
  try {
    const body = {
      name: draft.name.trim(),
      slug: draft.slug.trim() || slugify(draft.name),
      parent: draft.parent,
      description: draft.description.trim(),
      imageUrl: draft.imageUrl.trim(),
      seoTitle: draft.seoTitle.trim(),
      seoDescription: draft.seoDescription.trim(),
      sortOrder: Number(draft.sortOrder) || 0,
      isActive: draft.isActive
    }

    if (editingId.value) {
      await $fetch(`/api/admin/categories/${editingId.value}`, { method: 'PATCH', body })
      message.value = 'Đã cập nhật danh mục.'
    } else {
      await $fetch('/api/admin/categories', { method: 'POST', body })
      message.value = 'Đã thêm danh mục.'
    }

    await refresh()
    resetForm()
    setTimeout(() => {
      message.value = ''
    }, 2600)
  } catch (error: any) {
    formError.value = error?.data?.statusMessage || 'Không lưu được danh mục.'
  } finally {
    busy.value = false
  }
}

async function toggleActive(category: AdminCategory) {
  try {
    await $fetch(`/api/admin/categories/${category.id}`, {
      method: 'PATCH',
      body: { isActive: !category.isActive }
    })
    await refresh()
  } catch (error: any) {
    formError.value = error?.data?.statusMessage || 'Không đổi được trạng thái.'
  }
}

async function remove(category: AdminCategory) {
  if (!window.confirm(`Xoá danh mục "${category.name}"?`)) return
  formError.value = ''
  try {
    await $fetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' })
    await refresh()
    if (editingId.value === category.id) resetForm()
    message.value = 'Đã xoá danh mục.'
    setTimeout(() => {
      message.value = ''
    }, 2600)
  } catch (error: any) {
    formError.value = error?.data?.statusMessage || 'Không xoá được danh mục.'
  }
}

useHead({ title: 'Danh mục' })
</script>

<template>
  <div class="w-full space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold">Danh mục</h2>
        <p class="text-sm text-slate-500">{{ items.length }} danh mục · dùng cho sản phẩm và điều hướng cửa hàng.</p>
      </div>
      <button
        type="button"
        class="self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        :disabled="pending"
        @click="refresh()"
      >
        {{ pending ? 'Đang tải…' : 'Làm mới' }}
      </button>
    </div>

    <div class="grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 p-3">
          <input
            v-model="query"
            type="search"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            placeholder="Tìm danh mục…"
          />
        </div>

        <div v-if="error" class="p-6 text-sm text-rose-700">
          Không tải được danh mục. {{ (error as any)?.data?.statusMessage || '' }}
        </div>

        <div v-else class="w-full overflow-x-auto">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-2.5 font-semibold">Danh mục</th>
                <th class="px-4 py-2.5 font-semibold">Slug</th>
                <th class="px-4 py-2.5 text-right font-semibold">Sản phẩm</th>
                <th class="px-4 py-2.5 font-semibold">Hiển thị</th>
                <th class="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="pending && items.length === 0">
                <td colspan="5" class="px-4 py-10 text-center text-sm text-slate-400">Đang tải danh mục…</td>
              </tr>
              <tr v-else-if="filtered.length === 0">
                <td colspan="5" class="px-4 py-12 text-center text-sm text-slate-400">
                  {{ query ? 'Không có danh mục khớp tìm kiếm.' : 'Chưa có danh mục nào.' }}
                </td>
              </tr>
              <tr
                v-for="category in filtered"
                :key="category.id"
                class="cursor-pointer hover:bg-slate-50/70"
                :class="editingId === category.id ? 'bg-emerald-50/50' : ''"
                @click="edit(category)"
              >
                <td class="px-4 py-3">
                  <p class="font-medium text-slate-800">
                    <span v-if="category.parent" class="text-slate-400">↳ </span>{{ category.name }}
                  </p>
                  <p v-if="category.parent" class="text-[11px] text-slate-400">Thuộc {{ category.parent.name }}</p>
                  <p v-else-if="category.description" class="max-w-[340px] truncate text-[11px] text-slate-400">
                    {{ category.description }}
                  </p>
                </td>
                <td class="px-4 py-3 font-mono text-[11px] text-slate-500">{{ category.slug }}</td>
                <td class="px-4 py-3 text-right tabular-nums text-slate-600">{{ category.productCount }}</td>
                <td class="px-4 py-3">
                  <button
                    type="button"
                    class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    :class="category.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                    @click.stop="toggleActive(category)"
                  >
                    {{ category.isActive ? 'Đang hiện' : 'Đang ẩn' }}
                  </button>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    type="button"
                    class="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    @click.stop="remove(category)"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">{{ editingId ? 'Sửa danh mục' : 'Thêm danh mục' }}</h3>
          <button v-if="editingId" type="button" class="text-xs font-medium text-slate-500 hover:text-slate-800" @click="resetForm">
            + Tạo mới
          </button>
        </div>

        <div class="mt-3 space-y-3">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Tên danh mục *</span>
            <input
              v-model="draft.name"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              placeholder="Hoa hồng"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Slug</span>
            <input
              v-model="draft.slug"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
              placeholder="hoa-hong"
              @input="slugTouched = true"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Danh mục cha</span>
            <select
              v-model="draft.parent"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            >
              <option value="">— Không có —</option>
              <option v-for="parent in parentOptions" :key="parent.id" :value="parent.id">{{ parent.name }}</option>
            </select>
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Mô tả</span>
            <textarea
              v-model="draft.description"
              rows="2"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              placeholder="Mô tả ngắn cho danh mục"
            />
          </label>

          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs font-medium text-slate-600">Ảnh danh mục</p>
            <div v-if="draft.imageUrl" class="mt-2 overflow-hidden rounded-lg border border-slate-200">
              <img :src="draft.imageUrl" alt="Ảnh danh mục" class="h-32 w-full object-cover" loading="lazy" />
            </div>
            <p v-else class="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
              Chưa có ảnh danh mục
            </p>
            <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="uploadCategoryImage" />
            <div class="mt-2 flex gap-2">
              <button
                type="button"
                class="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                :disabled="imageBusy || !editingId"
                @click="pickCategoryImage"
              >
                {{ imageBusy ? 'Đang tải…' : draft.imageUrl ? 'Thay ảnh' : 'Tải ảnh' }}
              </button>
              <button
                v-if="draft.imageUrl"
                type="button"
                class="rounded-md px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                :disabled="imageBusy"
                @click="removeCategoryImage"
              >
                Xoá
              </button>
            </div>
            <p v-if="!editingId" class="mt-1 text-[11px] text-slate-400">Lưu danh mục trước khi tải ảnh.</p>
          </div>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">URL ảnh ngoài (tuỳ chọn)</span>
            <input
              v-model="draft.imageUrl"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-600"
              placeholder="/images/category-*.svg"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Tiêu đề SEO</span>
            <input
              v-model="draft.seoTitle"
              maxlength="120"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              placeholder="Để trống sẽ dùng tên danh mục"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-600">Meta description</span>
            <textarea
              v-model="draft.seoDescription"
              rows="2"
              maxlength="320"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-600">Thứ tự</span>
              <input
                v-model.number="draft.sortOrder"
                type="number"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
            </label>
            <label class="mt-6 flex items-center gap-2 text-xs font-medium text-slate-600">
              <input v-model="draft.isActive" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
              Hiển thị
            </label>
          </div>

          <p v-if="formError" class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{{ formError }}</p>
          <p v-if="message" class="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{{ message }}</p>

          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
              :disabled="busy"
              @click="save"
            >
              {{ busy ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Thêm danh mục' }}
            </button>
            <button
              v-if="editingId"
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              @click="resetForm"
            >
              Huỷ
            </button>
          </div>

          <p class="text-[11px] leading-relaxed text-slate-400">
            Danh mục còn sản phẩm hoặc danh mục con sẽ không xoá được.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
