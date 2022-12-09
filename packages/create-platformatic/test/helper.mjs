export const parseEnv = (envFile) => {
  const env = {}
  for (const line of envFile.split('\n')) {
    if (line) {
      const [key, value] = line.split('=')
      env[key.trim()] = value.trim()
    }
  }
  return env
}
