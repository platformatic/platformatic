export function resolveSync (url, context, nextResolve) {
  const candidate = new URL('./sync-non-existing.js', import.meta.url).toString()

  if (url !== candidate) {
    return nextResolve(url, context)
  }

  return { shortCircuit: true, url }
}

export function loadSync (url, context, nextLoad) {
  const candidate = new URL('./sync-non-existing.js', import.meta.url).toString()

  if (url !== candidate) {
    return nextLoad(url, context)
  }

  return { shortCircuit: true, format: 'module', source: 'export const loaded = true;' }
}
