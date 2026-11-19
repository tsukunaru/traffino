import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { buildGame } from './build.mjs';
const dev=process.argv.includes('--dev'),port=Number(process.env.PORT||4180),root=resolve('dist');
if(!process.argv.includes('--no-build'))await buildGame(dev);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.wav':'audio/wav'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost'),path=url.pathname;
    if(path==='/sdk.js'){res.writeHead(200,{'content-type':mime['.js']});res.end('/* Local platform: no Yandex SDK. */');return;}
    if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
    const file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep))throw new Error('path');
    const bytes=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Traffino: http://127.0.0.1:${port} (${dev?'development':'production'})`));
