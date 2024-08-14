// When we fully switch to Node 22, this can be removed and directly replaced with Promise.withResolvers
function withResolvers () {
  let resolve
  let reject

  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  return { promise, resolve, reject }
}

module.exports = { withResolvers: Promise.withResolvers ? Promise.withResolvers.bind(Promise) : withResolvers }
