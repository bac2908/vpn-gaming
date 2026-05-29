import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.resolve(scriptDir, '../src/pages/Admin.jsx')
const source = fs.readFileSync(filePath, 'utf8')

console.log(
  '{',
  source.split('{').length - 1,
  '}',
  source.split('}').length - 1,
  '(',
  source.split('(').length - 1,
  ')',
  source.split(')').length - 1,
)
