export function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function classCase (str) {
  return str
    .split(/[^a-z]+/i)
    .map((s) => capitalize(s))
    .join('')
}

export function isValidUrl (str) {
  try {
    new URL(str) // eslint-disable-line no-new
    return true
  } catch {
    return false
  }
}
