import type { Config } from '@react-router/dev/config'

export default {
  basename: globalThis.platformatic?.basePath ?? '/',
  ssr: false
} satisfies Config
