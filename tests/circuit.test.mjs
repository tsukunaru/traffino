import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { BALANCE } from '../src/config.js';

test('Rush circuits require a pass from every approach after the last collision', () => {
  const game = new Simulation({mode:'rush', director:false});
  const pass = direction => game.pass(game.spawn(direction,'car',0));
  for(const dir of [0,0,1,2]) pass(dir);
  assert.equal(game.circuit.size,3);
  game.crash(game.spawn(1,'car',0), game.spawn(3,'car',0));
  game.clearTraffic();
  for(const dir of [3,2,1]) pass(dir);
  assert.equal(game.stats.circuits,0);
  const before=game.stats.score;
  pass(0);
  assert.equal(game.stats.circuits,1);
  assert.equal(game.circuit.size,0);
  assert.ok(game.stats.score>=before+BALANCE.circuitBonus);
  assert.equal(new Simulation({mode:'story'}).circuit,null);
});
