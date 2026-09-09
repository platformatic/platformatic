/*
  Two applications whose destinations collide. The ids differ, so the id-keyed check has nothing to
  say about them -- and one directory still cannot hold two repositories, whichever of the two
  clones lands there second.
*/
export default {
  applications: [
    {
      id: 'first',
      url: process.env.PLT_GIT_REPO_URL,
      path: './shared'
    },
    {
      id: 'second',
      url: 'https://github.com/platformatic/somewhere-else.git',
      path: './shared'
    }
  ]
}
