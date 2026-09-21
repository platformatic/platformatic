import { getSendHealthSignal } from '@platformatic/globals'
// Send a health signal immediately after startup
// The sendHealthSignal function batches signals with a 1000ms timeout
getSendHealthSignal()({
  type: 'test-signal',
  data: { test: true }
}).then(() => {
  // Exit after signals are sent
  process.exit(0)
})
