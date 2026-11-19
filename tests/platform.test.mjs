import test from 'node:test';
import assert from 'node:assert/strict';
import { Platform } from '../src/platform.js';
import { SAVE_KEY } from '../src/progress.js';

test('SDK loading, language, Game Ready and gameplay markers are idempotent',async()=>{
  const log=[],events={};globalThis.YaGames={init:async()=>({environment:{i18n:{lang:'en'}},features:{LoadingAPI:{ready:()=>log.push('ready')},GameplayAPI:{start:()=>log.push('start'),stop:()=>log.push('stop')}},on:(event,callback)=>events[event]=callback,getPlayer:async()=>({getData:async()=>({})})})};
  const paused=[],p=new Platform((reason,value)=>paused.push([reason,value]));await p.init();assert.equal(p.language(),'en');p.ready();p.ready();p.gameplay(true);p.gameplay(true);p.gameplay(false);assert.deepEqual(log,['ready','start','stop']);events.game_api_pause();events.game_api_resume();assert.deepEqual(paused,[['platform',true],['platform',false]]);delete globalThis.YaGames;
});
test('cloud failure does not enable writes that could destroy a remote save',async()=>{
  let writes=0;const p=new Platform();p.player={getData:()=>Promise.reject(new Error('offline')),setData:()=>{writes++;}};
  assert.equal(await p.load(),null);p.pendingSave='local';await p.flush();assert.equal(writes,0);
});
test('cloud saves serialize actual writes and retain the latest queued snapshot',async()=>{
  const p=new Platform();let release;const writes=[];p.player={getData:async()=>({}),setData:async data=>{writes.push(data[SAVE_KEY]);await new Promise(resolve=>release=resolve);}};await p.load();p.pendingSave='first';const first=p.flush();p.pendingSave='second';await p.flush();assert.deepEqual(writes,['first']);release();await first;clearTimeout(p.cloudTimer);p.cloudTimer=null;const second=p.flush();assert.deepEqual(writes,['first','second']);release();await second;
});
test('rewarded ads only reward onRewarded and ad callbacks release pause exactly once',async()=>{
  const pauses=[],p=new Platform((r,v)=>pauses.push(v));let callbacks;
  p.sdk={adv:{showRewardedVideo:o=>callbacks=o.callbacks,showFullscreenAdv:o=>o.callbacks.onError()}};
  const declined=p.ad(true);callbacks.onOpen();callbacks.onClose();assert.equal(await declined,false);
  const accepted=p.ad(true);callbacks.onOpen();callbacks.onRewarded();callbacks.onClose();callbacks.onClose();assert.equal(await accepted,true);assert.deepEqual(pauses,[true,false,true,false]);
  p.gameplay(true);assert.equal(await p.ad(false),false);
});
test('local ads and unavailable leaderboards degrade without rewards or errors',async()=>{
  const p=new Platform();assert.equal(await p.ad(true),false);assert.equal(await p.ad(false),false);assert.equal(await p.submit('hardcore',300),false);p.sdk={isAvailableMethod:async()=>false};assert.equal(await p.submit('endless',100),false);
});
