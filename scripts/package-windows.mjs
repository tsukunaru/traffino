import { cp, mkdir, mkdtemp, rename, writeFile } from 'node:fs/promises';
import { join, dirname, basename, resolve } from 'node:path';
import electron from 'electron';
import manifest from '../package.json' with { type: 'json' };

if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('Build the Windows x64 playtest on Windows x64.');
await mkdir('artifacts', { recursive: true });
const out = await mkdtemp(resolve('artifacts/Traffino-Windows-'));
await cp(dirname(electron), out, { recursive: true, filter: src => basename(src) !== 'default_app.asar' });
await rename(join(out, 'electron.exe'), join(out, 'Traffino.exe'));
const game = join(out, 'resources/app');
await cp('dist', join(game, 'dist'), { recursive: true });
await cp('desktop', join(game, 'desktop'), { recursive: true });
await writeFile(join(game, 'package.json'), JSON.stringify({name: manifest.name, version: manifest.version, main: 'desktop/main.cjs'}));
console.log(join(out, 'Traffino.exe'));
