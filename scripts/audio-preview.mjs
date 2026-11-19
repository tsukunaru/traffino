import { mkdir,writeFile } from 'node:fs/promises';
import { musicSamples,soundSamples,MUSIC_STATES } from '../src/sound.js';
const rate=22050,mix=new Float32Array(rate*32),cues=['go','stop','go','confirm','taxi','near','flow','reward','ambulance','firetruck','police','unlock','mission','crash','bird'];
const music=musicSamples('Normal');for(let i=0;i<mix.length;i++)mix[i]=music[i%music.length]*.24;
cues.forEach((name,n)=>{const data=soundSamples(name,n%3),start=Math.floor((1+n*2)*rate);for(let i=0;i<data.length&&start+i<mix.length;i++)mix[start+i]+=data[i]*.6;});
const wav=Buffer.alloc(44+mix.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(mix.length*2,40);
let peak=0;for(let i=0;i<mix.length;i++){peak=Math.max(peak,Math.abs(mix[i]));wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,mix[i]))*32767),44+i*2);}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/audio-preview.wav',wav);await writeFile('artifacts/audio-report.json',JSON.stringify({sampleRate:rate,seconds:32,peak,clipped:peak>=1,musicStates:MUSIC_STATES,cues},null,2));console.log('Audio preview peak: '+peak.toFixed(3));
