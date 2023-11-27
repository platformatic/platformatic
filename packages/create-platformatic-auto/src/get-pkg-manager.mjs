export const getPkgManager = () => {
  const userAgent = process.env.npm_config_user_agent
  if (!userAgent) {
    return 'npm'
  }
  const pmSpec = userAgent.split(' ')[0]
  const separatorPos = pmSpec.lastIndexOf('/')
  const name = pmSpec.substring(0, separatorPos)
  return name || 'npm'
}
