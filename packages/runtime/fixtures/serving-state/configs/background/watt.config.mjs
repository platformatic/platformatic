export default {
  watch: false,
  logger: { level: 'fatal' },
  applications: [{ id: 'background', path: '../../background', workers: 2 }]
}
