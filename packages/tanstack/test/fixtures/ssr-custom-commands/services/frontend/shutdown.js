import { registerCloseCallback } from '@platformatic/globals'

registerCloseCallback(() => {
  setTimeout(() => process.exit(0), 1000)
})
