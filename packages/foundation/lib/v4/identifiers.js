import { basename } from 'node:path'
import { InvalidApplicationIdError } from './errors.js'

// The id is not cosmetic: it is the mesh hostname, the injected PLT_<ID>_URL name, the metrics
// label, wattpm inject's argument and how siblings name each other in dependencies. A default
// that varied by boot style would move all five at once, so there is one derivation used at every
// position and under every boot style — though not always over the same inputs, since an explicit
// id lives on a root entry and a standalone boot never reads one.
export function stripPackageScope (name) {
  return name.startsWith('@') ? name.slice(name.indexOf('/') + 1) : name
}

export function deriveApplicationId ({ id, packageName, directory } = {}) {
  if (typeof id === 'string' && id.length > 0) {
    return { id, source: 'configuration' }
  }

  if (typeof packageName === 'string' && packageName.length > 0) {
    return { id: stripPackageScope(packageName), source: 'package.json' }
  }

  return { id: basename(directory ?? ''), source: 'directory' }
}

// The test is the DNS label grammar itself, not a list of bad characters: an enumeration of @, /,
// : and whitespace would have admitted my_app and api.v2, which are equally unusable as
// http://<id>.plt.local.
export const dnsLabelPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

export function isValidApplicationId (id) {
  return typeof id === 'string' && dnsLabelPattern.test(id)
}

// Checked before the id reaches either consumer — the hostname and the topology-variable
// normalization. Silently rewriting my_app to my-app would move the mesh hostname, the injected
// variable and the metrics label without the user asking, so this reports rather than sanitizes.
export function assertValidApplicationId (id, source) {
  if (!isValidApplicationId(id)) {
    throw new InvalidApplicationIdError(JSON.stringify(id), source)
  }

  return id
}

export function getApplicationUrl (id) {
  return `http://${id}.plt.local`
}

// Uppercased id, non-alphanumerics to underscore — the same normalization injection uses, which is
// what lets the loader strip exactly these keys from a per-app eval worker's environment.
export function topologyVariableName (id) {
  return `PLT_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_URL`
}

// The label grammar removes most of the ways two ids could normalize to one variable, so what
// remains is a case difference — and DNS labels being case-insensitive, api-v2 and API-v2 are the
// same mesh hostname too. One check catches both collisions.
export function findTopologyVariableCollisions (ids) {
  const byName = new Map()

  for (const id of ids) {
    const name = topologyVariableName(id)
    const existing = byName.get(name)

    if (existing) {
      existing.push(id)
    } else {
      byName.set(name, [id])
    }
  }

  const collisions = []

  for (const [name, colliding] of byName) {
    if (colliding.length > 1) {
      collisions.push({ name, ids: colliding })
    }
  }

  return collisions
}
