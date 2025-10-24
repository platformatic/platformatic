let timeoutId

function doWork () {
  globalThis.platformatic.events.emitAndNotify('work')
  timeoutId = setTimeout(doWork, 30_000)
}

globalThis[Symbol.for('plt.runtime.itc')]?.on('runtime:event', e => {
  if (e.event === 'background:start') {
    doWork()
  }
})

export async function close () {
  // this and other alike clean ups
  clearTimeout(timeoutId)

  globalThis.platformatic.events.emitAndNotify('close:function')
}
