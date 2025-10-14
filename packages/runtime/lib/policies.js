export function createChannelCreationHook (config) {
  const denyList = config.policies?.deny

  if (typeof denyList === 'undefined') {
    return undefined
  }

  const forbidden = new Set()

  for (let [first, unalloweds] of Object.entries(denyList)) {
    for (let second of unalloweds) {
      first = first.toLowerCase()
      second = second.toLowerCase()

      forbidden.add(`${first}:${second}`)
      forbidden.add(`${second}:${first}`)
    }
  }

  return function channelCreationHook (first, second) {
    return !forbidden.has(`${first.toLowerCase()}:${second.toLowerCase()}`)
  }
}
