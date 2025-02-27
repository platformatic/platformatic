import { moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { ok } from 'node:assert'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { readFile } from 'fs/promises'

test('generate types for allOf and anyOf combinations in Megaditta request body', async () => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = desm.join(import.meta.url, 'fixtures', 'allof-anyof-openapi.json')
  await execa('node', [
    desm.join(import.meta.url, '..', 'cli.mjs'),
    openAPIfile,
    '--name',
    'fantozzi-types',
    '--full-request',
    '--full-response'
  ])

  const typeFile = join(dir, 'fantozzi-types', 'fantozzi-types.d.ts')
  const data = await readFile(typeFile, 'utf-8')

  console.log('data', data)
  ok(data.includes(`export type PostFantozziFracchiaRequest = {
    body: { 'ragionier': string } & { 'megaditta': 'filini'; 'dati': { 'numeroNuvola': string; 'contaMinuti'?: number; 'nomeNuvolaDiFantozzi'?: string } } | { 'megaditta': 'calboni'; 'dati': { 'partitaDoppia': number; 'contabilitaCalboni': string; 'polizzaInfortuni'?: boolean } }
  }

  /**
   * Risposta Megaditta
   */
  export type PostFantozziFracchiaResponseOK = { 'risultato': { 'codicePazzaIdea': string; 'statoNuvola': 'piove' | 'grandina' | 'diluvio' } }
  export type PostFantozziFracchiaResponses =
    FullResponse<PostFantozziFracchiaResponseOK, 200>`))
})
