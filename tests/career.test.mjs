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

test('eight ordinary story shifts can fund both voluntary promotions, with no duplicate pay', () => {
  const data = new Map();
  const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) };
  const p = new Progress({ storage });
  assert.equal(p.learn('radio'), false);
  assert.equal(p.learn('ledger'), false);
  const promotions = [];
  for (let shift = 0; shift < 8; shift++) {
    p.start();
    const startCoins = p.data.coins;
    const game = new Simulation({ mode: 'story', shift, radio: p.hasSkill('radio') });
    playBot(game);
    assert.equal(game.reason, 'complete');
    const income = p.wages(game.stats);
    p.sync(game.stats, game.mode);
    p.sync(game.stats, game.mode);
    assert.equal(p.data.coins - startCoins, income);
    const reward = p.finish(game);
    assert.equal(reward.coins, income + reward.bonus);
    assert.equal(p.data.coins - startCoins, reward.coins);
    if (shift === 0) {
      assert.ok(p.learn('board'));
      assert.equal(p.learn('board'), false);
      assert.equal(p.canPromote('board'), false);
    }
    const root = p.grade === 0 ? 'board' : 'ledger';
    if (!p.hasSkill(root)) p.learn(root);
    if (p.grade < 2) {
      p.learn(root === 'board' ? 'radio' : 'dividend');
      if (p.canPromote(root)) {
        const medals = [...p.data.story], nextRate = p.rateAfterPromotion(root);
        assert.ok(p.promote(root));
        assert.equal(p.payRate, nextRate);
        assert.equal(p.data.coins, 0);
        assert.equal(p.data.career.served, 0);
        assert.deepEqual(p.data.story, medals);
        assert.equal(p.promote(root), false);
        promotions.push(shift + 1);
      }
    }
  }
  assert.equal(promotions.length, 2);
  assert.ok(promotions[0] < promotions[1]);
  const restored = new Progress({ storage });
  assert.deepEqual(restored.data.career.certified, ['board','ledger']);
  assert.equal(restored.grade, 2);
  assert.equal(restored.payRate, 5);
  assert.ok(restored.data.story.every(Boolean));
  assert.equal(restored.canPromote('ledger'), false);
  assert.equal(restored.promote('unknown'), false);
  data.set(SAVE_KEY, JSON.stringify({version:99}));
  const newer = new Progress({ storage });
  assert.equal(newer.learn('radio'), false);
  assert.equal(newer.promote('ledger'), false);
});

test('dispatch equipment changes deadlines and awards premiums only on qualifying clears', () => {
  const p = new Progress();
  p.data.coins = 500;
  assert.equal(p.learn('dividend'), false);
  assert.ok(p.learn('ledger'));
  assert.ok(p.learn('dividend'));
  assert.equal(p.payRate, 3);
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
  assert.equal(p.wages(game.stats), 3*3+SERVICE.premium);
  p.data.career.served = SERVICE.promotionTargets[0]-1;
  assert.equal(p.promote('ledger'), false);
  p.data.career.served++;
  assert.ok(p.promote('ledger'));
  assert.deepEqual(p.data.career.learned, []);
  assert.equal(p.payRate, 4);
  assert.ok(p.hasSkill('ledger'));
  assert.equal(p.hasSkill('dividend'), false);
});

