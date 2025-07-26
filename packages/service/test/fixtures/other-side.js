async function otherSide (app) {
  app.addHook('onRequest', async () => {
    throw new TypeError('kaboom')
  })
}

otherSide[Symbol.for('skip-override')] = true

export default otherSide
