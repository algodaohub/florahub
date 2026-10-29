import type { Config } from 'tailwindcss'

const rgb = (name: string) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './app.vue'
  ],
  theme: {
    extend: {
      colors: {
        paper: rgb('--color-paper'),
        'paper-deep': rgb('--color-paper-deep'),
        ink: rgb('--color-ink'),
        muted: rgb('--color-muted'),
        primary: {
          DEFAULT: rgb('--color-primary'),
          dark: rgb('--color-primary-dark'),
          soft: rgb('--color-primary-soft')
        },
        accent: {
          DEFAULT: rgb('--color-accent'),
          soft: rgb('--color-accent-soft')
        },
        hairline: rgb('--color-hairline'),
        discount: rgb('--color-discount')
      },
      fontFamily: {
        display: ['var(--font-body)'],
        body: ['var(--font-body)']
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        soft: 'var(--shadow-soft)'
      },
      borderRadius: {
        xl2: 'var(--radius-card)',
        image: 'var(--radius-img)'
      }
    }
  }
} satisfies Config
