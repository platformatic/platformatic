export function bindings (bindings) {
  return { name: 'vite' }
}

export function level (label) {
  return { level: label.toUpperCase() }
}
