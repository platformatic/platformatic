const interval = setInterval(() => {
  // No-op
}, 1000)

globalThis.platformatic.events.on('close', () => {
  clearInterval(interval)
  throw new Error('FAILURE')
})

globalThis[Symbol.for('plt.children.itc')].notify('ready')
