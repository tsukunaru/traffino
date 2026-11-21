import test from 'node:test';
import assert from 'node:assert/strict';
import { vehicleParts,lightPhase,SKY } from '../src/art.js';
import { figureParts, joints, residents, paintUniform } from '../src/figures.js';
import { VEHICLES } from '../src/config.js';
import { MUSIC_STATES,SOUND_NAMES,musicSamples,soundSamples,engineSamples } from '../src/sound.js';
test('all vehicle silhouettes fit the fixed instance pools and have lights',()=>{
  for(const kind of Object.keys(VEHICLES)){const parts=vehicleParts(kind);assert.ok(parts.filter(p=>p.role==='body').length<=55,kind);assert.ok(parts.filter(p=>p.role!=='body').length<=10,kind);assert.ok(parts.some(p=>p.role==='headlight'),kind);for(const p of parts)for(const key of ['x','y','z','sx','sy','sz'])assert.ok(Number.isFinite(p[key])&&(key.length<2||p[key]>0),kind+key);}
});
test('all six residents and the officer have coloured, jointed 3D models',()=>{
  for(const style of ['officer',...residents.keys()]){
    const parts=figureParts(style);
    assert.deepEqual(Object.keys(parts).sort(),Object.keys(joints).sort());
    for(const geo of Object.values(parts)){
      assert.equal(geo.attributes.position.count,geo.attributes.color.count);
      geo.computeBoundingSphere();assert.ok(Number.isFinite(geo.boundingSphere.radius)&&geo.boundingSphere.radius>.05);
    }
    if(style==='officer'){
      const original=parts.body.attributes.color.array.slice();paintUniform(parts,0xcc5439);
      assert.notDeepEqual(original,parts.body.attributes.color.array);
      assert.ok(parts.rightArm.boundingSphere.radius>parts.leftArm.boundingSphere.radius);
    }
  }
});
test('lighting wraps at midnight and remains bounded across the full cycle',()=>{
  assert.deepEqual(lightPhase(0),lightPhase(1));assert.deepEqual(lightPhase(-.25),lightPhase(.75));for(let t=0;t<1;t+=.001){const p=lightPhase(t);assert.ok(p.index>=0&&p.index<SKY.length-1&&p.blend>=0&&p.blend<=1&&p.night>=0&&p.night<=1);}
});
test('original audio is finite, unclipped, distinct and music seams are silent',()=>{
  const signatures=new Set();const check=data=>{let peak=0;for(const x of data){assert.ok(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));}assert.ok(peak>.01&&peak<.95);};
  for(const state of MUSIC_STATES){const data=musicSamples(state,8000);check(data);assert.ok(data[0]===0&&data.at(-1)===0);signatures.add(data.reduce((sum,x)=>sum+x*x,0).toFixed(5));}assert.equal(signatures.size,6);
  for(const name of SOUND_NAMES)for(let i=0;i<3;i++)check(soundSamples(name,i,8000));for(const kind of ['car','bus','truck','van','city','night'])check(engineSamples(kind,8000));
});
