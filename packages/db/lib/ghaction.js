const { request } = require('undici')

const getOneStepVersion = async () => {
  try {
    // We try to get latest version from GitHub API, but if not present (lke now) we fallback to tags
    const { statusCode, body } = await request('https://api.github.com/repos/platformatic/onestep/releases/latest', {
      headers: {
        // Reason: https://docs.github.com/en/rest/overview/resources-in-the-rest-api?apiVersion=2022-11-28#user-agent-required
        'user-agent': 'platformatic/platformatic'
      }
    })

    if (statusCode === 404) {
      // if not releases are found, we use the latest version tag
      const { body } = await request('https://api.github.com/repos/platformatic/onestep/tags', {
        headers: {
          'user-agent': 'platformatic/platformatic'
        }
      })
      const tags = await body.json()
      if (tags?.length > 0) {
        const version = tags[0]?.name
        return version
      }
    }

    if (statusCode === 403) {
      // if we are rate limited
      return 'CHANGE-ME-TO-LATEST-VERSION'
    }

    const bodyJson = await body.json()
    const { version } = bodyJson
    return version
  } catch (err) {
    // If for any reason we can't get the latest version dynamically, we fallback to a CHANGEME string
    return 'CHANGE-ME-TO-LATEST-VERSION'
  }
}

const getGHAction = async () => {
  const onestepVersion = await getOneStepVersion()
  const ghActionConfig =
`name: Deploy Platformatic DB application to the cloud

on:
  pull_request:
    paths-ignore:
      - 'docs/**'
      - '**.md'

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout application project repository
        uses: actions/checkout@v3
      - name: npm install --omit=dev
        run: npm install --omit=dev
      - name: Deploy project
        uses: platformatic/onestep@${onestepVersion}
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          platformatic_api_key: \${{ secrets.PLATFORMATIC_API_KEY }}
  `
  return ghActionConfig
}

module.exports = {
  getOneStepVersion,
  getGHAction
}
