import { getBasePath } from '@platformatic/globals'
import type { Config } from '@react-router/dev/config'

export default {
  basename: getBasePath({ throwOnMissing: false }) ?? '/',
  ssr: true
} satisfies Config
