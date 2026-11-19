import {cp,readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const source=resolve('.'),temporary=await mkdtemp(join(tmpdir(),'traffino-release-')),npm=join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
try{
  for(const file of ['package.json','package-lock.json','src','tests','scripts','public','index.html','icon.svg'])await cp(join(source,file),join(temporary,file),{recursive:true});
  const logs=[];for(const args of [['ci','--no-audit','--no-fund'],['run','package']])logs.push(execFileSync(process.execPath,[npm,...args],{cwd:temporary,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:4e6}));
  const original=await hash(join(source,'traffino-yandex.zip')),clean=await hash(join(temporary,'traffino-yandex.zip')),report={date:new Date().toISOString(),runtime:process.version,cleanInstall:true,testsAndBuild:true,identicalZip:original===clean,original,clean};
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/reproducibility.json',JSON.stringify(report,null,2));await writeFile('artifacts/clean-install.log',logs.join('\n'));if(!report.identicalZip)throw Error('Clean release differs');console.log(JSON.stringify(report,null,2));
}finally{
  const target=resolve(temporary),base=resolve(tmpdir())+sep;if(!target.startsWith(base)||!target.slice(base.length).startsWith('traffino-release-'))throw Error('Unsafe temporary directory');await rm(target,{recursive:true,force:true,maxRetries:3,retryDelay:200});
}
