export function useCountdown(endsAt: Ref<string | Date | null | undefined>) {
  const now = ref(Date.now())
  const mounted = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const remaining = computed(() => {
    if (!endsAt.value) return 0
    const end = new Date(endsAt.value).getTime()
    return Math.max(0, end - now.value)
  })

  const label = computed(() => {
    if (!mounted.value) return '--:--:--'
    const total = Math.floor(remaining.value / 1000)
    const hours = String(Math.floor(total / 3600)).padStart(2, '0')
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
    const seconds = String(total % 60).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  })

  onMounted(() => {
    mounted.value = true
    now.value = Date.now()
    timer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
  })

  return { remaining, label }
}
