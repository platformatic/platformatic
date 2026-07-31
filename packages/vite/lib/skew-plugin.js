import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const deploymentIdEnvironmentVariable = 'PLT_DEPLOYMENT_ID'

function isAssetUrl (url) {
  return url && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)
}

export function addDeploymentId (url, deploymentId) {
  if (!isAssetUrl(url) || /(?:[?&])dpl(?:=|&|$)/i.test(url)) {
    return url
  }

  const hashIndex = url.indexOf('#')
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const separator = withoutHash.includes('?') ? (withoutHash.endsWith('?') || withoutHash.endsWith('&') ? '' : '&') : '?'

  return `${withoutHash}${separator}dpl=${encodeURIComponent(deploymentId)}${hash}`
}

function transformHtmlAssetUrls (html, deploymentId) {
  return html.replace(/<(script|link)\b[^>]*>/gi, tag => {
    return tag.replace(/\b(src|href)(\s*=\s*)(["'])([^"']*)\3/i, (attribute, name, equals, quote, url) => {
      return `${name}${equals}${quote}${addDeploymentId(url, deploymentId)}${quote}`
    })
  })
}

const manifestAssetFields = new Set(['file', 'css', 'assets'])

function transformManifestValue (value, deploymentId, isAsset = false, isRoot = false) {
  if (typeof value === 'string') {
    return isAsset || isRoot ? addDeploymentId(value, deploymentId) : value
  }

  if (Array.isArray(value)) {
    return value.map(item => transformManifestValue(item, deploymentId, isAsset || isRoot))
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const itemIsAsset = manifestAssetFields.has(key) || (isRoot && (typeof item === 'string' || Array.isArray(item)))
      value[key] = transformManifestValue(item, deploymentId, itemIsAsset)
    }
  }

  return value
}

function transformManifest (source, deploymentId) {
  try {
    const manifest = JSON.parse(source)
    return JSON.stringify(transformManifestValue(manifest, deploymentId, false, true))
  } catch {
    return source
  }
}

/**
 * Adds the deployment ID to client asset URLs for Watt skew protection.
 *
 * The plugin is intentionally disabled when PLT_DEPLOYMENT_ID is not set so
 * that local builds retain Vite's normal output and URL behaviour.
 */
export function platformaticSkewPlugin (deploymentId = process.env[deploymentIdEnvironmentVariable]) {
  if (!deploymentId) {
    return undefined
  }

  const serializedDeploymentId = JSON.stringify(deploymentId)

  return {
    name: 'platformatic-skew',

    config () {
      return {
        define: {
          'import.meta.env.PLT_DEPLOYMENT_ID': serializedDeploymentId,
          'process.env.PLT_DEPLOYMENT_ID': serializedDeploymentId
        }
      }
    },

    renderDynamicImport (options) {
      // Dynamic imports in the server bundle are resolved by Node and must not
      // be routed through the browser's deployment-aware URL handling.
      if (options.ssr || !options.targetModuleId) {
        return undefined
      }

      return {
        left: `import((url => { url.searchParams.set('dpl', ${serializedDeploymentId}); return url })(new URL(`,
        right: ', import.meta.url)))'
      }
    },

    transformIndexHtml (html) {
      return transformHtmlAssetUrls(html, deploymentId)
    },

    generateBundle (_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || !/manifest[^/]*\.json$/i.test(output.fileName)) {
          continue
        }

        const source = typeof output.source === 'string'
          ? output.source
          : Buffer.isBuffer(output.source)
            ? output.source.toString()
            : new TextDecoder().decode(output.source)
        output.source = transformManifest(source, deploymentId)
      }
    },

    async writeBundle (options) {
      // Vite writes its SSR manifest after generateBundle, so it is not
      // available in the output bundle on all supported Vite versions.
      if (!options.dir) {
        return
      }

      for (const file of ['.vite/ssr-manifest.json', 'ssr-manifest.json', '.vite/manifest.json', 'manifest.json']) {
        const path = join(options.dir, file)
        try {
          const source = await readFile(path, 'utf8')
          await writeFile(path, transformManifest(source, deploymentId))
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error
          }
        }
      }
    }
  }
}

export const skewPlugin = platformaticSkewPlugin
export const deploymentIdEnv = deploymentIdEnvironmentVariable

export default platformaticSkewPlugin
