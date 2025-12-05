import type { Config } from '@react-router/dev/config'

export default {
  basename: globalThis.platformatic?.basePath ?? '/',
  ssr: true
} satisfies Config
