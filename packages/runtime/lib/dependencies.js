'use strict'

const Topo = require('@hapi/topo')
const { closest } = require('fastest-levenshtein')
const errors = require('./errors')

function missingDependencyErrorMessage (clientName, service, services) {
  const closestName = closest(clientName, [...services.keys()])
  let errorMsg = `service '${service.id}' has unknown dependency: '${clientName}'.`
  if (closestName) {
    errorMsg += ` Did you mean '${closestName}'?`
  }
  return errorMsg
}

function checkDependencies (services) {
  const allServices = new Set(services.map(s => s.id))

  for (const service of services) {
    for (const dependency of service.dependencies) {
      if (dependency.local && !allServices.has(dependency.id)) {
        throw new errors.MissingDependencyError(
          missingDependencyErrorMessage(dependency.id, service, services)
        )
      }
    }
  }
}

function topologicalSort (services, config) {
  const topo = new Topo.Sorter()

  for (const service of config.services) {
    const localDependencyIds = Array.from(service.dependencies)
      .filter(dep => dep.local)
      .map(dep => dep.id)

    topo.add(service, {
      group: service.id,
      after: localDependencyIds,
      manual: true,
    })
  }

  config.services = topo.sort()

  return new Map(Array.from(services.entries()).sort((a, b) => {
    if (a[0] === b[0]) {
      return 0
    }

    const aIndex = config.services.findIndex(s => s.id === a[0])
    const bIndex = config.services.findIndex(s => s.id === b[0])
    return aIndex - bIndex
  }))
}

module.exports = { checkDependencies, topologicalSort }
