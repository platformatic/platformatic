/*
  Branches its topology on the boot command, which is legal and is the case `--for all` exists for.
  Here the two answers disagree about which branch to clone into one directory, which is the case
  it has to refuse.
*/
export default ctx => ({
  applications: [
    {
      id: 'resolved',
      url: process.env.PLT_GIT_REPO_URL,
      gitBranch: ctx.command === 'build' ? 'other' : 'main'
    }
  ]
})
