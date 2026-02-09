function severity (label) {
  switch (label) {
    case 'trace':
      return 'DEBUG'
    case 'debug':
      return 'DEBUG'
    case 'info':
      return 'INFO'
    case 'warn':
      return 'WARNING'
    case 'error':
      return 'ERROR'
    case 'fatal':
      return 'CRITICAL'
    default:
      return 'DEFAULT'
  }
}

export function level (label) {
  return { severity: severity(label) }
}
