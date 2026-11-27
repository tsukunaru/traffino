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
const desktop=process.env.TRAFFINO_TEST_EXE;
if (!desktop) await buildGame(!production);await mkdir('artifacts',{recursive:true});
const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path==='/sdk.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end('/* local fallback */');return;}if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}const file=resolve(root,'.'+(path==='/'?'/index.html':decodeURIComponent(path)));if(!file.startsWith(root+sep))throw Error('path');res.writeHead(200,{'content-type':mime[extname(file)]??'text/plain','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
if (!desktop) await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=desktop?null:`http://127.0.0.1:${server.address().port}/`,profile=await mkdtemp(join(tmpdir(),'traffino-qa-'));
const chrome=spawn(desktop||process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[...(desktop?['--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion']:['--headless=new']),'--no-first-run','--no-default-browser-check','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0',`--user-data-dir=${profile}`,...(desktop?[]:['about:blank'])],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket,cdp,evaluate;const errors=[],checks=[];
try {
  let endpoint;
  for(let i=0;i<100;i++){try{const port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];const pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());endpoint=pages.find(p=>p.type==='page')?.webSocketDebuggerUrl;if(endpoint)break;}catch{}await sleep(100);}
  assert.ok(endpoint,'Chrome debugging endpoint');socket=new WebSocket(endpoint);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
  let id=0;const pending=new Map();
  socket.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
  cdp=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,{resolve,reject,timer:setTimeout(()=>{pending.delete(request);reject(Error('CDP timeout: '+method));},method==='Page.captureScreenshot'?60000:20000)});socket.send(JSON.stringify({id:request,method,params}));});
  evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const wait=async expression=>{for(let i=0;i<(desktop?650:180);i++){if(await evaluate(`Boolean(${expression})`))return;await sleep(60);}throw Error('Timeout: '+expression);};
  const click=async selector=>{const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Unavailable button: '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});};
  const learn=async id=>{
    await click('#skill-'+id);
    await click('[data-action="learn"][data-value="'+id+'"]');
  };
  const enterShift=async()=>{
    await click('[data-action="reply"][data-value="traffic"]');
    await wait('document.querySelector(".your-line")&&document.querySelector(".speech-balloon")===document.activeElement');
    await click('[data-action="startStory"]');
  };
  const shot=async(name,format='png')=>{const image=await cdp('Page.captureScreenshot',{format,...(format==='webp'?{quality:91}:{})});await writeFile('artifacts/'+name+'.'+format,Buffer.from(image.data,'base64'));};
  const viewport=async(w,h)=>{await cdp('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<h});await sleep(120);await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');};
  const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
  await cdp('Page.enable');await cdp('Runtime.enable');
  if (desktop) {
    await cdp('Page.bringToFront');
    await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
    await wait('document.querySelector(".hero")');
    check('standalone origin', await evaluate('location.href==="traffino://game/"'));
    check('local assets only', await evaluate('performance.getEntriesByType("resource").every(r=>r.name.startsWith("traffino:")||r.name.startsWith("data:"))'));
    await shot('steam-menu');
    await click('[data-action="settings"]');
    await evaluate(`(()=>{const e=document.querySelector('[data-setting="language"]');e.value='ru';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click('[data-action="back"]');
    await click('[data-action="continue"]'); await wait('document.querySelector(".mentor-print img")?.naturalWidth===640');
    check('Miro portrait in packaged briefing',await evaluate('document.querySelector(".mentor-print img").currentSrc.startsWith("traffino://game/")'));
    await shot('windows-mentor');await click('[data-action="reply"][data-value="duty"]');
    check('player can ask about pay before accepting',await evaluate('document.querySelector(".speech-balloon").textContent.includes("1 ◈")&&!!document.querySelector(".your-line")'));
    await enterShift();
    await wait('document.querySelector("#road-0")');
    check('first frame includes the mentor and road state',await evaluate('document.querySelector("#road-1").getAttribute("aria-pressed")==="false"&&document.querySelector("#mentor strong").textContent==="Открой северную дорогу."'));
    await click('#road-1');await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    check('first lesson waits for the correct road',await evaluate('document.querySelector("#road-1").getAttribute("aria-pressed")==="false"'));
    await click('#road-0'); await wait('document.querySelector("#road-0").getAttribute("aria-pressed")==="true"');
    await wait('Number(document.querySelector("#hud-score").dataset.score)>0');
    await wait('document.querySelector("#hud-pay").textContent.includes("1")');
    check('radio lesson advances on the first recorded car',await evaluate('document.querySelector("#mentor strong").textContent==="Закрой северную дорогу."&&!document.querySelector("#mentor").hidden'));
    await shot('steam-game');
    await click('[data-action="pause"]'); await click('[data-action="finish"]'); await click('[data-action="confirmFinish"]');
    await wait('document.querySelector(".results")'); check('ad-free results', await evaluate('!document.querySelector("[data-action=rewarded]")'));
    await cdp('Page.reload'); await wait('document.querySelector(".hero")');
    check('abandoning a shift preserves its records but pays zero', await evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('${SAVE_KEY}'));return s.runs===1&&s.totals.passed>=1&&s.coins===0&&s.career.served===0})()`));
    // Play a full first shift against the release HUD. Input follows its clock just like a player.
    await click('[data-action="settings"]');
    await evaluate(`(()=>{const q=document.querySelector('[data-setting="quality"]');q.value='low';q.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click('[data-action="back"]');await click('[data-action="continue"]');await enterShift();
    await click('#road-0');await wait('Number(document.querySelector("#hud-score").dataset.score)>0');
    await click('#road-0');await wait('document.querySelector("#road-0").getAttribute("aria-pressed")==="false"');
    await click('#road-1');await wait('document.querySelector("#road-1").getAttribute("aria-pressed")==="true"');
    await evaluate(`(()=>{let previous=-1;function operate(){
      const clock=document.querySelector('#hud-time');if(!clock)return;
      const [m,s]=clock.textContent.split(':').map(Number),elapsed=60-m*60-s;
      if(elapsed!==previous){previous=elapsed;for(let d=0;d<4;d++){
        const b=document.querySelector('#road-'+d),go=elapsed%10<6&&d%2===1-Math.floor(elapsed/10)%2;
        if((b.getAttribute('aria-pressed')==='true')!==go)b.click();
      }}requestAnimationFrame(operate);
    }operate();})()`);
    const deadline=Date.now()+240000;
    while(!await evaluate('!!document.querySelector(".results")')&&Date.now()<deadline)await sleep(500);
    check('completed shift pays the displayed total into the saved wallet',await evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('${SAVE_KEY}')),coins=document.querySelector('.result-grid div:last-child strong');return s.story[0]>0&&s.career.served>=5&&s.coins===Number(coins?.textContent)&&s.coins>s.career.served;})()`));
    await shot('windows-paid-duty');
    // Upgrade an older playtest profile through the packaged UI in this disposable browser profile.
    const legacy={...freshSave(),version:2,coins:149,story:[2,0,0,0,0,0,0,0],totals:{passed:90},updatedAt:Date.now()};
    legacy.settings.language='ru';
    const previousBoot=await evaluate('performance.timeOrigin');
    await evaluate(`localStorage.setItem(${JSON.stringify(SAVE_KEY)},${JSON.stringify(JSON.stringify(legacy))})`);
    await cdp('Page.reload');await wait(`performance.timeOrigin>${previousBoot}&&document.querySelector(".hero")`);await click('[data-action="progress"]');
    await learn('ledger');await learn('dividend');
    await click('#skill-cleanPay');
    await evaluate('document.querySelector(".talent-title").scrollIntoView({block:"start"})');
    await wait('!document.querySelector("#toast").classList.contains("show")');
    await shot('talents-ru','webp');
    await click('[data-action="review"][data-value="ledger"]');
    check('review quotes balance and next rate',await evaluate('document.querySelector(".promotion-terms").textContent.includes("◈ 5 → 0")&&document.querySelector(".promotion-terms").textContent.includes("◈ 3")'));
    await shot('windows-promotion');await click('[data-action="confirmPromotion"]');
    await cdp('Page.reload');await wait('document.querySelector(".hero")');await click('[data-action="progress"]');
    check('Windows promotion survives restart with medals',await evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('${SAVE_KEY}'));return s.coins===0&&s.story[0]===2&&s.career.certified.join()==='ledger'&&!s.career.learned.length&&document.querySelector('.service-banner h1').textContent==='Старший регулировщик';})()`));
    await click('[data-action="back"]');await click('[data-action="dispatch"]');
    await click('[data-action="takeDispatch"][data-value="repair"]');
    await wait('document.querySelector("#event-banner")?.textContent.includes("Поломка автобуса")');
    await click('#road-0');await wait('document.querySelector("#road-0").getAttribute("aria-pressed")==="true"&&document.querySelector("#hud-time").textContent<"2:29"');
    await click('#road-2');await wait('document.querySelector("#road-2 .signal-state").textContent==="Ожидает"');
    await wait('document.querySelector("#road-2").getAttribute("aria-pressed")==="true"');
    check('packaged highway hands the lane to the second convoy',await evaluate('document.querySelector("#road-0").getAttribute("aria-pressed")==="false"&&document.querySelector("#road-1").hidden'));
    check('no runtime errors', !errors.length);
    console.log('Windows desktop PASS:', checks);
  } else {
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.__sdkQA={ready:0,starts:0,stops:0,ads:0,saves:0};window.__sdkListeners={};window.YaGames={init:async()=>({environment:{i18n:{lang:'ru'}},serverTime:()=>Date.now(),features:{LoadingAPI:{ready:()=>__sdkQA.ready++},GameplayAPI:{start:()=>__sdkQA.starts++,stop:()=>__sdkQA.stops++}},on:(n,cb)=>__sdkListeners[n]=cb,getPlayer:async()=>({getData:async()=>({}),setData:async()=>{__sdkQA.saves++;}}),isAvailableMethod:async()=>false,adv:{showFullscreenAdv:({callbacks:c})=>{__sdkQA.ads++;c.onOpen();setTimeout(()=>c.onClose(true),20);},showRewardedVideo:({callbacks:c})=>{c.onOpen();c.onRewarded();c.onClose();}}})};`});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:'if(location.search.includes("local"))delete window.YaGames;'});
  await viewport(1280,720);await cdp('Page.navigate',{url});await wait('document.querySelector(".hero")');
  check('ready once with interactive menu',await evaluate('__sdkQA.ready===1'));
  check('station sign and Cyrillic font loaded',await evaluate('document.querySelector(".street-sign").textContent==="Traffino"&&document.fonts.check("900 24px Nunito")'));
  if(process.argv.includes('--highway')){
    await wait('window.__traffino');await evaluate('document.querySelector(".debug-panel").hidden=true');
    await click('[data-action="dispatch"]');await click('[data-action="takeDispatch"][data-value="crash"]');
    await wait('__traffino.game?.highway&&document.querySelector("#road-0")');
    check('highway has only two entrance controls',await evaluate('document.querySelector("#road-1").hidden&&document.querySelector("#road-3").hidden&&__traffino.view.map.id==="highway"'));
    const entrance=await evaluate(`(()=>{const a=__traffino,p=a.view.project(-a.game.map.lane,-19,.22);return {x:p.x,y:p.y};})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...entrance,button:'left',clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...entrance,button:'left',clickCount:1});
    await wait('__traffino.game.signals[0]&&__traffino.game.vehicles.some(v=>v.active&&v.committed)');
    checks.push('clicking the actual north entrance releases its convoy');
    await click('#road-2');await wait('__traffino.game.highway.requested===2&&__traffino.game.signals.every(s=>!s)');
    await wait('document.querySelector("#road-2").classList.contains("is-pending")');
    await wait('__traffino.game.signals[2]');checks.push('opposite entrance opens after real input and lane clearance');
    await click('[data-action="pause"]');await click('[data-action="finish"]');await click('[data-action="confirmFinish"]');await click('[data-action="menu"]');
    check('district is restored on return',await evaluate('__traffino.view.map.id===__traffino.demo.map.id'));
    await click('[data-action="dispatch"]');await click('[data-action="takeDispatch"][data-value="crash"]');
    await evaluate(`(()=>{const a=__traffino;a.pause.set('capture',true);const g=a.game,v=a.view;
      g.command({type:'toggle',direction:0});v.baseAngle=.37;v.cameraAngle=.79;v.currentZoom=v.zoom=1.28;v.setProjection();
      const movie=document.createElement('canvas');movie.width=960;movie.height=540;
      const ctx=movie.getContext('2d'),stream=movie.captureStream(0),track=stream.getVideoTracks()[0],chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1800000});
      recorder.ondataavailable=e=>chunks.push(e.data);
      window.finishMovie=new Promise(resolve=>{recorder.onstop=async()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));track.stop();};});
      window.recordBatch=async(start,count)=>{for(let i=start;i<start+count;i++){
        if(i===35)g.command({type:'toggle',direction:2});for(let j=0;j<10;j++)g.tick();
        v.render(g,1/12,a.viewSettings());a.ui.updateHUD();
        ctx.fillStyle='#dad5c3';ctx.fillRect(0,0,960,540);ctx.drawImage(v.canvas,0,0,960,540);
        ctx.fillStyle='#253f39';ctx.fillRect(0,482,960,58);ctx.fillStyle='#fff0ca';ctx.font='800 19px Nunito';ctx.textAlign='center';
        ctx.fillText(document.querySelector('#event-banner').textContent,480,517,930);
        track.requestFrame();await new Promise(r=>setTimeout(r,65));
      }};
      recorder.start();window.stopMovie=()=>recorder.stop();
    })()`);
    for(let i=0;i<108;i+=12){
      await evaluate('recordBatch('+i+',12)');
      if(i===12)await shot('highway','webp');
    }
    await evaluate('stopMovie()');const movie=await evaluate('finishMovie');
    await writeFile('artifacts/highway-convoys.webm',Buffer.from(movie.split(',')[1],'base64'));
    check('recording shows both convoys completing the same lane',await evaluate('__traffino.game.stats.northConvoy>=2&&__traffino.game.stats.southConvoy>=2&&__traffino.game.stats.collisions===0'));
    check('highway clean console',errors.length===0);console.log('Highway PASS: '+checks.length+' checks');
  }else if(art){
    await wait('window.__traffino');await evaluate('document.querySelector(".debug-panel").hidden=true');await shot('visual-menu');await shot('town-menu','webp');
    for(const [w,h] of [[320,568],[390,844],[568,320],[844,390],[1024,768],[1280,720],[1920,1080]]){await viewport(w,h);check(`art menu fits ${w}x${h}`,await evaluate(`(()=>{const a=document.querySelector('.start').getBoundingClientRect(),b=document.querySelector('.mode-grid').getBoundingClientRect(),c=document.querySelector('.menu-bottom').getBoundingClientRect();return a.bottom<=b.top&&b.bottom<=c.top&&c.bottom<=innerHeight;})()`));if(w===390||w===568)await shot('visual-menu-'+w);}
    await viewport(1440,900);await click('[data-action="continue"]');await enterShift();await evaluate(`(()=>{const a=__traffino,g=a.game;g.director=false;g.clearTraffic();g.tutorial=4;a.show('photo');document.querySelector('#app').classList.add('photo-hidden');g.spawn(2,'taxi',0);for(let i=0;i<180;i++)g.tick();g.timeOfDay=.41;})()`);
    const budgets=[];
    await evaluate(`(()=>{const a=__traffino,g=a.game;g.triggerEvent('works',2);a.view.render(g,0,a.viewSettings());a.photoSetting('subject',3);})()`);
    await wait('Math.abs(__traffino.view.currentZoom-4)<.03');
    check('two helmeted workers wait off road during the warning',await evaluate('__traffino.game.event.phase==="warning"&&__traffino.view.crowd.at(-1).body.count===2'));
    await evaluate(`(()=>{const a=__traffino,g=a.game;g.updateEvent(4);g.updateEvent(.02);a.view.render(g,0,a.viewSettings());a.photoSetting('subject',3);document.querySelector('#app').classList.add('photo-hidden');})()`);
    check('worksite deploys on the closed exit within scene budget',await evaluate('__traffino.game.event.phase==="active"&&__traffino.view.crowd.at(-1).body.count===2&&__traffino.view.renderer.info.render.calls<140'));
    await wait('Math.abs(__traffino.view.cameraAngle-(__traffino.view.baseAngle+.42))<.02');await shot('roadworks','webp');
    await evaluate(`(()=>{const a=__traffino,g=a.game;g.event=null;g.clearTraffic();g.signals.fill(false);const runner=g.spawn(0,'reckless',0);while(runner.runnerAt===null&&g.time<20)g.tick();g.spawn(1,'car',0);for(let i=0;i<204;i++)g.tick();g.command({type:'toggle',direction:1});for(let i=0;i<300&&!g.stats.collisions;i++)g.tick();a.view.render(g,0,a.viewSettings());a.photoSetting('subject',3);document.querySelector('#app').classList.add('photo-hidden');})()`);
    check('two actual wrecks and an incident camera after running red',await evaluate('__traffino.game.vehicles.filter(v=>v.active&&v.crashLeft>0).length===2&&!!document.querySelector(\'[data-photo="subject"] option[value="3"]\')'));
    await wait('Math.abs(__traffino.view.cameraAngle-(__traffino.view.baseAngle+.42))<.02');await shot('collision-scene','webp');
    await evaluate(`(()=>{const a=__traffino,g=a.game;g.director=false;g.clearTraffic();a.show('photo');document.querySelector('#app').classList.add('photo-hidden');const kinds=Object.keys(a.view.models);kinds.forEach((kind,i)=>{const v=g.spawn(i%4,kind,i%3);if(v){v.s=30;v.x=[-1.8,14,1.8,-14][i%4]+(i%4%2?Math.floor(i/4)*4:0);v.z=[-14,-1.8,14,1.8][i%4]+(i%4%2?0:Math.floor(i/4)*4);v.dx=i%4===1?-1:i%4===3?1:0;v.dz=i%4===0?1:i%4===2?-1:0;v.speed=4;}});g.waitingPeople=[3,2,1,2];g.people[0].active=true;Object.assign(g.people[0],{x:1,z:-6.8,t:.5,direction:0});g.signals[0]=true;g.signals[2]=true;})()`);
    for(const [subject,name] of [[1,'officer'],[2,'residents']]){
      await evaluate(`(()=>{const a=__traffino;a.photoSetting('subject',${subject});a.game.timeOfDay=.41;a.game.time=7.1;if(${subject}===1){a.view.event('directionOpened',{direction:0});a.view.heroAngle=a.view.heroFacing;a.view.baseAngle=a.view.heroFacing-.16;}else a.view.baseAngle=.50;document.querySelector('#app').classList.add('photo-hidden');})()`);
      await wait('Math.abs(__traffino.view.currentZoom-__traffino.view.zoom)<.035');
      await shot('model-'+name,'webp');
    }
    await evaluate('__traffino.photoSetting("subject",0);document.querySelector("#app").classList.add("photo-hidden")');
    await wait('Math.abs(__traffino.view.currentZoom-1)<.03');
    for(const [name,time] of [['day',.42],['sunset',.75],['night',.94]]){await evaluate(`__traffino.game.timeOfDay=${time}`);await sleep(250);await shot('city-'+name);if(name==='day')await shot('town-city','webp');}
    for(const quality of ['low','medium','high']){await evaluate(`(()=>{const a=__traffino;a.view.quality('${quality}');a.view.render(a.game,.016,a.viewSettings());})()`);const info=await evaluate(`(()=>{const v=__traffino.view;return {quality:'${quality}',calls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,geometries:v.renderer.info.memory.geometries,textures:v.renderer.info.memory.textures,finite:[v.cars,v.lights,...v.crowdBatches].every(m=>Array.from(m.instanceMatrix.array.slice(0,m.count*16)).every(Number.isFinite)),counts:{cars:v.cars.count,lights:v.lights.count,people:v.crowdBatches.reduce((sum,m)=>sum+m.count,0)}}})()`);check(quality+' bounded finite rendering',info.finite&&info.calls<140&&info.counts.cars<=112*55&&info.counts.lights<=112*10);budgets.push(info);await shot('night-'+quality);}
    await evaluate(`(()=>{const a=__traffino;a.view.quality('medium');a.game.timeOfDay=.42;a.view.zoom=3.2;a.view.baseAngle=.1;})()`);await sleep(500);await shot('vehicle-detail');
    for (const map of INTERSECTIONS) {
      await evaluate(`(()=>{const a=__traffino;a.view.setMap(${JSON.stringify(map)});a.view.zoom=.9;a.view.baseAngle=.1;a.game.timeOfDay=.42;})()`);
      await sleep(600); await shot('steam-'+map.id);
    }
    const equipped=await evaluate(`(()=>{const a=__traffino,v=a.view;v.setMap(${JSON.stringify(INTERSECTIONS[0])},{learned:['radio','dividend'],certified:['board','ledger']});v.render(a.game,.016,a.viewSettings());return v.renderer.info.render.calls;})()`);
    check('fully equipped station stays within draw budget',equipped<140);
    await evaluate('__traffino.show("menu");__traffino.action("progress");__traffino.action("postView")');
    await wait('Math.abs(__traffino.view.currentZoom-__traffino.view.zoom)<.04&&Math.abs(__traffino.view.cameraAngle-(__traffino.view.baseAngle+.42))<.02');
    await shot('station-detail');
    await evaluate('__traffino.action("back");__traffino.show("photo")');
    check('low quality reduces triangles',budgets[0].triangles<budgets[1].triangles);
    const memory=await evaluate(`(()=>{const a=__traffino,v=a.view,g=a.game,maps=${JSON.stringify(INTERSECTIONS)};v.currentZoom=v.zoom=1;v.cameraAngle=.42;v.baseAngle=0;v.setProjection();v.vehiclePreviews();const counts=[];for(let i=0;i<24;i++){v.setMap(maps[i%2]);v.render(g,.016,a.viewSettings());if(i%2)counts.push({...v.renderer.info.memory});}return counts;})()`);check(`district swaps and previews keep GPU resources bounded: ${JSON.stringify([memory[0],memory.at(-1)])}`,memory.at(-1).geometries<=memory[0].geometries+1&&memory.at(-1).textures<=memory[0].textures+1);
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
  await click('[data-action="continue"]');await wait('document.querySelector(".mentor-print img")?.naturalWidth===640');await click('[data-action="reply"][data-value="duty"]');await shot('mentor-briefing');
  if(!production){
    await viewport(390,844);await shot('mentor-phone');await viewport(568,320);
    check('compact briefing reachable without horizontal scroll',await evaluate('document.querySelector(".panel").scrollWidth<=document.querySelector(".panel").clientWidth+1'));
    await viewport(1280,720);
  }
  await enterShift();await wait('document.querySelector("#road-0")');
  if(production){check('development APIs excluded',await evaluate('typeof __traffino==="undefined"'));}
  else {await evaluate(`window.__playTest=${playBot.toString()}`);}
  for(const [w,h] of [[320,568],[390,844],[568,320],[844,390],[1024,768],[1280,720],[1280,800],[1920,1080],[2560,1080]]) {
    await viewport(w,h);
    const layout=await evaluate(`(()=>{const controls=[...document.querySelectorAll('.road-control')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});return {controls,scroll:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight,canvas:document.querySelector('canvas').getBoundingClientRect().width};})()`);
    check(`layout ${w}x${h}: ${JSON.stringify(layout)}`,layout.canvas>0&&layout.scroll<=w+1&&layout.controls.every(r=>r.left>=0&&r.top>=0&&r.right<=w+1&&r.bottom<=h+1&&r.width>=44&&r.height>=44&&r.width<=54&&r.height<=54));
    check(`unobstructed road controls ${w}x${h}`,await evaluate(`(()=>{const obstacles=[document.querySelector('.hud'),document.querySelector('#mentor')].filter(e=>!e.hidden).map(e=>e.getBoundingClientRect());return [...document.querySelectorAll('.road-control')].every(e=>{const r=e.getBoundingClientRect();return obstacles.every(o=>r.right<=o.left||r.left>=o.right||r.bottom<=o.top||r.top>=o.bottom);});})()`));
    if(w===390){await shot(production?'production-mobile':'mobile-gameplay');if(production)await shot('town-mobile','webp');}
    if(w===844)await shot(production?'production-landscape':'mobile-landscape');
  }
  await viewport(1280,720);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  await wait('document.querySelector("#road-0").getAttribute("aria-pressed")==="true"');checks.push('keyboard command');
  if(!production){
    check('only inbound asphalt takes a direction',await evaluate(`(()=>{const {view:v,game:g}=__traffino;
      const hit=(x,z)=>{const p=v.project(x,z,.22);return v.roadAt(p.x,p.y,g.directions);};
      return [hit(-1.7,-18),hit(18,-1.7),hit(1.7,18),hit(-18,1.7)].join()==='0,1,2,3' && [hit(0,0),hit(14,14),hit(1.7,-18)].every(d=>d===undefined);})()`));
  }
  await shot('signals','webp');
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await wait('Number(document.querySelector("#hud-score").dataset.score)>0');
  const north=await evaluate('(()=>{const r=document.querySelector("#road-0").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[north]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await wait('document.querySelector("#road-0").getAttribute("aria-pressed")==="false"');checks.push('touch toggles a compact signal');
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
      if(shift<=2){
        await click('[data-action="progress"]');
        await wait('document.querySelector(".service-banner")');
        if(shift===0)check('first duty starts savings for three specialities',await evaluate('document.querySelectorAll(".skill-branch").length===3&&document.querySelectorAll("[data-action=learn]:enabled").length===0'));
        else {
          const root=shift===1?'board':'ledger';
          await learn(root);
          check(root+' charged once and fitted in city',await evaluate('__traffino.view.postSkills.has("'+root+'")&&__traffino.progress.data.coins')===result.coins-48);
        }
        await click('[data-action="back"]');await wait('document.querySelector(".results")');
      }
      if(shift<7){await click('[data-action="brief"]');await enterShift();await wait('__traffino.screen==="gameplay"');}
    }
    await shot('results');await click('[data-action="menu"]');await click('[data-action="challenges"]');await click('[data-action="challengeTab"][data-value="session"]');
    const before=await evaluate('__traffino.progress.data.reputation');await click('[data-action="claim"][data-value="cars:session"]');check('session reputation claim',await evaluate('__traffino.progress.data.reputation')>before);
    await click('[data-action="back"]');await click('[data-action="progress"]');await click('[data-action="buy"][data-value="coral"]');await click('[data-action="map"][data-value="harbor"]');check('cosmetic and district selection',await evaluate('__traffino.progress.data.selectedCosmetic==="coral"&&__traffino.progress.data.map==="harbor"'));
    await click('#skill-priority');
    check('capstone lists both missing talents',await evaluate('document.querySelector("#detail-board small").textContent.includes("Dispatch radio + Steady rhythm") && document.querySelector("[data-value=priority][data-action=learn]").disabled'));
    await learn('radio');
    await click('#skill-priority');
    check('capstone still needs the sibling',await evaluate('document.querySelector("#detail-board small").textContent.endsWith("Steady rhythm")'));
    await learn('dividend');
    await click('#skill-survey');
    await evaluate('document.querySelector(".talent-title").scrollIntoView({block:"start"})');
    await shot('talents','webp');
    await click('[data-action="postView"]');await wait('Math.abs(__traffino.view.currentZoom-__traffino.view.zoom)<.04&&Math.abs(__traffino.view.cameraAngle-(__traffino.view.baseAngle+.42))<.02');
    check('tour shows equipped station',await evaluate('__traffino.view.inspectPost&&__traffino.view.postSkills.size===4'));
    await shot('duty-station');await click('[data-action="back"]');
    await viewport(390,844);await learn('rhythm');
    await click('#skill-priority');
    check('mobile tree spends shift wages and discloses the remaining price',await evaluate('document.querySelector(".panel").scrollWidth<=document.querySelector(".panel").clientWidth+1 && !document.querySelector("#skill-priority").classList.contains("locked") && document.querySelector("#detail-board small").textContent.includes("Still needed")'));
    await viewport(1280,720);
    const purse=await evaluate('__traffino.progress.data.coins');
    await click('[data-action="review"][data-value="board"]');
    check('promotion gives cancellation keyboard focus',await evaluate('document.activeElement.dataset.action==="cancelConfirm"'));
    await click('[data-action="cancelConfirm"]');
    check('declining keeps savings and restores focus',await evaluate('__traffino.progress.data.coins')===purse&&await evaluate('document.activeElement.dataset.action==="review"'));
    await click('[data-action="review"][data-value="board"]');await click('[data-action="confirmPromotion"]');
    check('promotion keeps medals, resets wallet and returns temporary gear',await evaluate('__traffino.progress.grade===1&&__traffino.progress.payRate===2&&__traffino.progress.data.coins===0&&__traffino.progress.data.story.every(Boolean)&&__traffino.view.postSkills.size===1'));
    const saved=await evaluate('JSON.stringify({coins:__traffino.progress.data.coins,story:__traffino.progress.data.story,skin:__traffino.progress.data.selectedCosmetic})');await cdp('Page.reload',{ignoreCache:true});await wait('window.__traffino&&document.querySelector(".hero")');check('save restored after reload',await evaluate('JSON.stringify({coins:__traffino.progress.data.coins,story:__traffino.progress.data.story,skin:__traffino.progress.data.selectedCosmetic})')===saved);
    check('certified board survives restart',await evaluate('__traffino.view.postSkills.has("board")&&__traffino.progress.grade===1'));
    for(const mode of ['endless','rush','hardcore']){await click(`[data-action="play"][data-value="${mode}"]`);await wait('__traffino.screen==="gameplay"');check(mode+' mode starts',await evaluate(`__traffino.game.mode===${JSON.stringify(mode)}`));
      if(mode==='hardcore'){
        await evaluate(`(()=>{const a=__traffino,g=a.game;g.director=false;g.clearTraffic();const x=g.spawn(0,'car',0),y=g.spawn(1,'taxi',0);x.s=g.map.extent-g.map.lane-2;y.s=g.map.extent+g.map.lane-2;for(const car of [x,y]){car.committed=true;car.speed=5;}for(let i=0;i<60&&g.running;i++)g.tick();})()`);
        await wait('document.activeElement.dataset.action==="report"');
        check('terminal collision stays on the 3D scene until acknowledged',await evaluate('__traffino.view.photoSubject==="incident"&&__traffino.reward.coins===0'));
        await click('[data-action="report"]');await wait('document.querySelector(".results")');await click('[data-action="menu"]');continue;
      }
      if(mode==='endless'){
        const turns=await evaluate(`(()=>{const a=__traffino,g=a.game;g.clearTraffic();g.spawn(0,'car',0).s=12;g.spawn(0,'taxi',2);g.tick();a.ui.updateHUD();return document.querySelector('#road-0 .turn-arrow').textContent;})()`);
        check('certified board previews actual second vehicle turn',turns==='↑ › ↱');
        await evaluate(`(()=>{const a=__traffino,g=a.game;g.director=false;g.clearTraffic();g.triggerEvent('works',2);g.updateEvent(4);g.updateEvent(.1);const car=g.spawn(0,'car',0);car.s=car.route.entry-4;g.tick();a.ui.updateHUD();})()`);
        await wait('document.querySelector("#detour")&&!document.querySelector("#detour").hidden');await click('#detour');
        await wait('__traffino.game.lanes[0][0].route.exit!==2');
        check('roadworks button gives the driver a detour while keeping the signal red',await evaluate('!__traffino.game.signals[0]&&!__traffino.game.lanes[0][0].committed'));
      }
      await click('[data-action="pause"]');await click('[data-action="finish"]');await click('[data-action="confirmFinish"]');await wait('document.querySelector(".results")');await click('[data-action="menu"]');}
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
      check(mode+' no payout or ad on incomplete duty',await evaluate(`!document.querySelector('[data-action=rewarded]')&&JSON.parse(localStorage.getItem('${SAVE_KEY}')).coins===300`));await shot('release-results-'+mode);await click('[data-action="menu"]');
    }
    await click('[data-action="settings"]');await evaluate(`(()=>{const e=document.querySelector('[data-setting="language"]');e.value='en';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);check('one release identifier',await evaluate('document.querySelector(".panel").textContent.includes("1.0.0")'));await click('[data-action="back"]');
    for(const [w,h] of [[320,568],[568,320],[1280,720]]){await viewport(w,h);check(`English menu ${w}x${h}`,await evaluate('document.documentElement.scrollWidth<=innerWidth'));await shot('release-en-'+w);}
    await viewport(1280,720);await evaluate('window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error("storage blocked")};');await click('[data-action="play"][data-value="endless"]');await wait('document.querySelector("#road-0")');check('blocked local storage preserves playable UI',await evaluate('document.querySelector("#toast").textContent.includes("save")'));await evaluate('Storage.prototype.setItem=window.__setItem');
  }
  await cdp('Page.navigate',{url:url+'?local'});await wait('document.querySelector(".hero")');check('menu without platform SDK',await evaluate('typeof YaGames==="undefined"'));await click('[data-action="continue"]');await enterShift();await wait('document.querySelector("#road-0")');checks.push('gameplay without platform SDK');
  check('no console exceptions',errors.length===0);await writeFile(`artifacts/browser-${release?'release':production?'production':'development'}${process.env.CHROME_PATH?.includes('msedge')?'-edge':''}.json`,JSON.stringify({date:new Date().toISOString(),checks,errors,renderer:'Chromium headless / SwiftShader; layout and behavior verification, not physical GPU profiling'},null,2));console.log(`Browser ${production?'production':'development'} PASS: ${checks.length} checks`);
  }
  }
} catch(error) {
  if(cdp)try{const image=await cdp('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/browser-failure.png',Buffer.from(image.data,'base64'));console.error(await evaluate('({screen:document.body.innerText, hidden:document.hidden, fonts:document.fonts.status, resources:performance.getEntriesByType("resource").map(r=>[r.name,Math.round(r.duration)])})'));}catch{}
  console.error('Console:',errors);throw error;
} finally {
  socket?.close();chrome.kill();server.close();await sleep(350);
  // Only this run's newly created temporary profile may be removed.
  const absolute=resolve(profile),base=resolve(tmpdir())+sep;
  if(absolute.startsWith(base)&&absolute.slice(base.length).startsWith('traffino-qa-'))await rm(absolute,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
