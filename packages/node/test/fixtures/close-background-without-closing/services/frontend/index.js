function doWork () {
  globalThis.platformatic.events.emitAndNotify('work')
  timeoutId = setTimeout(doWork, 30_000)
}

globalThis[Symbol.for('plt.runtime.itc')]?.on('runtime:event', e => {
  if (e.event === 'background:start') {
    doWork()
  }
})
