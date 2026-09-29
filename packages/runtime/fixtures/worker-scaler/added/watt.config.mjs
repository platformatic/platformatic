export default {
  watch: false,
  autoload: { path: '../services' },
  health: { enabled: false },
  workers: { dynamic: true, minimum: 1 }
}
