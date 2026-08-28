export default {
  "module": "@platformatic/next",
  "logger": {
    "level": "warn"
  },
  "cache": {
    "adapter": "valkey",
    "url": "valkey://undefined",
    "prefix": "plt:test:caching-valkey"
  },
  "next": {
    "useExperimentalAdapter": true
  },
  "server": {
    "port": 0
  }
}
