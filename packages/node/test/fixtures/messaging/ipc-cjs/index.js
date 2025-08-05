globalThis.platformatic.messaging.handle('request', url => {
  return url.split('').reverse().join('')
})
