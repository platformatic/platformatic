/*
  A standalone application no longer carries execArgv in a `runtime` block; there is no hoisting and
  no `runtime` block, so a single application with orchestration to express is Level 1b: the singular
  `application` entry, with the orchestration on the entry. The application itself is the one next
  door, whose own file stays a plain capability configuration.
*/
export default {
  application: {
    path: '../exec-argv/applications/main',
    execArgv: [
      '--import',
      './fixtures/exec-argv/applications/main/import.js'
    ]
  }
}
