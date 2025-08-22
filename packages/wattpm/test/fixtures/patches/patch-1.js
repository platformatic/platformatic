export default function () {
  return {
    runtime: [
      { op: 'add', path: '/restartOnError', value: true },
      { op: 'add', path: '/entrypoint', value: 'alternate' }
    ],
    applications: {
      main: [
        { op: 'remove', path: '/node' },
        { op: 'add', path: '/application', value: {} },
        { op: 'add', path: '/application/basePath', value: '/' }
      ]
    }
  }
}
