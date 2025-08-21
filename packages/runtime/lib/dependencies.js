import { Sorter } from '@hapi/topo'
import { closest } from 'fastest-levenshtein'
import { MissingDependencyError } from './errors.js'
import { RoundRobinMap } from './worker/round-robin-map.js'

function missingDependencyErrorMessage (clientName, application, applications) {
  const allNames = applications
    .map(s => s.id)
    .filter(id => id !== application.id)
    .sort()
  const closestName = closest(clientName, allNames)
  let errorMsg = `application '${application.id}' has unknown dependency: '${clientName}'.`
  if (closestName) {
    errorMsg += ` Did you mean '${closestName}'?`
  }
  if (allNames.length) {
    errorMsg += ` Known applications are: ${allNames.join(', ')}.`
  }
  return errorMsg
}

export function checkDependencies (applications) {
  const allApplications = new Set(applications.map(s => s.id))

  for (const application of applications) {
    for (const dependency of application.dependencies) {
      if (dependency.local && !allApplications.has(dependency.id)) {
        throw new MissingDependencyError(missingDependencyErrorMessage(dependency.id, application, applications))
      }
    }
  }
}

export function topologicalSort (workers, config) {
  const topo = new Sorter()

  for (const application of config.applications) {
    const localDependencyIds = Array.from(application.dependencies)
      .filter(dep => dep.local)
      .map(dep => dep.id)

    topo.add(application, {
      group: application.id,
      after: localDependencyIds,
      manual: true
    })
  }

  config.applications = topo.sort()

  return new RoundRobinMap(
    Array.from(workers.entries()).sort((a, b) => {
      if (a[0] === b[0]) {
        return 0
      }

      const aIndex = config.applications.findIndex(s => s.id === a[0])
      const bIndex = config.applications.findIndex(s => s.id === b[0])
      return aIndex - bIndex
    }),
    workers.configuration
  )
}
