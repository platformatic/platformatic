import { getMessaging } from '@platformatic/globals'
export const hasServer = false

const messaging = getMessaging()
messaging.handle('request', url => {
  return url.split('').reverse().join('')
})
