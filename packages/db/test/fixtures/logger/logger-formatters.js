export function bindings (bindings) {
  return { name: 'db-service' }
}

export function level (label) {
  return { level: label.toUpperCase() }
}
