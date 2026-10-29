<template>
  <div class="container-page py-5" aria-hidden="true">
    <div class="sk h-3 w-24 rounded-full" />
    <div class="sk mt-4 h-6 w-4/5 rounded-full" />
    <div class="sk mt-2 h-6 w-3/5 rounded-full" />
    <div class="sk mt-3 h-3 w-1/3 rounded-full" />
    <div class="sk mt-5 aspect-[16/9] w-full rounded-xl2" />
    <div class="mt-5 space-y-2.5">
      <div v-for="index in 6" :key="index" class="sk h-3 rounded-full" :class="index === 6 ? 'w-3/5' : 'w-full'" />
    </div>
    <div class="mt-6 space-y-2.5">
      <div v-for="index in 4" :key="index" class="sk h-3 rounded-full" :class="index === 4 ? 'w-1/2' : 'w-full'" />
    </div>
  </div>
</template>
