import { getLogLevel } from '@platformatic/globals'
export default {
  base: '/nested/base/dir/',
  logLevel: getLogLevel(false) ?? 'info'
}
