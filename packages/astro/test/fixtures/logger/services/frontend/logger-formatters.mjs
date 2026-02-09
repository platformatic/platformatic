export function bindings (bindings) {
  return { name: 'astro' }
}

export function level (label) {
  return { level: label.toUpperCase() }
}
