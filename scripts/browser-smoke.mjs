import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep, extname } from 'node:path';
import assert from 'node:assert/strict';
import { buildGame } from './build.mjs';
import { playBot } from '../tests/bot.mjs';
import { freshSave,SAVE_KEY } from '../src/progress.js';
import { VEHICLES,INTERSECTIONS } from '../src/config.js';

const release=process.argv.includes('--release'),production=process.argv.includes('--production')||release,art=process.argv.includes('--art');
await buildGame(!production);await mkdir('artifacts',{recursive:true});
const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path==='/sdk.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end('/* local fallback */');return;}if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}const file=resolve(root,'.'+(path==='/'?'/index.html':decodeURIComponent(path)));if(!file.startsWith(root+sep))throw Error('path');res.writeHead(200,{'content-type':mime[extname(file)]??'text/plain','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`,profile=await mkdtemp(join(tmpdir(),'traffino-qa-'));
const chrome=spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket,cdp,evaluate;const errors=[],checks=[];
try {
  let endpoint;
  for(let i=0;i<100;i++){try{const port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];const pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());endpoint=pages.find(p=>p.type==='page')?.webSocketDebuggerUrl;if(endpoint)break;}catch{}await sleep(100);}
  assert.ok(endpoint,'Chrome debugging endpoint');socket=new WebSocket(endpoint);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
  let id=0;const pending=new Map();
  socket.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
  cdp=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,{resolve,reject,timer:setTimeout(()=>{pending.delete(request);reject(Error('CDP timeout: '+method));},20000)});socket.send(JSON.stringify({id:request,method,params}));});
  evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const wait=async expression=>{for(let i=0;i<180;i++){if(await evaluate(`Boolean(${expression})`))return;await sleep(60);}throw Error('Timeout: '+expression);};
  const click=async selector=>{const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Unavailable button: '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});};
  const shot=async name=>{const image=await cdp('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/'+name+'.png',Buffer.from(image.data,'base64'));};
  const viewport=async(w,h)=>{await cdp('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<h});await sleep(120);await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');};
  const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
  await cdp('Page.enable');await cdp('Runtime.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.__sdkQA={ready:0,starts:0,stops:0,ads:0,saves:0};window.__sdkListeners={};window.YaGames={init:async()=>({environment:{i18n:{lang:'ru'}},serverTime:()=>Date.now(),features:{LoadingAPI:{ready:()=>__sdkQA.ready++},GameplayAPI:{start:()=>__sdkQA.starts++,stop:()=>__sdkQA.stops++}},on:(n,cb)=>__sdkListeners[n]=cb,getPlayer:async()=>({getData:async()=>({}),setData:async()=>{__sdkQA.saves++;}}),isAvailableMethod:async()=>false,adv:{showFullscreenAdv:({callbacks:c})=>{__sdkQA.ads++;c.onOpen();setTimeout(()=>c.onClose(true),20);},showRewardedVideo:({callbacks:c})=>{c.onOpen();c.onRewarded();c.onClose();}}})};`});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:'if(location.search.includes("local"))delete window.YaGames;'});
  await viewport(1280,720);await cdp('Page.navigate',{url});await wait('document.querySelector(".hero")');
  check('ready once with interactive menu',await evaluate('__sdkQA.ready===1'));
  check('local illustration and Cyrillic font loaded',await evaluate('document.querySelector(".illustrated-title img").naturalWidth>0&&document.fonts.check("900 24px Nunito")'));
  if(art){
    await wait('window.__traffino');await evaluate('document.querySelector(".debug-panel").hidden=true');await shot('visual-menu');
    for(const [w,h] of [[320,568],[390,844],[568,320],[844,390],[1024,768],[1280,720],[1920,1080]]){await viewport(w,h);check(`art menu fits ${w}x${h}`,await evaluate(`(()=>{const a=document.querySelector('.start').getBoundingClientRect(),b=document.querySelector('.mode-grid').getBoundingClientRect(),c=document.querySelector('.menu-bottom').getBoundingClientRect();return a.bottom<=b.top&&b.bottom<=c.top&&c.bottom<=innerHeight;})()`));if(w===390||w===568)await shot('visual-menu-'+w);}
    await viewport(1440,900);await click('[data-action="continue"]');await click('[data-action="startStory"]');await evaluate(`(()=>{const a=__traffino,g=a.game;g.director=false;g.clearTraffic();a.show('photo');document.querySelector('#app').classList.add('photo-hidden');const kinds=Object.keys(a.view.models);kinds.forEach((kind,i)=>{const v=g.spawn(i%4,kind,i%3);if(v){v.s=30;v.x=[-1.8,14,1.8,-14][i%4]+(i%4%2?Math.floor(i/4)*4:0);v.z=[-14,-1.8,14,1.8][i%4]+(i%4%2?0:Math.floor(i/4)*4);v.dx=i%4===1?-1:i%4===3?1:0;v.dz=i%4===0?1:i%4===2?-1:0;v.speed=4;}});g.waitingPeople=[3,2,1,2];g.people[0].active=true;Object.assign(g.people[0],{x:1,z:-6.8,t:.5,direction:0});g.signals[0]=true;g.signals[2]=true;})()`);
    const budgets=[];
    for(const [name,time] of [['day',.42],['sunset',.75],['night',.94]]){await evaluate(`__traffino.game.timeOfDay=${time}`);await sleep(250);await shot('city-'+name);}
    for(const quality of ['low','medium','high']){await evaluate(`__traffino.view.quality('${quality}')`);await sleep(250);const info=await evaluate(`(()=>{const v=__traffino.view;return {quality:'${quality}',calls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,geometries:v.renderer.info.memory.geometries,textures:v.renderer.info.memory.textures,finite:[v.cars,v.lights,v.people].every(m=>Array.from(m.instanceMatrix.array.slice(0,m.count*16)).every(Number.isFinite)),counts:{cars:v.cars.count,lights:v.lights.count,people:v.people.count}}})()`);check(quality+' bounded finite rendering',info.finite&&info.calls<140&&info.counts.cars<=112*55&&info.counts.lights<=112*10);budgets.push(info);await shot('night-'+quality);}
    await evaluate(`(()=>{const a=__traffino;a.view.quality('medium');a.game.timeOfDay=.42;a.view.zoom=3.2;a.view.baseAngle=.1;})()`);await sleep(500);await shot('vehicle-detail');
    const memory=await evaluate(`(()=>{const a=__traffino,v=a.view,g=a.game,maps=${JSON.stringify(INTERSECTIONS)};v.vehiclePreviews();const counts=[];for(let i=0;i<24;i++){v.setMap(maps[i%2]);v.render(g,.016,a.viewSettings());if(i%2)counts.push({...v.renderer.info.memory});}return counts;})()`);check('district swaps and previews keep GPU resources bounded',memory.at(-1).geometries<=memory[0].geometries+1&&memory.at(-1).textures<=memory[0].textures+1);
    check('audio unlocked from input',await evaluate('__traffino.audio.ctx?.state==="running"'));await evaluate('__traffino.externalPause("focus",true)');await sleep(100);check('all audio suspended on focus loss',await evaluate('__traffino.audio.ctx.state==="suspended"'));
    check('art no console exceptions',!errors.length);await writeFile('artifacts/visual-report.json',JSON.stringify({checks,budgets,errors,environment:'Chrome headless / SwiftShader, not real hardware FPS'},null,2));console.log('Visual PASS: '+checks.length+' checks');
  }else{
  await shot(production?'production-menu':'desktop-menu');
  for(const [w,h] of [[320,568],[390,844],[568,320],[844,390]]){
    await viewport(w,h);
    const menu=await evaluate(`(()=>{const start=document.querySelector('.hero .start').getBoundingClientRect(),modes=document.querySelector('.mode-grid').getBoundingClientRect(),nav=document.querySelector('.menu-bottom').getBoundingClientRect();return {start:start.toJSON(),modes:modes.toJSON(),nav:nav.toJSON(),valid:start.top>=0&&start.bottom<=modes.top&&modes.bottom<=nav.top&&nav.bottom<=innerHeight};})()`);
    check(`menu controls ${w}x${h}: ${JSON.stringify(menu)}`,menu.valid);
    if(w===320||w===844)await shot((production?'production':'development')+`-menu-${w}`);
  }
  await viewport(1280,720);
  await click('[data-action="continue"]');await wait('document.querySelector(".brief")');await click('[data-action="startStory"]');await wait('document.querySelector("#road-0")');
  if(production){check('development APIs excluded',await evaluate('typeof __traffino==="undefined"'));}
  else {await evaluate(`window.__playTest=${playBot.toString()}`);}
  for(const [w,h] of [[320,568],[390,844],[568,320],[844,390],[1024,768],[1280,720],[1280,800],[1920,1080],[2560,1080]]) {
    await viewport(w,h);
    const layout=await evaluate(`(()=>{const controls=[...document.querySelectorAll('.road-control')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});return {controls,scroll:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight,canvas:document.querySelector('canvas').getBoundingClientRect().width};})()`);
    check(`layout ${w}x${h}: ${JSON.stringify(layout)}`,layout.canvas>0&&layout.scroll<=w+1&&layout.controls.every(r=>r.left>=0&&r.top>=0&&r.right<=w+1&&r.bottom<=h+1&&r.width>=44&&r.height>=44));
    check(`unobstructed road controls ${w}x${h}`,await evaluate(`(()=>{const obstacles=[document.querySelector('.hud'),document.querySelector('#mentor')].filter(e=>!e.hidden).map(e=>e.getBoundingClientRect());return [...document.querySelectorAll('.road-control')].every(e=>{const r=e.getBoundingClientRect();return obstacles.every(o=>r.right<=o.left||r.left>=o.right||r.bottom<=o.top||r.top>=o.bottom);});})()`));
    if(w===390)await shot(production?'production-mobile':'mobile-gameplay');
    if(w===844)await shot(production?'production-landscape':'mobile-landscape');
  }
  await viewport(1280,720);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  await wait('document.querySelector("#road-0").getAttribute("aria-pressed")==="true"');checks.push('keyboard command');
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const touch=await evaluate('(()=>{const r=document.querySelector("[data-action=pause]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait('document.querySelector(".pause-card")');checks.push('touchscreen button input');
  const pausedTime=production?null:await evaluate('__traffino.game.time');await sleep(150);
  check('gameplay stop on pause',await evaluate('__sdkQA.stops>=1'));
  if(!production)check('simulation frozen on pause',await evaluate('__traffino.game.time')===pausedTime);
  await evaluate('__sdkListeners.game_api_pause();__sdkListeners.game_api_resume();');check('SDK resume preserves manual pause',await evaluate('!!document.querySelector(".pause-card")'));
  await click('[data-action="photo"]');await wait('document.querySelector(".photo-controls")');await click('[data-action="hidePhoto"]');
  check('photo hides the entire interface',await evaluate('getComputedStyle(document.querySelector(".photo-controls")).display==="none"&&getComputedStyle(document.querySelector(".photo-reveal")).display==="none"'));
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:600,y:350,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:600,y:350,button:'left',clickCount:1});await wait('!document.querySelector(".photo-hidden")');await click('[data-action="exitPhoto"]');await click('[data-action="settings"]');
  await evaluate(`(()=>{const e=document.querySelector('[data-setting="language"]');e.value='en';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  check('English settings',await evaluate('document.documentElement.lang==="en"&&document.querySelector("h1").textContent==="Settings"'));
  await click('[data-action="back"]');await click('[data-action="resume"]');await wait('document.querySelector("#road-0")');
  await evaluate('window.dispatchEvent(new Event("blur"))');await wait('document.querySelector(".pause-card")');await evaluate('window.dispatchEvent(new Event("focus"))');check('focus return stays paused',await evaluate('!!document.querySelector(".pause-card")'));
  await click('[data-action="resume"]');await evaluate('__sdkListeners.game_api_pause()');await wait('document.querySelector(".pause-card")');await evaluate('__sdkListeners.game_api_resume()');await wait('document.querySelector("#road-0")');checks.push('platform-only pause resumes');
  if(!production) {
    for(let shift=0;shift<8;shift++) {
      const result=await evaluate('(()=>{const a=__traffino;__playTest(a.game);return {reason:a.game.reason,medal:a.reward?.medal,coins:a.progress.data.coins};})()');
      check(`browser shift ${shift+1} completion`,result.reason==='complete'&&result.medal>0);await wait('document.querySelector(".results")');
      if(shift<7){await click('[data-action="brief"]');await click('[data-action="startStory"]');await wait('__traffino.screen==="gameplay"');}
    }
    await shot('results');await click('[data-action="menu"]');await click('[data-action="challenges"]');await click('[data-action="challengeTab"][data-value="session"]');
    const before=await evaluate('__traffino.progress.data.coins');await click('[data-action="claim"][data-value="cars:session"]');check('session reward claim',await evaluate('__traffino.progress.data.coins')>before);
    await click('[data-action="back"]');await click('[data-action="progress"]');await click('[data-action="buy"][data-value="coral"]');await click('[data-action="map"][data-value="harbor"]');check('cosmetic and district selection',await evaluate('__traffino.progress.data.selectedCosmetic==="coral"&&__traffino.progress.data.map==="harbor"'));
    const saved=await evaluate('JSON.stringify({coins:__traffino.progress.data.coins,story:__traffino.progress.data.story,skin:__traffino.progress.data.selectedCosmetic})');await cdp('Page.reload',{ignoreCache:true});await wait('window.__traffino&&document.querySelector(".hero")');check('save restored after reload',await evaluate('JSON.stringify({coins:__traffino.progress.data.coins,story:__traffino.progress.data.story,skin:__traffino.progress.data.selectedCosmetic})')===saved);
    for(const mode of ['endless','rush','hardcore']){await click(`[data-action="play"][data-value="${mode}"]`);await wait('__traffino.screen==="gameplay"');check(mode+' mode starts',await evaluate(`__traffino.game.mode===${JSON.stringify(mode)}`));await click('[data-action="pause"]');await click('[data-action="finish"]');await click('[data-action="confirmFinish"]');await wait('document.querySelector(".results")');await click('[data-action="menu"]');}
    await click('[data-action="settings"]');await click('[data-action="reset"]');await click('[data-action="cancelConfirm"]');check('reset cancellation preserves progress',await evaluate('__traffino.progress.data.story[7]>0'));await click('[data-action="reset"]');await click('[data-action="confirmReset"]');check('confirmed reset',await evaluate('__traffino.progress.data.coins===0&&__traffino.progress.data.story.every(v=>v===0)'));
  }
  if(release){
    const saved={...freshSave(),version:1,story:Array(8).fill(1),coins:300,reputation:1000,updatedAt:Date.now(),collection:Object.fromEntries(Object.keys(VEHICLES).map(k=>[k,{seen:2,passed:1}]))};
    const fixture=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.search.includes('release-fixture')){localStorage.removeItem(${JSON.stringify(SAVE_KEY+'.backup')});localStorage.setItem(${JSON.stringify(SAVE_KEY)},${JSON.stringify(JSON.stringify(saved))});}`});await cdp('Page.navigate',{url:url+'?release-fixture'});await wait('document.querySelector(".hero")');await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
    await click('[data-action="collection"]');await wait('document.querySelectorAll(".vehicle-preview").length===13');check('13 real model previews',await evaluate('Array.from(document.querySelectorAll(".vehicle-preview")).every(i=>i.complete&&i.naturalWidth===240)'));await shot('release-garage');await click('[data-action="back"]');
    for(const mode of ['endless','rush','hardcore']){
      await click(`[data-action="play"][data-value="${mode}"]`);await wait('document.querySelector("#road-0")');await click('[data-action="pause"]');await click('[data-action="photo"]');
      await evaluate(`(()=>{const e=document.querySelector('[data-photo="filter"]');e.value='1';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);check(mode+' photo filter',await evaluate('document.querySelector("#world").style.filter.includes("sepia")'));
      await click('[data-action="exitPhoto"]');check(mode+' photo filter cleared',await evaluate('document.querySelector("#world").style.filter===""'));await click('[data-action="finish"]');await click('[data-action="confirmFinish"]');await wait('document.querySelector(".results")');
      const before=await evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).coins`);await click('[data-action="rewarded"]');await wait('document.querySelector("[data-action=rewarded]").disabled');check(mode+' rewarded exactly once',await evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).coins`)===before+25);await shot('release-results-'+mode);await click('[data-action="menu"]');
    }
    await click('[data-action="settings"]');await evaluate(`(()=>{const e=document.querySelector('[data-setting="language"]');e.value='en';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);check('one release identifier',await evaluate('document.querySelector(".panel").textContent.includes("1.0.0")'));await click('[data-action="back"]');
    for(const [w,h] of [[320,568],[568,320],[1280,720]]){await viewport(w,h);check(`English menu ${w}x${h}`,await evaluate('document.documentElement.scrollWidth<=innerWidth'));await shot('release-en-'+w);}
    await viewport(1280,720);await evaluate('window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error("storage blocked")};');await click('[data-action="play"][data-value="endless"]');await wait('document.querySelector("#road-0")');check('blocked local storage preserves playable UI',await evaluate('document.querySelector("#toast").textContent.includes("save")'));await evaluate('Storage.prototype.setItem=window.__setItem');
  }
  await cdp('Page.navigate',{url:url+'?local'});await wait('document.querySelector(".hero")');check('menu without platform SDK',await evaluate('typeof YaGames==="undefined"'));await click('[data-action="continue"]');await click('[data-action="startStory"]');await wait('document.querySelector("#road-0")');checks.push('gameplay without platform SDK');
  check('no console exceptions',errors.length===0);await writeFile(`artifacts/browser-${release?'release':production?'production':'development'}${process.env.CHROME_PATH?.includes('msedge')?'-edge':''}.json`,JSON.stringify({date:new Date().toISOString(),checks,errors,renderer:'Chromium headless / SwiftShader; layout and behavior verification, not physical GPU profiling'},null,2));console.log(`Browser ${production?'production':'development'} PASS: ${checks.length} checks`);
  }
} catch(error) {
  if(cdp)try{const image=await cdp('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/browser-failure.png',Buffer.from(image.data,'base64'));console.error(await evaluate('document.body.innerText'));}catch{}
  console.error('Console:',errors);throw error;
} finally {
  socket?.close();chrome.kill();server.close();await sleep(350);
  // Only this run's newly created temporary profile may be removed.
  const absolute=resolve(profile),base=resolve(tmpdir())+sep;
  if(absolute.startsWith(base)&&absolute.slice(base.length).startsWith('traffino-qa-'))await rm(absolute,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
