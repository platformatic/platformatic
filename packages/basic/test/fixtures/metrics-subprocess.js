const itc = globalThis[Symbol.for('plt.children.itc')]

const interval = setInterval(() => {
  // No-op
}, 1000)

itc.handle('done', async () => {
  clearInterval(interval)
  return true
})

itc.notify('ready')
