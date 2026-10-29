<template>
  <div class="mt-4" aria-hidden="true">
    <div class="flex items-center gap-3 rounded-[18px] border border-hairline/60 bg-white/60 px-4 py-3.5">
      <div class="sk h-10 w-10 shrink-0 rounded-full" />
      <div class="min-w-0 flex-1">
        <div class="sk h-3.5 w-2/3 rounded-full" />
        <div class="sk mt-2 h-3 w-1/2 rounded-full" />
      </div>
    </div>

    <div class="mt-4 space-y-2.5">
      <div v-for="index in 2" :key="index" class="flex items-start gap-3 rounded-[14px] border border-hairline/60 bg-white/60 px-4 py-3.5">
        <div class="sk h-16 w-16 shrink-0 rounded-[12px]" />
        <div class="min-w-0 flex-1 py-1">
          <div class="sk h-3.5 w-3/4 rounded-full" />
          <div class="sk mt-2 h-3 w-1/3 rounded-full" />
          <div class="sk mt-2 h-3 w-1/2 rounded-full" />
        </div>
      </div>
    </div>

    <div class="mt-4 space-y-3 rounded-[16px] border border-hairline/60 bg-white/60 px-4 py-4">
      <div v-for="index in 4" :key="index" class="flex items-center justify-between gap-4">
        <div class="sk h-3 w-24 rounded-full" />
        <div class="sk h-3 w-20 rounded-full" />
      </div>
      <div class="flex items-center justify-between gap-4 border-t border-hairline/60 pt-3">
        <div class="sk h-4 w-20 rounded-full" />
        <div class="sk h-4 w-24 rounded-full" />
      </div>
    </div>
  </div>
</template>
