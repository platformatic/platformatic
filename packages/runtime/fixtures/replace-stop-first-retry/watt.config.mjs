export default {
  watch: false,
  reuseTcpPorts: false,
  restartOnError: 500,
  applications: [
    {
      id: 'main',
      path: './main',
      // The tests that need more than one worker ask for them
      workers: Number(process.env.PLT_TESTS_REPLACE_WORKERS ?? 1)
    }
  ],
  logger: {
    level: 'trace'
  }
}
