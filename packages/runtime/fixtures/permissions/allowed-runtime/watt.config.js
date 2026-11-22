// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  applications: [
    {
      id: 'service',
      path: '../app',
      permissions: {
        fs: {
          read: [
            process.env.PLT_TESTS_TEMPLATE_FILE,
            process.env.PLT_TESTS_PACKAGES
          ]
        }
      }
    }
  ]
}
