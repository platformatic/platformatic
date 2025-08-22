import { execa } from 'execa'
import { readFile } from 'fs/promises'
import { ok } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import { moveToTmpdir } from './helper.js'

test('generate types for allOf/anyOf combinations in body', async () => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'allof-anyof-openapi.json')
  await execa('node', [
    join(import.meta.dirname, '..', 'index.js'),
    openAPIfile,
    '--name',
    'fantozzi-types',
    '--full-request',
    '--full-response'
  ])

  const typeFile = join(dir, 'fantozzi-types', 'fantozzi-types.d.ts')
  const data = await readFile(typeFile, 'utf-8')

  ok(
    data.includes(`
export type PostFantozziFracchiaRequest = {
  body: { 'ragionier': string } & { 'megaditta': 'filini'; 'dati': { 'numeroNuvola': string; 'contaMinuti'?: number; 'nomeNuvolaDiFantozzi'?: string } } | { 'megaditta': 'calboni'; 'dati': { 'partitaDoppia': number; 'contabilitaCalboni': string; 'polizzaInfortuni'?: boolean } }
}

/**
 * Risposta Megaditta
 */
export type PostFantozziFracchiaResponseOK = { 'risultato': { 'codicePazzaIdea': string; 'statoNuvola': 'piove' | 'grandina' | 'diluvio' } }
export type PostFantozziFracchiaResponses =
  FullResponse<PostFantozziFracchiaResponseOK, 200>`)
  )
})
