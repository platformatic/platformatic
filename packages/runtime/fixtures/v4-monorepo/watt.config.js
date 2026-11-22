export default {
  env: { FROM_ROOT_BLOCK: 'block', SHARED: 'root-block' },
  applications: [
    { id: 'api', path: './web/api', env: { FROM_ENTRY: 'entry', SHARED: 'entry' } },
    { id: 'frontend', path: './web/frontend' }
  ]
}
