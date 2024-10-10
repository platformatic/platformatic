const interval = setInterval(() => {
  // No-op
}, 1000)

globalThis[Symbol.for('plt.children.itc')]?.notify('ready')

globalThis[Symbol.for('plt.children.itc')].handle('failure', () => {
  clearInterval(interval)
  throw new Error('FAILURE')
})
