export function apiErrorMessage(error: unknown, fallback: string) {
  const value = error as {
    data?: { statusMessage?: string; message?: string }
    statusMessage?: string
    message?: string
  }
  return value?.data?.statusMessage || value?.statusMessage || value?.data?.message || value?.message || fallback
}
