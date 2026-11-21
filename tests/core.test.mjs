import { playBot } from './bot.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { makeRoutes, conflictMatrix, sample, overlaps } from '../src/routes.js';
import { INTERSECTIONS, BALANCE as B, VEHICLES, STORY } from '../src/config.js';
import { difficulty, flowAfter, passScore, medalFor, PauseState, InputCommands } from '../src/systems.js';
import { freshSave, parseSave, selectSave, Progress, SAVE_KEY } from '../src/progress.js';
import { strings } from '../src/i18n.js';
const run=(g,seconds)=>{for(let i=0;i<Math.round(seconds/B.step)&&g.running;i++)g.tick();};
const isolated=options=>new Simulation({director:false,seed:77,...options});
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};

test('routes are continuous, correctly directed, and geometry generates symmetric conflicts',()=>{
  for(const map of INTERSECTIONS) {
    const routes=makeRoutes(map),matrix=conflictMatrix(routes);assert.equal(routes.length,12);
    for(const a of routes) {
      let prev={};sample(a,0,prev);
      for(let s=.05;s<a.length;s+=.05){const next=sample(a,s,{});assert.ok(Math.hypot(next.x-prev.x,next.z-prev.z)<=.05001);assert.ok(Number.isFinite(next.dx));prev=next;}
      for(const b of routes)assert.equal(matrix[a.id][b.id],matrix[b.id][a.id]);
    }
    assert.equal(matrix[0][3],true,'north/east straight conflict');
    assert.equal(matrix[0][6],false,'opposite straight lanes do not conflict');
  }
});
test('the same simulation supports a T-junction and configured custom polylines',()=>{
  const map={...INTERSECTIONS[0],directions:[0,1,2]},g=isolated({map});assert.equal(g.spawn(3,'car',0),null);assert.ok(g.routes.every(r=>r.exit!==3&&r.direction!==3));g.signals[1]=true;g.spawn(1,'car',0);run(g,20);assert.equal(g.stats.passed,1);
  const custom={...map,routes:[{direction:0,turn:0,exit:2,entryIndex:1,exitIndex:2,points:[[-1,-25],[-1,-6],[-1,6],[-1,25]]}]};const route=makeRoutes(custom)[0];assert.equal(route.entry,19);assert.equal(route.exitS,31);assert.equal(sample(route,25,{}).z,0);
});
test('STOP brakes at the line; committed vehicles finish and cannot be recalled',()=>{
  const g=isolated(),v=g.spawn(0,'car',1);run(g,8);
  assert.equal(v.state,'Waiting');assert.ok(!v.committed);assert.equal(v.speed,0);
  const stop=v.s;g.command({type:'toggle',direction:0});run(g,.5);assert.ok(v.committed);assert.ok(v.s>stop);
  g.command({type:'toggle',direction:0});run(g,15);assert.equal(g.stats.passed,1);assert.equal(g.stats.collisions,0);
});
test('one direction with mixed turning vehicles respects following distance',()=>{
  const g=isolated();g.signals[0]=true;
  for(let i=0;i<60*75;i++){if(i%90===0)g.spawn(0,i%180===0?'bus':'car',(i/90)%3);g.tick();}
  assert.equal(g.stats.collisions,0);assert.ok(g.stats.passed>20,JSON.stringify(g.stats));
});
test('conflicting GO signals allow real errors and hardcore ends on the first collision',()=>{
  const g=isolated({mode:'hardcore'});g.spawn(0,'car',0);g.spawn(1,'car',0);g.signals.fill(true);run(g,15);
  assert.equal(g.running,false);assert.equal(g.reason,'collision');assert.equal(g.stats.collisions,1);
});
test('opposite straight traffic can pass simultaneously without false collisions',()=>{
  const g=isolated();g.spawn(0,'car',0);g.spawn(2,'truck',0);g.signals.fill(true);run(g,18);
  assert.equal(g.stats.collisions,0);assert.equal(g.stats.passed,2);
});
test('destination clearance holds new traffic until the exit becomes available',()=>{
  const g=isolated(),v=g.spawn(0,'car',0);g.signals[0]=true;
  g.event={kind:'works',direction:2,phase:'active',remaining:8,collisions:0};run(g,6);assert.ok(!v.committed);run(g,15);assert.equal(g.stats.passed,1);
});
test('low-speed shallow collider contact does not register as a crash',()=>{
  const g=isolated();const a=g.spawn(0,'car',0),b=g.spawn(1,'car',0);a.x=b.x=0;a.z=b.z=0;a.speed=b.speed=.1;g.collisions();assert.equal(g.stats.collisions,0);
  assert.ok(overlaps(a,b));
});
test('physical queues cause independent jam timers, including long vehicles',()=>{
  for(const kind of ['car','truck']) {
    const g=isolated();for(let i=0;i<2400&&g.running;i++){if(i%20===0){g.spawn(0,kind,0);g.spawn(1,kind,0);}g.tick();}
    assert.equal(g.reason,'jam',kind);assert.ok(g.queues[0].jam>0);assert.ok(g.queues[1].jam>0);
  }
});
test('opening a jammed approach during grace clears the countdown',()=>{
  const g=isolated();for(let i=0;i<1800&&!g.queues[0].jam;i++){if(i%30===0)g.spawn(0,'car',0);g.tick();}
  assert.ok(g.queues[0].jam>0);g.command({type:'toggle',direction:0});run(g,8);assert.ok(g.running);assert.equal(g.queues[0].jam,0);
});
test('emergencies award success and timeout exactly once',()=>{
  const pass=isolated();pass.signals[0]=true;pass.spawn(0,'ambulance',0);run(pass,15);assert.equal(pass.stats.emergencyPassed,1);
  const fail=isolated();fail.spawn(0,'ambulance',0);run(fail,35);assert.equal(fail.stats.emergencyFailed,1);assert.equal(fail.stats.emergencyPassed,0);
});
test('pedestrians are pooled and share collision responsibility',()=>{
  const g=isolated();g.waitingPeople[0]=4;g.cross(0);assert.equal(g.waitingPeople[0],0);run(g,9);assert.equal(g.stats.pedestrians,4);assert.equal(g.people.filter(p=>p.active).length,0);
  const bad=isolated();const p=bad.people[0];Object.assign(p,{active:true,x:0,z:0});const v=bad.spawn(0,'car',0);Object.assign(v,{x:0,z:0,speed:3});bad.collisions();assert.equal(bad.reason,'pedestrian');
});
test('events warn, activate, finish; termination does not tick events again',()=>{
  const g=isolated();g.triggerEvent('wave',2);assert.equal(g.event.phase,'warning');run(g,4.1);assert.equal(g.event.phase,'active');assert.equal(g.waitingPeople[2],8);run(g,17);assert.equal(g.event,null);assert.equal(g.stats.eventsCompleted,1);
  g.triggerEvent('surge',0);g.end('quit');const time=g.time;run(g,30);assert.equal(g.time,time);
});
test('flow, scores, difficulty and medals have meaningful independent criteria',()=>{
  assert.ok(flowAfter(1,2)>flowAfter(1,40));assert.equal(flowAfter(5,0,true),5);
  assert.ok(passScore(VEHICLES.bus,2,true,'endless')>passScore(VEHICLES.car,2,true,'endless'));
  assert.ok(difficulty(9,.3).density>difficulty(1,.3).density);assert.ok(difficulty(999,.3).density<2);
  const stats={passed:20,score:1000,averageWait:2,maxFlow:5,collisions:0,jams:0};assert.equal(medalFor(stats,0),3);assert.equal(medalFor({...stats,collisions:2},0),1);
});
test('pause reasons compose; clearing an ad never clears a manual pause',()=>{
  const changes=[],p=new PauseState(v=>changes.push(v));p.set('user',true);p.set('ad',true);p.set('ad',false);assert.ok(p.paused);p.set('user',false);assert.ok(!p.paused);assert.deepEqual(changes,[true,false]);
  const q=new InputCommands(),g=isolated();for(let i=0;i<1000;i++)q.push('toggle',0);assert.equal(q.queue.length,16);q.drain(g);assert.equal(g.signals[0],false);
});
test('versioned saves validate, migrate, recover and do not overwrite future data',()=>{
  const storage=memory(),s=freshSave();s.coins=120;s.version=1;assert.equal(parseSave(JSON.stringify(s)).version,freshSave().version);
  assert.equal(parseSave('{bad'),null);assert.equal(parseSave({version:30}),null);assert.equal(parseSave({...s,coins:-12}).coins,0);
  storage.setItem(SAVE_KEY,'broken');storage.setItem(SAVE_KEY+'.backup',JSON.stringify(s));const p=new Progress({storage});assert.equal(p.data.coins,120);p.save();assert.equal(parseSave(storage.getItem(SAVE_KEY)).coins,120);
  storage.setItem(SAVE_KEY,JSON.stringify({version:30}));const future=new Progress({storage});assert.equal(future.save(),false);assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).version,30);
  assert.equal(selectSave({...s,updatedAt:3},{...s,coins:90,updatedAt:4}).coins,90);
});
test('progress settlement is incremental; rewards, purchases and claims cannot repeat',()=>{
  const storage=memory(),p=new Progress({storage,now:()=>1800000000000}),g=isolated({mode:'story'});g.stats.passed=200;g.stats.maxFlow=5;
  p.sync(g.stats,'story');const coins=p.data.coins;p.sync(g.stats,'story');assert.equal(p.data.coins,coins);
  assert.ok(p.claim('cars'));const rewarded=p.data.coins;assert.ok(!p.claim('cars'));assert.equal(p.data.coins,rewarded);
  assert.ok(p.buy('coral'));const purchased=p.data.coins;p.buy('coral');assert.equal(p.data.coins,purchased);
  const restored=new Progress({storage});assert.equal(restored.data.coins,p.data.coins);assert.ok(restored.data.cosmetics.includes('coral'));
  assert.ok(p.claim('cars',true));assert.ok(!p.claim('cars',true));
  assert.ok(p.claim('cars','session'));assert.ok(!p.claim('cars','session'));p.start();assert.deepEqual(p.data.session.claimed,[]);assert.equal(p.data.session.progress.passed,undefined);
});
test('RU and EN localization keys stay in sync',()=>assert.deepEqual(Object.keys(strings.ru).sort(),Object.keys(strings.en).sort()));

test('terminal collision stops the frame before another crash can change settled results',()=>{
  let settled;const g=isolated({mode:'hardcore',emit:(name,data)=>{if(name==='ended')settled=JSON.stringify(data.stats);}});
  for(let i=0;i<4;i++){const v=g.spawn(i,'car',0);Object.assign(v,{x:i<2?0:20,z:i<2?0:20,dx:i%2,dz:1-i%2,speed:5});}
  g.collisions();assert.equal(g.stats.collisions,1);assert.equal(JSON.stringify(g.stats),settled);
});

test('danger animation hook emits transitions only and leaves the player in control',()=>{
  const events=[],g=isolated({emit:(name,data)=>{if(name==='danger')events.push(data);}});
  const a=g.spawn(0,'car',0),b=g.spawn(1,'car',0);b.committed=true;b.s=b.route.entry+2;
  g.updateDanger();g.updateDanger();assert.deepEqual(events,[{direction:0,active:true}]);
  g.command({type:'toggle',direction:0});assert.equal(g.signals[0],true);
  b.active=false;g.updateDanger();assert.deepEqual(events.at(-1),{direction:0,active:false});assert.ok(a.active);
});

test('save roundtrip retains fractional flow and waiting statistics',()=>{
  const s=freshSave();s.totals.maxFlow=4.8;s.totals.longestWait=12.75;s.daily.date='2026-09-21';s.daily.progress.maxFlow=4.8;s.session.progress.maxFlow=4.8;
  const restored=parseSave(JSON.stringify(s));assert.equal(restored.totals.maxFlow,4.8);assert.equal(restored.totals.longestWait,12.75);assert.equal(restored.daily.progress.maxFlow,4.8);assert.equal(restored.session.progress.maxFlow,4.8);
});

test('onboarding does not spend the shift timer while the first instructions are being read',()=>{
  const g=isolated({mode:'story'});run(g,90);assert.equal(g.elapsed,0);assert.ok(g.running);g.command({type:'toggle',direction:0});run(g,12);g.command({type:'toggle',direction:0});g.command({type:'toggle',direction:1});run(g,1);assert.ok(g.elapsed>0);
});
test('endless crosses multiple days; rush ends on its configured timer',()=>{
  const endless=isolated();run(endless,400);assert.equal(endless.day,3);assert.equal(endless.stats.nights,2);assert.ok(endless.running);
  const rush=isolated({mode:'rush'});run(rush,151);assert.equal(rush.reason,'complete');assert.ok(Math.abs(rush.time-150)<.02);
});
test('seeded fixed-step traffic is reproducible and object pools are bounded',()=>{
  const a=new Simulation({mode:'endless',seed:333}),b=new Simulation({mode:'endless',seed:333});run(a,10);run(b,10);assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.vehicles.map(v=>[v.active,v.s,v.kind]),b.vehicles.map(v=>[v.active,v.s,v.kind]));assert.equal(a.vehicles.length,B.capacity);assert.equal(a.people.length,B.pedestrianCapacity);
});
test('reckless drivers have a bounded, warned reaction delay',()=>{
  const events=[],g=isolated({emit:name=>events.push(name)}),v=g.spawn(0,'reckless',0);run(g,7);g.command({type:'toggle',direction:0});g.command({type:'toggle',direction:0});run(g,.3);assert.ok(events.includes('reckless'));assert.ok(v.committed);assert.ok(v.s>v.route.entry-B.stopMargin-v.length/2);
});

// A deliberately conservative player bot: inspect only public game state, clear an approach,
// wait for the crossing to empty, then choose the largest / oldest queue. No invulnerability.
test('all eight story shifts are finishable through normal commands',()=>{
  for(let shift=0;shift<8;shift++) {
    const g=new Simulation({mode:'story',shift});playBot(g);
    assert.equal(g.reason,'complete',`shift ${shift+1}: ${JSON.stringify(g.stats)} ${JSON.stringify(g.event)} ${JSON.stringify(g.queues)} ${JSON.stringify(g.vehicles.filter(v=>v.active).map(v=>[v.kind,v.direction,v.turn,v.s,v.state]))}`);assert.ok(medalFor(g.stats,shift)>0);
  }
});
test('rush hour can be completed at full configured traffic density',()=>{
  const g=new Simulation({mode:'rush',seed:1007});playBot(g);assert.equal(g.reason,'complete');assert.ok(g.stats.passed>35);assert.equal(g.stats.collisions,0);
});


