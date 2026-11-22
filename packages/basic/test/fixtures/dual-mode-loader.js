export function resolveSync (specifier, context, nextResolve) {
  if (specifier === 'test:loader') {
    return { shortCircuit: true, url: specifier }
  }

  return nextResolve(specifier, context)
}

export function loadSync (url, context, nextLoad) {
  if (url === 'test:loader') {
    return { shortCircuit: true, format: 'module', source: 'export default "sync"' }
  }

  return nextLoad(url, context)
}

export async function resolve (specifier, context, nextResolve) {
  return resolveSync(specifier, context, nextResolve)
}

export async function load (url, context, nextLoad) {
  if (url === 'test:loader') {
    return { shortCircuit: true, format: 'module', source: 'export default "async"' }
  }

  return nextLoad(url, context)
}
