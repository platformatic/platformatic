function doWork () {
  globalThis.platformatic.events.emitAndNotify('work')
}

let intervalId = setInterval(doWork, 30_000)

export async function close () {
  // this and other alike clean ups
  clearTimeout(intervalId)

  globalThis.platformatic.events.emitAndNotify('close:function')
}
