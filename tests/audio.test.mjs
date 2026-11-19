import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioSystem } from '../src/audio.js';
test('audio uses separate buses, smooth music transitions and suspends every channel on pause',async()=>{
  const calls=[];const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(v,t,fade){calls.push(['gain',v,fade]);}});
  const node=()=>({gain:param(),frequency:param(),connect(){},disconnect(){},start(){},stop(){}});
  globalThis.AudioContext=class{currentTime=0;destination={};createGain=node;createOscillator=node;createBufferSource=node;createBuffer(ch,n){return {getChannelData:()=>new Float32Array(n)};}resume(){calls.push(['resume']);return Promise.resolve();}suspend(){calls.push(['suspend']);return Promise.resolve();}};
  const a=new AudioSystem();a.unlock();assert.deepEqual(Object.keys(a.channels),['Music','SFX','UI','Traffic','Ambience']);assert.equal(Object.keys(a.musicLayers).length,6);a.pause(false);a.update({queues:[{jam:0}],timeOfDay:.4,mode:'rush',flow:2});assert.equal(a.activeMusic,'RushHour');assert.ok(calls.some(c=>c[0]==='gain'&&c[2]===.65));for(let i=0;i<40;i++)a.play('horn',.2,'Traffic',0);assert.equal(a.voices,10);a.play('go',.2,'UI',0);assert.equal(a.voices,11);for(let i=0;i<40;i++)a.play('tap',.2,'UI',0);assert.equal(a.voices,14);a.pause(true);assert.equal(calls.at(-1)[0],'suspend');a.voices=0;a.play('go',.2,'UI');assert.equal(a.voices,0);a.pause(true,false);a.play('go',.2,'UI');assert.equal(a.voices,1);delete globalThis.AudioContext;
});
