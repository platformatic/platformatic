export default {
  autoload: {
    path: '../logger-options-base-message-key/services'
  },
  watch: false,
  managementApi: false,
  logger: {
    level: 'debug',
    timestamp: 'isoTime',
    timestampKey: 'timestamp',
    levelKey: 'severity',
    messageKey: 'message'
  }
}
