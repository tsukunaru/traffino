import test from 'node:test';
import assert from 'node:assert/strict';
import { Progress, freshSave, parseSave, SAVE_KEY } from '../src/progress.js';
import { Simulation } from '../src/simulation.js';
import { BALANCE, SERVICE } from '../src/config.js';
import { playBot } from './bot.mjs';

test('old profiles keep earnings and receive service credit exactly once', () => {
  for (const version of [1, 2]) {
    const old = { ...freshSave(), version, coins: 61, totals: { passed: 19 }, story: [2] };
    const migrated = parseSave(old);
    assert.equal(migrated.coins, 61);
    assert.equal(migrated.story[0], 2);
    assert.deepEqual(migrated.career, { served: 19, learned: [], certified: [] });
    migrated.career.served = 3;
    assert.equal(parseSave(migrated).career.served, 3);
  }
  const malformed = { served: -6, learned: ['radio', 'dividend', 'ledger', 'ledger'], certified: ['dividend', 'unknown'] };
  assert.deepEqual(parseSave({ ...freshSave(), career: malformed }).career, { served: 0, learned: ['ledger', 'dividend'], certified: [] });
});

test('branch choices survive migration and a capstone needs both talents',()=>{
  const p=new Progress();
  p.data=parseSave({...freshSave(),version:4,coins:500,career:{served:90,certified:[],learned:['ledger','cleanPay','volume']}});
  assert.deepEqual(p.data.career.learned,['ledger','cleanPay']);
  assert.ok(p.canPromote('ledger'));
  assert.equal(p.learn('volume'),false);
  assert.ok(p.learn('dividend'));
  assert.ok(p.learn('volume'));
  assert.equal(p.learn('volume'),false);
  assert.equal(p.data.coins,500-96-150);
  const restored=parseSave(p.data).career;
  assert.deepEqual(new Set(restored.learned),new Set(p.data.career.learned));
  assert.equal(restored.served,90);
});

test('safe-duty and volume premiums apply only to each qualified pay period',()=>{
  const p=new Progress();
  p.data.career.learned=['ledger','dividend','cleanPay','volume'];
  const g=new Simulation({mode:'endless',director:false,emit:(name,record)=>{if(name==='dutyClosed')p.closeDuty(record);}});
  for(const [period,passed,crashes,banked] of [[1,16,1,40],[2,17,0,90],[3,15,0,90]]){
    g.stats.passed+=passed;g.stats.collisions+=crashes;g.elapsed=period*SERVICE.dutySeconds;g.tick();
    assert.equal(p.data.coins,banked);
  }
  g.end('quit');
  assert.equal(p.finish(g).coins,90);
});

test('traffic and recovery talents change live vehicles, flow and clearance',()=>{
  const run=(skills,kind)=>{
    const g=new Simulation({director:false,skills,seed:3}),car=g.spawn(0,kind,0);
    car.speed=0;g.flow=2;g.tick();
    return {speed:car.speed,flow:g.flow,jam:g.jamLimit};
  };
  for(const kind of ['bus','ambulance','car']){
    const base=run([],kind),trained=run(['rhythm','priority','reserve'],kind);
    assert.ok(Math.abs(trained.speed-base.speed*(kind==='car'?1:1.2))<1e-8);
    assert.ok(trained.flow>base.flow);
    assert.equal(trained.jam,base.jam+SERVICE.jamSeconds);
  }
  for(const incident of ['crash','repair']){
    const scene=skills=>new Simulation({mode:'highway',incident,seed:11,skills}).highway.duration;
    assert.equal(scene([])-scene(['crew','tow']),SERVICE.crewSeconds+SERVICE.towSeconds);
  }
});

test('v3 profiles keep certified equipment, unspent savings and current term traffic',()=>{
  const old={...freshSave(),version:3,coins:76,totals:{passed:200},career:{served:12,learned:['radio'],certified:['board']}};
  const restored=parseSave(old);
  assert.equal(restored.coins,76);
  assert.deepEqual(restored.career,old.career);
  assert.deepEqual(parseSave(restored),restored);
});

test('a quit, failed quota, jam and collision leave no spendable pay even after an autosave',()=>{
  for(const reason of ['quit','goal','jam','collision','pedestrian']){
    const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
    const p=new Progress({storage}),g=new Simulation({mode:'story',director:false});
    p.start();g.stats.passed=10;g.stats.promptPasses=4;p.sync(g.stats,g.mode);
    assert.equal(new Progress({storage}).data.coins,0);
    g.end(reason);
    assert.equal(p.finish(g).coins,0);
    assert.equal(p.data.career.served,0);
    assert.equal(p.rewardAd(p.data.runs),false);
    const loaded=new Progress({storage});
    assert.equal(loaded.data.totals.passed,10);
    assert.equal(loaded.data.coins,0);
  }
});

test('ongoing modes bank only closed full intervals that meet their own quota',()=>{
  for(const mode of ['endless','hardcore']){
    const p=new Progress();p.start();
    let last;
    const g=new Simulation({mode,director:false,emit:(name,data)=>{
      if(name==='dutyClosed'){last=data;p.closeDuty(data);}
    }});
    g.stats.passed=16;g.elapsed=SERVICE.dutySeconds-1;g.tick();
    assert.equal(p.data.coins,0);
    g.elapsed=SERVICE.dutySeconds;g.tick();assert.equal(p.data.coins,20);
    assert.equal(p.closeDuty(last),0);
    g.stats.passed+=15;g.elapsed=2*SERVICE.dutySeconds;g.tick();
    assert.equal(p.data.coins,20);
    g.stats.passed+=20;g.end('quit');
    assert.equal(p.finish(g).coins,20);assert.equal(p.data.career.served,16);
  }
});

test('migration chooses the most recent real timestamp over an older high-revision backup', () => {
  const time = Date.UTC(2026, 10, 21);
  const old = { ...freshSave(), version:2, updatedAt:time, revision:98, coins:2 };
  const recent = { ...old, updatedAt:time+1, revision:1, coins:149, totals:{passed:45} };
  for (const [primary,backup] of [[recent,old], [old,recent]]) {
    const storage = { getItem: key => JSON.stringify(key === SAVE_KEY ? primary : backup) };
    const p = new Progress({storage});
    assert.equal(p.data.updatedAt, time+1);
    assert.equal(p.data.coins, 149);
    assert.equal(p.data.career.served, 45);
  }
  const values = new Map([[SAVE_KEY, JSON.stringify(recent)]]);
  const storage = {getItem:k=>values.get(k), setItem:(k,v)=>values.set(k,v)};
  const p = new Progress({storage, now:()=>time-1000});
  assert.ok(p.learn('ledger'));
  const restored = new Progress({storage});
  assert.ok(restored.hasSkill('ledger'));
  assert.equal(restored.data.coins, 101);
});

test('three certifications require several paid duties and each settlement can only pay once', () => {
  const data = new Map();
  const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) };
  const p = new Progress({ storage });
  assert.equal(p.learn('radio'), false);
  assert.equal(p.learn('ledger'), false);
  const promotions = [];
  for (let duty = 0; duty < 26 && promotions.length<3; duty++) {
    const shift=Math.min(duty,7);
    p.start();
    const startCoins = p.data.coins;
    const game = new Simulation({ mode: 'story', shift, radio: p.hasSkill('radio'),survey:p.hasSkill('survey'),crew:p.hasSkill('crew') });
    playBot(game);
    assert.equal(game.reason, 'complete');
    const income = p.wages(game.stats);
    p.sync(game.stats, game.mode);
    p.sync(game.stats, game.mode);
    assert.equal(p.data.coins, startCoins);
    const reward = p.finish(game);
    assert.equal(p.finish(game),reward);
    assert.equal(reward.coins, income + reward.bonus);
    assert.equal(p.data.coins - startCoins, reward.coins);
    if (shift === 0) {
      assert.equal(p.learn('board'), false);
      assert.equal(p.canPromote('board'), false);
    }
    const root = ['board','ledger','survey'][p.grade];
    if (!p.hasSkill(root)) p.learn(root);
    if (p.grade < 3) {
      p.learn({board:'radio',ledger:'dividend',survey:'crew'}[root]);
      if (p.canPromote(root)) {
        const medals = [...p.data.story], nextRate = p.rateAfterPromotion(root);
        assert.ok(p.promote(root));
        assert.equal(p.payRate, nextRate);
        assert.equal(p.data.coins, 0);
        assert.equal(p.data.career.served, 0);
        assert.deepEqual(p.data.story, medals);
        assert.equal(p.promote(root), false);
        promotions.push(duty + 1);
      }
    }
  }
  assert.equal(promotions.length, 3);
  assert.ok(promotions[0]>=4 && promotions[2]>8);
  assert.ok(promotions[0] < promotions[1]);
  const restored = new Progress({ storage });
  assert.deepEqual(restored.data.career.certified, ['board','ledger','survey']);
  assert.equal(restored.grade, 3);
  assert.equal(restored.payRate, 5);
  assert.ok(restored.data.story.every(Boolean));
  assert.equal(restored.canPromote('ledger'), false);
  assert.equal(restored.promote('unknown'), false);
  data.set(SAVE_KEY, JSON.stringify({version:99}));
  const newer = new Progress({ storage });
  newer.data.coins = 500; newer.data.career = { served:100, learned:['ledger','dividend'], certified:[] };
  assert.equal(newer.learn('board'), false);
  assert.equal(newer.promote('ledger'), false);
});

test('dispatch equipment changes deadlines and awards premiums only on qualifying clears', () => {
  const p = new Progress();
  p.data.coins = 500;
  assert.equal(p.learn('dividend'), false);
  assert.ok(p.learn('ledger'));
  assert.ok(p.learn('dividend'));
  assert.equal(p.payRate, 2);
  const game = new Simulation({ director:false, radio:true });
  assert.equal(game.spawn(0,'ambulance',0).emergencyLeft, BALANCE.emergencyTimer + SERVICE.radioSeconds);
  assert.equal(new Simulation({director:false}).spawn(0,'ambulance',0).emergencyLeft, BALANCE.emergencyTimer);
  for (const [flow, wait] of [[1,0], [2,0], [3,BALANCE.timelyWait]]) {
    game.flow = flow;
    const car = game.spawn(1,'car',0);
    car.wait = wait;
    game.pass(car);
  }
  assert.equal(game.stats.promptPasses, 1);
  assert.equal(p.wages(game.stats), 3*2+SERVICE.premium);
  game.end('quit');
  assert.equal(p.finish(game).coins, 0);
  p.data.career.served = SERVICE.promotionTargets[0]-1;
  assert.equal(p.promote('ledger'), false);
  p.data.career.served++;
  assert.ok(p.promote('ledger'));
  assert.deepEqual(p.data.career.learned, []);
  assert.equal(p.payRate, 3);
  assert.ok(p.hasSkill('ledger'));
  assert.equal(p.hasSkill('dividend'), false);
});
