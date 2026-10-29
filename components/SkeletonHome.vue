<template>
  <div aria-hidden="true">
    <div class="container-page pt-3">
      <div class="sk h-[170px] rounded-xl2" />
    </div>

    <div class="container-page mt-8">
      <div class="h-4 w-28 rounded-full sk" />
      <div class="mt-4 flex gap-2.5 overflow-hidden">
        <div v-for="index in 6" :key="index" class="w-20 shrink-0">
          <div class="sk aspect-square w-full rounded-full" />
          <div class="mx-auto mt-2 h-2.5 w-4/5 rounded-full sk" />
        </div>
      </div>
    </div>

    <div class="container-page mt-8">
      <div class="flex items-end justify-between">
        <div class="h-4 w-24 rounded-full sk" />
        <div class="h-6 w-16 rounded-full sk" />
      </div>
      <div class="mt-4 flex gap-2.5 overflow-hidden">
        <div v-for="index in 3" :key="index" class="w-40 shrink-0">
          <div class="sk aspect-square w-full rounded-xl2" />
          <div class="mt-2 h-3 w-4/5 rounded-full sk" />
          <div class="mt-1.5 h-3 w-1/2 rounded-full sk" />
        </div>
      </div>
    </div>

    <div class="container-page mt-8">
      <div class="flex items-end justify-between">
        <div class="h-4 w-32 rounded-full sk" />
        <div class="h-3 w-16 rounded-full sk" />
      </div>
      <div class="mt-4">
        <SkeletonGrid :count="4" :columns="2" />
      </div>
    </div>
  </div>
</template>
