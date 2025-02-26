'use strict'

const Topo = require('@hapi/topo')
const { closest } = require('fastest-levenshtein')

const errors = require('./errors')
const { RoundRobinMap } = require('./worker/round-robin-map')

function missingDependencyErrorMessage (clientName, service, services) {
  const allNames = services.map(s => s.id).filter(id => id !== service.id).sort()
  const closestName = closest(clientName, allNames)
  let errorMsg = `service '${service.id}' has unknown dependency: '${clientName}'.`
  if (closestName) {
    errorMsg += ` Did you mean '${closestName}'?`
  }
  if (allNames.length) {
    errorMsg += ` Known services are: ${allNames.join(', ')}.`
  }
  return errorMsg
}

function checkDependencies (services) {
  const allServices = new Set(services.map(s => s.id))

  for (const service of services) {
    for (const dependency of service.dependencies) {
      if (dependency.local && !allServices.has(dependency.id)) {
        throw new errors.MissingDependencyError(missingDependencyErrorMessage(dependency.id, service, services))
      }
    }
  }
}

function topologicalSort (workers, config) {
  const topo = new Topo.Sorter()

  for (const service of config.services) {
    const localDependencyIds = Array.from(service.dependencies)
      .filter(dep => dep.local)
      .map(dep => dep.id)

    topo.add(service, {
      group: service.id,
      after: localDependencyIds,
      manual: true
    })
  }

  config.services = topo.sort()

  return new RoundRobinMap(
    Array.from(workers.entries()).sort((a, b) => {
      if (a[0] === b[0]) {
        return 0
      }

      const aIndex = config.services.findIndex(s => s.id === a[0])
      const bIndex = config.services.findIndex(s => s.id === b[0])
      return aIndex - bIndex
    }),
    workers.configuration
  )
}

module.exports = { checkDependencies, topologicalSort }
