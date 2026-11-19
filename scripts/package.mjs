import { readFile,writeFile,readdir,stat,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { zipSync,unzipSync } from 'fflate';
import { VERSION } from '../src/config.js';
const files={};let size=0;
for(const name of await readdir('dist',{recursive:true})){const file='dist/'+name,info=await stat(file);if(!info.isFile()||!(['index.html','game.js','game.css','icon.svg','NOTICES.txt'].includes(name)||name.startsWith('assets/')||name.startsWith('assets\\')))continue;files[name.replaceAll('\\','/')]=new Uint8Array(await readFile(file));size+=info.size;}
if(!files['index.html']||size>100*1024*1024)throw new Error('Invalid release');
const code=new TextDecoder().decode(files['game.js']);if(code.includes('__traffino')||code.includes('sourceMappingURL'))throw new Error('Development tools leaked into build');
for(const required of ['game.js','game.css','assets/traffino-logo.png','assets/Nunito.ttf','assets/Nunito-OFL.txt','assets/junior-vehicles.png','assets/junior-shops.png'])if(!files[required])throw Error('Missing asset: '+required);
const zip=zipSync(files,{level:9,mtime:new Date('2026-01-01T00:00:00Z')}),verified=unzipSync(zip);for(const [name,data] of Object.entries(files))if(!Buffer.from(data).equals(Buffer.from(verified[name])))throw Error('ZIP verification failed: '+name);
await writeFile('traffino-yandex.zip',zip);console.log(`traffino-yandex.zip: ${zip.length} bytes compressed, ${size} bytes unpacked`);
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/release.json',JSON.stringify({version:VERSION,builtAt:new Date().toISOString(),files:Object.keys(files),unpackedBytes:size,zipBytes:zip.length,sha256:createHash('sha256').update(zip).digest('hex')},null,2));
