import test from 'node:test';
import assert from 'node:assert/strict';
import { Progress,parseSave,freshSave,SAVE_KEY } from '../src/progress.js';
import { Platform } from '../src/platform.js';
import { Simulation } from '../src/simulation.js';
import { VERSION,AD_COINS } from '../src/config.js';
import manifest from '../package.json' with {type:'json'};
test('release version and old save migration retain progress and guard repeat ad rewards',()=>{
  assert.equal(VERSION,manifest.version);assert.equal(VERSION,'1.0.0');const p=new Progress();p.data=parseSave({...freshSave(),version:1,runs:3,coins:90});
  assert.equal(p.rewardAd(2),false);assert.equal(p.rewardAd(3),true);assert.equal(p.data.coins,90+AD_COINS);assert.equal(p.rewardAd(3),false);p.data=parseSave(JSON.stringify(p.data));assert.equal(p.rewardAd(3),false);p.readOnly=true;p.data.runs++;assert.equal(p.rewardAd(4),false);
});
test('jam cleared hook fires once and does not alter traffic outcomes',()=>{
  const events=[],g=new Simulation({director:false,emit:(n,d)=>events.push([n,d])});g.clearTraffic();g.queues[2].jam=2;g.updateQueues(1/60);g.updateQueues(1/60);assert.deepEqual(events.filter(e=>e[0]==='jamResolved'),[['jamResolved',{direction:2}]]);assert.equal(g.running,true);
});
test('backup quota failure does not block the primary save or cloud queue',()=>{
  let primary=JSON.stringify(freshSave()),cloud=null;const p=new Progress({storage:{getItem:k=>k===SAVE_KEY?primary:null,setItem:(k,v)=>{if(k!==SAVE_KEY)throw Error('quota');primary=v;}},cloud:v=>cloud=v});p.data.coins=77;p.save();assert.equal(parseSave(primary).coins,77);assert.equal(primary,cloud);
});
test('fullscreen rejection and missing SDK do not escape; available score submission is rounded',async()=>{
  const p=new Platform();assert.equal(p.rewardedAvailable,false);p.sdk={screen:{fullscreen:{request:async()=>{throw Error('denied');}}},isAvailableMethod:async()=>true,leaderboards:{setScore:async(name,score)=>{assert.equal(name,'traffino_rush');assert.equal(score,301);}}};assert.equal(await p.fullscreen(),false);assert.equal(await p.submit('rush',300.6),true);assert.equal(await p.submit('story',10),false);
});
