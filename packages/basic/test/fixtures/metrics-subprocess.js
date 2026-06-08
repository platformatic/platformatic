import { getITC } from '@platformatic/globals'

const itc = getITC()

const interval = setInterval(() => {
  // No-op
}, 1000)

itc.handle('done', async () => {
  clearInterval(interval)
  return true
})

itc.notify('ready')
