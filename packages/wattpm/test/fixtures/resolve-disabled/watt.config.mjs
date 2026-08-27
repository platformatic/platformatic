/*
  `enabled: false` keeps an application out of the boot. It must not keep it out of `resolve`:
  the clone has to exist before the boot that turns it on.
*/
export default {
  applications: [
    {
      id: 'resolved',
      url: process.env.PLT_GIT_REPO_URL,
      enabled: false
    }
  ]
}
