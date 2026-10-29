<template>
  <div class="mt-4 grid gap-3" aria-hidden="true">
    <div v-for="index in 3" :key="index" class="overflow-hidden rounded-[16px] border border-hairline/60 bg-white/60">
      <div class="sk aspect-[16/9] w-full" />
      <div class="p-4">
        <div class="sk h-2.5 w-24 rounded-full" />
        <div class="sk mt-2.5 h-4 w-4/5 rounded-full" />
        <div class="mt-3 space-y-2">
          <div class="sk h-3 w-full rounded-full" />
          <div class="sk h-3 w-11/12 rounded-full" />
          <div class="sk h-3 w-2/3 rounded-full" />
        </div>
      </div>
    </div>
  </div>
</template>
