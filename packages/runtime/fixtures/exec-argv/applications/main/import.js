setTimeout(() => {
  globalThis.platformatic.events.emitAndNotify('argv', import.meta.filename)
}, 1000)
