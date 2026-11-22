import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { insideWorkZone, ROAD_DUTY } from '../src/highway.js';
import { overlaps } from '../src/routes.js';
import { Progress } from '../src/progress.js';

function tick(g,seconds) { for(let i=0;i<Math.ceil(seconds*60)&&g.running;i++)g.tick(); }

test('opposite requests wait for the tail, are cancellable, and clearance restores normal lanes',()=>{
  const g=new Simulation({mode:'highway',incident:'crash',seed:902,director:false});
  const h=g.highway, first=g.vehicles[0], opposite=g.vehicles[2];
  assert.equal(h.vehicles.length,2);
  assert.deepEqual(g.signals,[false,false,false,false]);
  g.command({type:'toggle',direction:0});tick(g,1.6);
  assert.ok(insideWorkZone(first));
  g.command({type:'toggle',direction:2});
  assert.equal(h.requested,2);assert.ok(g.signals.every(s=>!s));
  g.command({type:'stopAll'});assert.equal(h.requested,null);
  g.command({type:'toggle',direction:2});
  let sawRear=false;
  for(let i=0;i<900&&!g.signals[2];i++){
    if(first.s>first.route.exitS && insideWorkZone(first))sawRear=true;
    assert.ok(!opposite.committed);g.tick();
  }
  assert.ok(sawRear);assert.ok(g.signals[2]);assert.equal(insideWorkZone(first),false);
  tick(g,1.5);assert.ok(insideWorkZone(opposite));
  h.remaining=.02;tick(g,.05);assert.equal(h.phase,'draining');assert.ok(g.signals.every(s=>!s));
  tick(g,10);assert.equal(h.phase,'open');assert.ok(g.signals[0]&&g.signals[2]);
  assert.ok(h.vehicles.every(v=>!v.active));assert.equal(g.stats.collisions,0);
  assert.ok(!g.spawn(2,'taxi',0).route.bypass);
});

test('both dispatches have variable repair times and can pay through ordinary convoy commands',()=>{
  const durations={repair:new Set(),crash:new Set()};
  const sides=new Set();
  for(const incident of ['repair','crash'])for(const seed of [92,2032,8675309,448765]){
    const g=new Simulation({mode:'highway',incident,seed}),h=g.highway;
    durations[incident].add(h.duration);sides.add(h.blocked);
    assert.ok(h.duration>=ROAD_DUTY[incident][0]&&h.duration<=ROAD_DUTY[incident][1]);
    const p=new Progress();p.start();let next=0,lastGreen=-99,active=null;
    for(let i=0;i<9100&&g.running;i++){
      if(h.phase==='closed'){
        const green=g.directions.find(d=>g.signals[d]);
        if(green!==undefined && green!==active){active=green;lastGreen=g.time;next=2-green;}
        if(h.requested===null || green!==undefined && g.time-lastGreen>=5 && g.vehicles.some(v=>v.active&&!v.committed&&v.direction===next)){
          g.command({type:'toggle',direction:next});
        }
        const traffic=g.vehicles.filter(insideWorkZone);
        assert.ok(new Set(traffic.map(v=>v.direction)).size<=1);
        for(const v of traffic)for(const obstacle of h.vehicles){
          assert.ok(!overlaps(v,obstacle,.05),'vehicle strikes blocked lane');
        }
      }
      g.tick();
    }
    assert.equal(g.reason,'complete',JSON.stringify([incident,seed,g.stats,g.queues]));
    assert.ok(g.stats.northConvoy>=2 && g.stats.southConvoy>=2);
    const reward=p.finish(g);assert.ok(reward.coins>0);assert.equal(p.data.best.highway,g.stats.score);
    assert.equal(g.stats.collisions,0);
  }
  assert.equal(sides.size,2);
  assert.ok(durations.repair.size>1&&durations.crash.size>1);
  assert.ok(Math.max(...durations.crash)>=ROAD_DUTY.duration/2);
});
