let executableId = process.env.WATTPM_EXECUTABLE_ID ?? 'wattpm'
let executableName = process.env.WATTPM_EXECUTABLE_NAME ?? 'Watt'

export function getExecutableId () {
  return executableId
}

export function getExecutableName () {
  return executableName
}

export function setExecutableParameters (id, name) {
  executableId = id
  executableName = name
}
