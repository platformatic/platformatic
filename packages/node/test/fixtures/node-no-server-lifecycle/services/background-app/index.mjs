let timeoutId

function doWork () {
  globalThis.platformatic?.events.emitAndNotify('no-server:work')
  timeoutId = setTimeout(doWork, 30_000)
};

doWork()

export async function close () {
  // this and other alike clean ups
  clearTimeout(timeoutId)

  globalThis.platformatic.events.emitAndNotify('no-server:close')
}
