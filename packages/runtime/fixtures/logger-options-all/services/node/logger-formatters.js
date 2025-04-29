export function bindings (bindings) {
  return { name: bindings.name.toUpperCase() }
}

export function level (label) {
  return { level: label.toUpperCase() }
}
