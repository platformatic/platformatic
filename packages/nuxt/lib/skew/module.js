import { addDeploymentId, platformaticSkewPlugin } from '@platformatic/vite/skew-plugin'

const htmlParts = ['head', 'bodyPrepend', 'body', 'bodyAppend']

function transformHtmlPart (part, deploymentId) {
  if (Array.isArray(part)) {
    return part.map(value => typeof value === 'string' ? transformHtmlPart(value, deploymentId) : value)
  }

  if (typeof part !== 'string') {
    return part
  }

  return part.replace(/<(script|link)\b[^>]*>/gi, tag => {
    return tag.replace(/\b(src|href)(\s*=\s*)(["'])([^"']*)\3/i, (attribute, name, equals, quote, url) => {
      return `${name}${equals}${quote}${addDeploymentId(url, deploymentId)}${quote}`
    })
  })
}

export default function skewModule (_options, nuxt) {
  const deploymentId = process.env.PLT_DEPLOYMENT_ID
  if (!deploymentId) {
    return
  }

  nuxt.hook('vite:extendConfig', viteConfig => {
    viteConfig.plugins ??= []
    viteConfig.plugins.push(platformaticSkewPlugin(deploymentId))
  })

  nuxt.hook('render:html', html => {
    for (const part of htmlParts) {
      if (part in html) {
        html[part] = transformHtmlPart(html[part], deploymentId)
      }
    }
  })
}

export { transformHtmlPart }
