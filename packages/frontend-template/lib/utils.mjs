export function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function classCase (str) {
  return str
    .split(/[^a-z]+/i)
    .map((s) => capitalize(s))
    .join('')
}
