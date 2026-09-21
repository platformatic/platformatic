import { getMessaging } from '@platformatic/globals'
const messaging = getMessaging()
messaging.handle('request', url => {
  return url.split('').reverse().join('')
})
