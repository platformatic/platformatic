export function isKeyEnabled (key, config) {
  if (config === undefined) return false
  if (typeof config[key] === 'boolean') {
    return config[key]
  }
  if (config[key] === undefined) {
    return false
  }
  return true
}

export function getPrivateSymbol (obj, name) {
  return Object.getOwnPropertySymbols(obj).find(s => s.description === name)
}
