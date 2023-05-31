async function getGreeting () {
  const dep2 = await import('./dep2.mjs')

  return dep2.default.greeting
}

module.exports = { getGreeting }
