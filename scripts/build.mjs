import { build } from 'esbuild';
import { mkdir, copyFile, stat, readFile, writeFile, cp } from 'node:fs/promises';
import { transformAsync } from '@babel/core';
import presetEnv from '@babel/preset-env';
import { resolve } from 'node:path';
export async function buildGame(dev=false) {
  await mkdir('dist',{recursive:true});
  await build({entryPoints:['src/main.js'],bundle:true,outfile:'dist/game.js',format:'iife',target:['es2020'],external:['assets/*'],minify:!dev,sourcemap:dev?'inline':false,define:{__DEV__:String(dev)},logLevel:'warning',legalComments:'eof'});
  if(!dev) {
    const source=await readFile('dist/game.js','utf8');
    const output=await transformAsync(source,{presets:[[presetEnv,{targets:{safari:'9',chrome:'49',firefox:'52'},modules:false,bugfixes:true}]],comments:false,compact:true});
    await writeFile('dist/game.js',output.code);
  }
  await Promise.all(['index.html','icon.svg'].map(file=>copyFile(file,'dist/'+file)));
  await cp('public/assets','dist/assets',{recursive:true});
  const notices=await Promise.all(['three','core-js'].map(async name=>`${name}\n${await readFile('node_modules/'+name+'/LICENSE','utf8')}`));
  await writeFile('dist/NOTICES.txt',notices.join('\n\n'));
  return (await stat('dist/game.js')).size;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/build.mjs'))console.log(`Built ${await buildGame(process.argv.includes('--dev'))} bytes`);
