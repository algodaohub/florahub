<template>
  <div aria-hidden="true">
    <div class="container-page pt-3">
      <div class="sk h-3 w-2/3 rounded-full" />
      <div class="sk mt-2 h-3 w-1/3 rounded-full" />
    </div>

    <div class="mt-3">
      <div class="sk h-[34dvh] max-h-[320px] min-h-[200px] w-full" />
      <div class="no-scrollbar mt-3 flex gap-2 overflow-hidden px-4">
        <div v-for="index in 4" :key="index" class="sk h-16 w-16 shrink-0 rounded-[12px]" />
      </div>
    </div>

    <div class="px-4 pt-5">
      <div class="sk h-5 w-4/5 rounded-full" />
      <div class="sk mt-2 h-4 w-1/3 rounded-full" />
      <div class="sk mt-4 h-7 w-2/5 rounded-full" />

      <div class="mt-4 space-y-2">
        <div class="sk h-3 w-full rounded-full" />
        <div class="sk h-3 w-11/12 rounded-full" />
        <div class="sk h-3 w-2/3 rounded-full" />
      </div>

      <div class="mt-6 space-y-3 border-t border-hairline/60 pt-4">
        <div v-for="index in 2" :key="index" class="flex items-center justify-between gap-4">
          <div class="sk h-3 w-24 rounded-full" />
          <div class="sk h-3 w-32 rounded-full" />
        </div>
      </div>
    </div>

    <div class="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[var(--shell-max)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div class="flex items-center gap-2.5">
        <div class="sk h-11 w-11 rounded-full" />
        <div class="sk h-11 w-11 rounded-full" />
        <div class="sk h-11 flex-1 rounded-full" />
      </div>
    </div>
  </div>
</template>
