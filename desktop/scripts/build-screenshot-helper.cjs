'use strict'

const { execFileSync } = require('node:child_process')
const { existsSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')
if (process.platform !== 'win32') process.exit(0)

const dir = join(__dirname, '..', 'native')
const out = join(dir, 'build')
const root = process.env.SystemRoot ?? 'C:\\Windows'
const compiler = ['Framework64', 'Framework'].map(arch =>
  join(root, 'Microsoft.NET', arch, 'v4.0.30319', 'csc.exe')).find(existsSync)
if (!compiler) throw new Error('The Windows .NET Framework C# compiler is required to build screen capture.')
mkdirSync(out, { recursive: true })
execFileSync(compiler, ['/nologo', '/target:exe', '/optimize+', '/r:System.Drawing.dll',
  '/out:' + join(out, 'soco-screenshot.exe'), join(dir, 'soco-screenshot.cs')], { stdio: 'inherit' })
