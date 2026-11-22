import 'core-js/stable';
import { Simulation } from './simulation.js';
import { BALANCE as B, INTERSECTIONS } from './config.js';
import { PauseState, InputCommands } from './systems.js';
import { Progress, parseSave, selectSave, futureSave } from './progress.js';
import { Platform } from './platform.js';
import { CityView } from './view.js';
import { AudioSystem } from './audio.js';
import { UI } from './ui.js';
import { translator } from './i18n.js';
import './styles.css';
import './station.css';
import './town.css';

class App {
  constructor() {
    this.screen='loading';this.language='ru';this.game=null;this.shift=0;this.challengeTab='all';this.accumulator=0;this.autoResume=false;this.transitioning=false;
    this.input=new InputCommands();this.audio=new AudioSystem();this.pause=new PauseState(()=>this.syncActivity());this.pause.set('screen',true);
    this.platform=new Platform((reason,value)=>this.externalPause(reason,value));
    addEventListener('blur',()=>this.externalPause('focus',true));
    addEventListener('focus',()=>this.externalPause('focus',false));
    document.addEventListener('visibilitychange',()=>{this.externalPause('hidden',document.hidden);if(document.hidden){this.saveSession();void this.platform.flush();}});
    addEventListener('pagehide',()=>{this.saveSession();void this.platform.flush();});
    addEventListener('keydown',e=>this.key(e));
    for(const name of ['contextmenu','dragstart','selectstart'])document.addEventListener(name,e=>{if(!e.target.matches('input,select'))e.preventDefault();});
  }
  async init() {
    const loading=async value=>{document.querySelector('#boot-progress').value=value;document.querySelector('#boot-label').textContent=value+'%';await new Promise(requestAnimationFrame);};
    await loading(12);
    await this.platform.init();let storage=null;try{storage=localStorage;}catch{}
    await loading(30);
    const notices=[];
    this.progress=new Progress({storage,cloud:value=>this.platform.queueSave(value),now:()=>this.platform.now(),warn:key=>this.ui?this.ui.toast(key):notices.push(key)});
    const cloudRaw=await this.platform.load();
    if(futureSave(cloudRaw)){this.progress.readOnly=true;notices.push('saveFuture');}
    this.progress.data=selectSave(this.progress.data,parseSave(cloudRaw));this.progress.rollDaily();
    this.language=this.progress.data.settings.language||this.platform.language();
    await loading(45);
    try {this.view=new CityView(document.querySelector('#world'),this.map(),this.progress.data.career);}
    catch (error) {if(__DEV__)console.error(error);const t=translator(this.language);document.querySelector('#ui').innerHTML=`<section class="fatal"><h1>Traffino</h1><p>${t('webglError')}</p><button id="reload">${t('reload')}</button></section>`;document.querySelector('#reload').onclick=()=>location.reload();return;}
    this.view.onContextLost=()=>this.externalPause('context',true);
    await loading(65);
    this.ui=new UI(this);this.audio.prepare();this.audio.apply(this.progress.data.settings);this.view.quality(this.progress.data.settings.quality);
    this.demo=this.makeDemo();
    this.view.bind(this.demo);this.view.render(this.demo,0,this.viewSettings());
    await loading(85);
    await Promise.all([...['miro-portrait.jpg','junior-shops.png'].map(name=>new Promise(resolve=>{const image=new Image();image.onload=image.onerror=resolve;image.src='./assets/'+name;})),document.fonts?.load('900 24px Nunito').catch(()=>{})]);
    await loading(100);
    this.show('menu');this.platform.ready();for(const key of notices)this.ui.toast(key);
    if(globalThis.PointerEvent)this.view.canvas.addEventListener('pointerdown',e=>this.canvasInput(e));
    else this.view.canvas.addEventListener('click',e=>this.canvasInput(e));
    this.lastFrame=performance.now();this.lastHUD=0;this.animate=this.frame.bind(this);requestAnimationFrame(this.animate);
    if(__DEV__) {const {installDebug}=await import('./debug.js');installDebug(this);}
  }
  makeDemo() {
    const demo=new Simulation({map:this.map(),director:false,seed:731});
    demo.elapsed=36;demo.signals[0]=demo.signals[2]=true;this.demoSpawn=-1;
    ['taxi','van','bus','pizza'].forEach((kind,d)=>{demo.spawn(d,kind,0).s=5+d*3;});
    demo.tick(B.step);
    return demo;
  }
  map() {return INTERSECTIONS.find(m=>m.id===this.progress.data.map)??INTERSECTIONS[0];}
  viewSettings() {this.presentation??={};Object.assign(this.presentation,this.progress.data.settings);this.presentation.selectedCosmetic=this.progress.data.selectedCosmetic;return this.presentation;}
  syncActivity() {
    const active=this.screen==='gameplay'&&!this.pause.paused&&this.game?.running;
    this.platform?.gameplay(Boolean(active));this.audio.pause(!active,[...this.pause.reasons].some(r=>r!=='screen'));if(!active)this.input.clear();this.accumulator=0;
    if(this.screen==='menu')this.audio.menu();
  }
  show(screen) {
    if(screen==='brief')this.dialogueTopic=null;
    if(['brief','progress','postView'].includes(screen))this.ui?.toastElement.classList.remove('show');
    this.screen=screen;this.pause.set('screen',screen!=='gameplay');this.syncActivity();this.ui?.render();this.view?.resize();
    if(screen==='gameplay')this.ui?.updateHUD();
  }
  externalPause(reason,active) {
    this.pause.set(reason,active);
    this.syncActivity();
    if(active&&this.screen==='gameplay') {this.autoResume=reason==='platform'||reason==='ad';this.show('paused');this.saveSession();}
    if(!active&&this.autoResume&&this.screen==='paused'&&![...this.pause.reasons].some(r=>r!=='screen')) {this.autoResume=false;this.show('gameplay');}
    else if(this.screen==='paused')this.ui?.render();
  }
  saveSession() {
    if(!this.progress||!this.game?.running)return;
    const oldRank=this.progress.rank;
    this.progress.sync(this.game.stats,this.game.mode);
    if(this.screen==='gameplay'&&this.progress.rank>oldRank){this.ui.toastText(this.ui.t('rankUp')+' · '+this.ui.t('rank'+this.progress.rank));this.audio.event('unlock');this.view.event('unlock');}
  }
  start(mode,shift=0) {
    if(this.transitioning)return;
    if(mode==='endless'&&!this.progress.endlessUnlocked)return;
    if(mode==='rush'&&!this.progress.data.story[3])return;
    if(mode==='hardcore'&&!this.progress.data.story[7])return;
    if(mode==='story'&&(shift<0||shift>7||(shift>0&&!this.progress.data.story[shift-1])))return;
    this.runStart={rank:this.progress.rank,story:[...this.progress.data.story],collection:Object.keys(this.progress.data.collection),reputation:this.progress.data.reputation};this.unlocks=[];
    this.progress.start();this.nextAutosave=5;this.shift=shift;this.isBest=false;this.oldBest=this.progress.data.best[mode];this.autoResume=false;
    this.game=new Simulation({mode,shift,map:this.map(),radio:this.progress.hasSkill('radio'),survey:this.progress.hasSkill('survey'),crew:this.progress.hasSkill('crew'),emit:(name,data)=>this.event(name,data)});
    this.view.setMap(this.map());this.view.bind(this.game);this.view.baseAngle=0;this.view.zoom=1;this.input.clear();this.show('gameplay');
    if([...this.pause.reasons].some(r=>r!=='screen'))this.show('paused');
    this.audio.unlock();
  }
  event(name,data) {
    this.audio.event(name,data);this.view?.event(name,data);
    if(name==='vehicleSpawned'){const fresh=!this.progress.data.collection[data.kind];this.progress.seen(data);if(fresh&&this.screen==='gameplay'){this.audio.event('unlock');this.ui.toastText(this.ui.t('newVehicle')+': '+this.ui.t(data.kind));}}
    if(name==='vehiclePassed')this.progress.passed(data);
    if(name==='dutyClosed') {
      this.progress.sync(this.game.stats,this.game.mode,false);
      const coins=this.progress.closeDuty(data);
      this.ui.toastText(coins ? this.ui.t('periodBanked')+' · +'+coins+' ◈' : this.ui.t('dutyMissed'));
      if(coins)this.audio.event('reward');
    }
    if(name==='emergencyFailed')this.ui?.toast('emergencyFailed');
    if(name==='eventEnded')this.ui?.toast('eventEnd');
    if(name==='collision') {this.impactDirection=data.direction;this.view.shakeLeft=.6;if(this.progress.data.settings.haptics)try{navigator.vibrate?.(80);}catch{}}
    if(name==='circuitComplete'){this.audio.event('reward');this.ui.toastText(this.ui.t('circuitComplete')+' +'+B.circuitBonus);}
    if(name==='jamResolved'){this.ui?.toastText(this.ui.t('jamSaved')+' · '+this.ui.t(['north','east','south','west'][data.direction]));}
    if(name==='directionOpened'||name==='directionClosed')this.ui?.updateHUD();
    if(name==='ended') {
      this.reward=this.progress.finish(this.game);this.isBest=this.game.stats.score>this.oldBest;
      const s=this.progress.data,t=this.ui.t,start=this.runStart;
      this.unlocks=[];if(this.progress.rank>start.rank)this.unlocks.push(t('rankUp')+': '+t('rank'+this.progress.rank));
      for(const [i,key] of [[0,'endless'],[3,'rush'],[7,'hardcore']])if(!start.story[i]&&s.story[i])this.unlocks.push(t('unlocked')+': '+t(key));
      for(const map of INTERSECTIONS)if(start.reputation<map.unlock&&s.reputation>=map.unlock)this.unlocks.push(t('unlocked')+': '+t(map.id));
      const found=Object.keys(s.collection).filter(id=>!start.collection.includes(id));if(found.length)this.unlocks.push(t('newVehicle')+': '+found.map(t).join(', '));
      if(this.unlocks.length)this.audio.event('unlock');
      if(['collision','pedestrian'].includes(this.game.reason)){
        this.view.photoSubject='incident';this.view.zoom=4;this.view.baseAngle=.15-this.impactDirection*Math.PI/2;
        this.show('incident');this.ui.root.querySelector('[data-action="report"]').focus({preventScroll:true});
      }else this.show('results');
      void this.platform.flush();void this.platform.submit(this.game.mode,this.progress.data.best[this.game.mode]);
    }
  }
  async afterAd(action) {
    if(this.transitioning)return;this.transitioning=true;
    try {if(this.progress.data.runs>0&&this.progress.data.runs%3===0)await this.platform.ad();}
    finally{this.transitioning=false;action();}
  }
  async rewardedCoins() {
    if(this.screen!=='results'||this.transitioning||!this.platform.rewardedAvailable||this.progress.data.adRewardRun===this.progress.data.runs)return;
    const run=this.progress.data.runs;this.transitioning=true;this.ui.render();
    try {const earned=await this.platform.ad(true);if(earned&&this.progress.rewardAd(run)){this.audio.event('reward');this.ui.toast('adThanks');}else this.ui.toast('adUnavailable');}
    finally{this.transitioning=false;this.ui.render();}
  }
  action(name,value='',button) {
    if(this.transitioning)return;this.audio.unlock();if(name!=='toggle'&&name!=='pedestrian')this.audio.ui(name);
    const t=this.ui.t;
    if(name==='toggle'||name==='pedestrian'||name==='detour') {if(this.screen==='gameplay'&&!this.pause.paused)this.input.push(name,Number(value));return;}
    if(name==='stopAll') {if(this.screen==='gameplay'&&!this.pause.paused)this.input.push('stopAll');return;}
    if(name==='routes') {this.view.showRoutes=!this.view.showRoutes;button?.setAttribute('aria-pressed',String(this.view.showRoutes));return;}
    if(name==='play')this.start(value);
    else if(name==='report' && this.screen==='incident'){
      this.view.photoSubject=null;this.view.zoom=1;this.view.baseAngle=0;this.show('results');
    }
    else if(name==='rewarded')void this.rewardedCoins();
    else if(name==='fullscreen')void this.platform.fullscreen();
    else if(name==='continue'){this.shift=this.progress.data.story.findIndex(m=>!m);if(this.shift<0)this.shift=7;this.show('brief');}
    else if(name==='progress' && ['menu','results'].includes(this.screen)){this.progressBack=this.screen;this.show('progress');}
    else if(['story','collection','challenges'].includes(name))this.show(name);
    else if(name==='learn' && this.screen==='progress' && this.progress.learn(value)){
      this.view.setMap(this.map(),this.progress.data.career);
      this.audio.event('unlock');this.ui.refreshStation(value);this.ui.toastText(t('installed')+' · '+t('skill_'+value));
    }
    else if(name==='review' && this.screen==='progress' && this.progress.canPromote(value)){this.ui.review(value);}
    else if(name==='confirmPromotion' && this.screen==='progress' && this.ui.root.querySelector('.confirm-overlay [data-action="confirmPromotion"]')?.dataset.value===value && this.progress.promote(value)){
      this.ui.dismissConfirm();this.view.setMap(this.map(),this.progress.data.career);
      this.audio.event('reward');this.ui.render();this.ui.toastText(t('certifiedNote')+' · '+t('grade'+this.progress.grade));
    }
    else if(name==='postView' && this.screen==='progress'){
      this.view.inspectPost=true;this.view.zoom=4.8;this.view.baseAngle=-1.26;this.show('postView');this.ui.root.querySelector('button').focus();
    }
    else if(name==='settings'){this.settingsBack=this.screen==='gameplay'?'paused':this.screen;this.autoResume=false;this.show('settings');}
    else if(name==='back'){
      if(this.screen==='postView'){this.view.inspectPost=false;this.view.zoom=1;this.view.baseAngle=0;this.show('progress');this.ui.root.querySelector('[data-action="postView"]').focus();}
      else this.show(this.screen==='settings'?this.settingsBack??'menu':this.screen==='brief'?'story':this.screen==='progress'?this.progressBack??'menu':'menu');
    }
    else if(name==='brief'){const i=Number(value);if(i===0||this.progress.data.story[i-1]){this.shift=i;this.show('brief');}}
    else if(name==='reply' && this.screen==='brief' && ['traffic','duty'].includes(value)){
      this.dialogueTopic=value;this.ui.render();this.ui.root.querySelector('.speech-balloon').focus({preventScroll:true});
    }
    else if(name==='startStory')void this.afterAd(()=>this.start('story',Number(value)));
    else if(name==='retry')void this.afterAd(()=>this.start(this.game.mode,this.game.shift));
    else if(name==='menu'){this.game=null;this.view.bind(this.demo);this.show('menu');}
    else if(name==='pause'){this.autoResume=false;this.show('paused');this.saveSession();}
    else if(name==='resume'){this.autoResume=false;if(![...this.pause.reasons].some(r=>r!=='screen'))this.show('gameplay');}
    else if(name==='finish')this.ui.confirm(t('finishConfirm'),'confirmFinish',t('confirm'));
    else if(name==='confirmFinish')this.game.end('quit');
    else if(name==='cancelConfirm')this.ui.dismissConfirm();
    else if(name==='photo'){this.show('photo');}
    else if(name==='hidePhoto')document.querySelector('#app').classList.toggle('photo-hidden');
    else if(name==='exitPhoto'){this.view.photoSubject=null;this.view.baseAngle=0;this.view.zoom=1;this.view.host.style.filter='';this.photoFilter=0;this.show('paused');}
    else if(name==='challengeTab'){this.challengeTab=value;this.ui.render();}
    else if(name==='claim'){const [id,kind]=value.split(':'),rank=this.progress.rank;if(this.progress.claim(id,kind)){this.audio.event('mission');this.view.event('reward');if(this.progress.rank>rank)this.ui.toastText(t('rankUp')+': '+t('rank'+this.progress.rank));}this.ui.render();}
    else if(name==='map'){const m=INTERSECTIONS.find(m=>m.id===value);if(m&&this.progress.data.reputation>=m.unlock){this.progress.data.map=value;this.progress.save();this.view.setMap(m);this.demo=this.makeDemo();this.view.bind(this.demo);this.ui.render();}}
    else if(name==='buy'){if(!this.progress.buy(value))this.ui.toast('notEnough');else{this.audio.event('unlock');this.view.event('unlock');}this.ui.render();}
    else if(name==='reset')this.ui.confirm(t('resetQuestion'),'confirmReset',t('delete'));
    else if(name==='confirmReset'){this.progress.reset();this.game=null;this.view.setMap(this.map(),this.progress.data.career);this.demo=this.makeDemo();this.view.bind(this.demo);this.language=this.platform.language();this.audio.apply(this.progress.data.settings);this.show('menu');this.ui.toast('resetDone');void this.platform.flush();}
  }
  setting(key,value) {
    this.progress.data.settings[key]=value;this.progress.save();this.audio.apply(this.progress.data.settings);
    if(key==='language'){this.language=value;this.ui.render();}
    if(key==='quality')this.view.quality(value);
  }
  photoSetting(key,value) {if(key==='subject'){
      this.view.photoSubject=[null,'officer','street','incident'][value];this.view.zoom=value===1?9:value===2?6:value===3?4:1;
      this.view.baseAngle=value===1?this.view.heroAngle-.15:value===2?-2.7:value===3?this.view.incidentAngle:0;this.ui.render();this.ui.root.querySelector('[data-photo="subject"]')?.focus();
    }else if(key==='filter'){this.photoFilter=value;this.view.host.style.filter=['','sepia(.15) saturate(1.12)','hue-rotate(12deg) saturate(.85)'][value]??'';}else if(key==='angle')this.view.baseAngle=value;else this.view.zoom=value;this.view.resize();}
  key(e) {
    if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.closest('input,select,textarea'))return;
    const modal=this.ui?.root.querySelector('.confirm-overlay');
    if(modal){if(e.code==='Escape')this.action('cancelConfirm');if(e.code==='Tab'){e.preventDefault();const buttons=[...modal.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}return;}
    if(e.code==='Escape'){e.preventDefault();if(this.screen==='gameplay')this.action('pause');else if(this.screen==='paused')this.action('resume');else if(this.screen==='photo')this.action('exitPhoto');else if(this.screen==='incident')this.action('report');else if(['progress','postView','brief'].includes(this.screen))this.action('back');return;}
    if(this.screen!=='gameplay'||this.pause.paused)return;
    const d={KeyW:0,ArrowUp:0,KeyD:1,ArrowRight:1,KeyS:2,ArrowDown:2,KeyA:3,ArrowLeft:3}[e.code];
    if(d!==undefined){e.preventDefault();this.audio.unlock();this.input.push('toggle',d);}
    if(e.code==='KeyR'){const car=this.game.detourOption()?.car;if(car)this.action('detour',String(car.serial));}
    if(e.code==='Space'){e.preventDefault();this.action('stopAll');}
  }
  canvasInput(e) {
    if(this.screen==='photo'){document.querySelector('#app').classList.remove('photo-hidden');return;}
    if(this.screen!=='gameplay'||this.pause.paused)return;const rect=this.view.canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    let best=-1,dist=90;for(let d=0;d<4;d++){const p=this.view.roadPoint(d),v=Math.hypot(p.x-x,p.y-y);if(v<dist){best=d;dist=v;}}
    if(best>=0){this.audio.unlock();this.input.push('toggle',best);}
  }
  frame(now) {
    const cpuStart=performance.now();this.frameMs=(this.frameMs??16.67)*.95+(now-this.lastFrame)*.05;
    const elapsed=Math.min(.1,(now-this.lastFrame)/1000);this.lastFrame=now;
    if(this.screen==='gameplay'&&!this.pause.paused&&this.game?.running) {
      this.accumulator+=elapsed;this.input.drain(this.game);
      while(this.accumulator>=B.step&&this.game.running&&this.screen==='gameplay'){this.game.tick();this.accumulator-=B.step;}
      if(this.game.running && this.game.time>=this.nextAutosave){this.nextAutosave=this.game.time+5;this.saveSession();}
      this.audio.update(this.game);
    } else if(['menu','brief'].includes(this.screen)&&!document.hidden&&!this.pause.reasons.has('focus')&&!this.pause.reasons.has('platform')) {
      const demo=this.demo,axis=Math.floor(demo.time/9)%2;
      const clearing=demo.vehicles.some(v=>v.active&&v.committed&&v.direction%2!==axis&&v.s<v.route.exitS+v.length*.5+.5);
      for(let d=0;d<4;d++)demo.signals[d]=!clearing&&d%2===axis;
      demo.tick(elapsed);
      const arrival=Math.floor(demo.time/1.75);
      if(arrival!==this.demoSpawn){this.demoSpawn=arrival;demo.spawn(arrival%4,['taxi','car','van','bus','pizza','car','truck'][arrival%7],0);}
      const caption=document.querySelector('.city-caption span:last-child');if(caption){const minutes=Math.floor(this.demo.timeOfDay*1440);caption.textContent=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
    }
    const visible=this.game&&['gameplay','paused','results','photo','incident'].includes(this.screen)?this.game:this.demo;
    if(visible&&!document.hidden)this.view.render(visible,elapsed,this.viewSettings());
    if(now-this.lastHUD>90){this.lastHUD=now;this.ui.updateHUD();}
    this.cpuMs=(this.cpuMs??0)*.95+(performance.now()-cpuStart)*.05;
    requestAnimationFrame(this.animate);
  }
}
const app=new App();void app.init();

