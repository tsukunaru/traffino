import { MUSIC_STATES, musicSamples, soundSamples, engineSamples } from './sound.js';
export class AudioSystem {
  constructor() {this.ctx=null;this.settings={master:.65,music:.35,sfx:.7};this.paused=true;this.suspended=false;this.musicState='Calm';this.voices=0;this.variant=0;this.cooldowns={};this.cache=new Map();this.lastFlow=1;this.nextAmbience=0;this.nextSiren=0;this.lastSpeed=0;}
  prepare() {this.musicPCM??=Object.fromEntries(MUSIC_STATES.map(s=>[s,musicSamples(s)]));}
  buffer(samples) {const b=this.ctx.createBuffer(1,samples.length,22050);b.getChannelData(0).set(samples);return b;}
  loop(samples,channel) {const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=this.buffer(samples);source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(this.channels[channel]);if(this.pendingLoops)this.pendingLoops.push(source);else source.start();return {source,gain};}
  unlock() {
    try {
      if(!this.ctx){const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return;this.ctx=new AC();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);this.channels={};for(const name of ['Music','SFX','UI','Traffic','Ambience']){const g=this.ctx.createGain();g.connect(this.master);this.channels[name]=g;}this.createMusic();this.engines={};for(const k of ['car','bus','truck','van','city','night'])this.engines[k]=this.loop(engineSamples(k),k==='city'||k==='night'?'Ambience':'Traffic');this.apply(this.settings);}
      if(!this.suspended)void this.ctx.resume().catch(()=>{});
    }catch{}
  }
  createMusic() {this.prepare();this.musicLayers={};this.pendingLoops=[];for(const state of MUSIC_STATES)this.musicLayers[state]=this.loop(this.musicPCM[state],'Music').gain;const start=this.ctx.currentTime+.03;for(const source of this.pendingLoops)source.start(start);this.pendingLoops=null;this.musicPCM=null;this.activeMusic='';}
  apply(settings) {this.settings=settings;if(!this.ctx)return;const t=this.ctx.currentTime;this.master.gain.setTargetAtTime(settings.master,t,.04);for(const [name,g] of Object.entries(this.channels))g.gain.setTargetAtTime(this.paused&&name!=='UI'?0:name==='Music'?settings.music:settings.sfx,t,.035);}
  pause(value,suspend=value) {this.paused=value;this.suspended=suspend;if(!this.ctx)return;this.apply(this.settings);if(suspend)void this.ctx.suspend().catch(()=>{});else void this.ctx.resume().catch(()=>{});}
  menu() {if(!this.ctx||this.suspended)return;const t=this.ctx.currentTime;this.channels.Music.gain.setTargetAtTime(this.settings.music,t,.15);for(const [state,gain] of Object.entries(this.musicLayers))gain.gain.setTargetAtTime(state==='Calm'?.28:0,t,.65);this.activeMusic='Calm';}
  play(name,volume=.25,channel='SFX',cooldown=.07,pan=0) {
    if(!this.ctx||this.suspended||(this.paused&&channel!=='UI')||this.voices>=(channel==='UI'?14:10))return;
    const t=this.ctx.currentTime;if(t<(this.cooldowns[name]??-1))return;this.cooldowns[name]=t+cooldown;
    const variant=this.variant++%3,key=name+variant;if(!this.cache.has(key))this.cache.set(key,this.buffer(soundSamples(name,variant)));
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=this.cache.get(key);gain.gain.value=volume;source.connect(gain);
    let panner=null;if(this.ctx.createStereoPanner){panner=this.ctx.createStereoPanner();panner.pan.value=Math.max(-.55,Math.min(.55,pan));gain.connect(panner);panner.connect(this.channels[channel]);}else gain.connect(this.channels[channel]);
    this.voices++;source.onended=()=>{this.voices--;source.disconnect();gain.disconnect();panner?.disconnect();};source.start();
  }
  event(name,data={}) {
    const side=data.direction===1?.4:data.direction===3?-.4:0;
    if(name==='directionOpened')this.play('go',.48,'UI',.035,side);
    if(name==='directionClosed')this.play('stop',.44,'UI',.035,side);
    if(name==='collision')this.play('crash',.60,'UI',.2);
    if(name==='emergency')this.play(data.kind??'ambulance',.27,'Traffic',1,side);
    if(name==='jam'||name==='reckless'||name==='emergencyFailed')this.play('warning',.31,'UI',1.8,side);
    if(name==='danger')this.play(data.active?'warning':'near',data.active?.16:.09,'SFX',2.5,side);
    if(name==='pedestriansStarted')this.play('confirm',.18,'SFX',.3,side);
    if(name==='highFlow')this.play('flow',.16,'SFX',5);
    if(name==='eventEnded')this.play('mission',.3,'SFX',1);
    if(name==='jamResolved'||name==='detourSet')this.play('confirm',.24,'SFX',1);
    if(name==='ended')this.play(data.reason==='complete'?'reward':'pause',.36,'UI',.3);
    if(name==='reward'||name==='unlock'||name==='mission')this.play(name,.38,'UI',.25);
  }
  ui(name) {this.play(name==='pause'?'pause':name.startsWith('confirm')?'confirm':'tap',.24,'UI',.055);}
  update(game) {
    if(!this.ctx||this.paused)return;const t=this.ctx.currentTime,danger=game.queues.some(q=>q.jam>0),night=game.timeOfDay>.8||game.timeOfDay<.18;
    this.musicState=danger?'Danger':night?'Night':game.mode==='rush'?'RushHour':game.flow>3?'Busy':game.flow>1.5?'Normal':'Calm';
    if(this.activeMusic!==this.musicState){this.activeMusic=this.musicState;for(const [state,gain] of Object.entries(this.musicLayers))gain.gain.setTargetAtTime(state===this.activeMusic?.42:0,t,.65);}
    if(Math.floor(game.flow)>this.lastFlow)this.play('flow',.14,'SFX',2);this.lastFlow=Math.floor(game.flow);
    let speed=0,count=0,emergency=null,turning=false;const levels={car:0,bus:0,truck:0,van:0};
    for(const v of game.vehicles??[]){if(!v.active)continue;const key=['bus','schoolbus','tourist'].includes(v.kind)?'bus':['truck','garbage','firetruck'].includes(v.kind)?'truck':['van','ambulance','pizza'].includes(v.kind)?'van':'car';levels[key]+=Math.min(1,v.speed/8)*.08;speed+=v.speed;count++;if(['ambulance','firetruck','police'].includes(v.kind)&&!v.emergencyFailed)emergency=v;turning||=v.turn>0&&v.speed<2;}
    speed/=Math.max(1,count);for(const [key,layer] of Object.entries(this.engines)){const ambience=key==='city'||key==='night',volume=ambience?(key==='night'?(night?.05:0):night?.025:.06):Math.min(.18,levels[key]);layer.gain.gain.setTargetAtTime(volume,t,.3);if(!ambience&&layer.source.playbackRate)layer.source.playbackRate.setTargetAtTime(.78+speed*.04,t,.2);}
    if(this.lastSpeed<.4&&speed>1.2)this.play('start',.15,'Traffic',1);if(this.lastSpeed>1.5&&speed<.5)this.play('brake',.13,'Traffic',1);this.lastSpeed=speed;
    if(turning)this.play('tick',.065,'Traffic',.58);
    if(emergency&&t>this.nextSiren){this.nextSiren=t+2.7;this.play(emergency.kind,.22,'Traffic',2);}
    if(t>this.nextAmbience){this.nextAmbience=t+7+(this.variant%5);this.play(danger?['horn','hornDouble','hornLow','hornToy'][this.variant%4]:night?'shop':game.timeOfDay<.45?'bird':count>7?'taxi':'shop',danger?.15:.10,danger?'Traffic':'Ambience',3,this.variant%2?.35:-.35);}
  }
}
