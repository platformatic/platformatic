export function bindings (bindings) {
  return { name: 'next', bindings: 'custom' }
}

export function level (label) {
  return { level: label.toUpperCase() }
}
