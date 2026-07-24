import { writeFileSync } from 'node:fs'

export default function setup ({ options }) {
  writeFileSync(options.markerFile, 'setup-ran')
}
