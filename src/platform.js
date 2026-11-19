import { SAVE_KEY } from './progress.js';
export function timeout(task,ms=5000) {
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('timeout')),ms);Promise.resolve().then(task).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});
}
export class Platform {
  constructor(onPause=()=>{}) {this.sdk=null;this.player=null;this.onPause=onPause;this.playing=false;this.pendingSave=null;this.saving=false;this.cloudTimer=null;this.lastAd=0;this.adBusy=false;this.readySent=false;}
  async init() {
    try {
      if(!globalThis.YaGames)await timeout(()=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/sdk.js';s.onload=resolve;s.onerror=reject;document.head.append(s);}));
      if(!globalThis.YaGames)return;
      this.sdk=await timeout(()=>YaGames.init());
      this.sdk.on?.('game_api_pause',()=>this.onPause('platform',true));
      this.sdk.on?.('game_api_resume',()=>this.onPause('platform',false));
      const events=this.sdk.EVENTS;
      if(events?.ACCOUNT_SELECTION_DIALOG_OPENED)this.sdk.on(events.ACCOUNT_SELECTION_DIALOG_OPENED,()=>this.onPause('account',true));
      if(events?.ACCOUNT_SELECTION_DIALOG_CLOSED)this.sdk.on(events.ACCOUNT_SELECTION_DIALOG_CLOSED,()=>this.onPause('account',false));
      try{this.player=await timeout(()=>this.sdk.getPlayer({scopes:false}),3000);}catch{}
    }catch{this.sdk=null;}
  }
  language() {return this.sdk?.environment?.i18n?.lang==='en'?'en':'ru';}
  get rewardedAvailable() {return Boolean(this.sdk?.adv?.showRewardedVideo);}
  get fullscreenAvailable() {return Boolean(this.sdk?.screen?.fullscreen?.request||globalThis.document?.documentElement?.requestFullscreen);}
  async fullscreen() {try{if(this.sdk?.screen?.fullscreen)await this.sdk.screen.fullscreen.request();else await document.documentElement.requestFullscreen();return true;}catch{return false;}}
  now() {try{return this.sdk?.serverTime?.()??Date.now();}catch{return Date.now();}}
  ready() {if(this.readySent)return;this.readySent=true;try{this.sdk?.features?.LoadingAPI?.ready();}catch{}}
  gameplay(active) {
    if(this.playing===active)return;this.playing=active;
    try {if(active)this.sdk?.features?.GameplayAPI?.start();else this.sdk?.features?.GameplayAPI?.stop();}catch{}
  }
  async load() {try{const data=await timeout(()=>this.player?.getData([SAVE_KEY]),3000);this.cloudLoaded=Boolean(this.player&&data);return data?.[SAVE_KEY]??null;}catch{return null;}}
  queueSave(value) {
    this.pendingSave=value;
    if(!this.cloudTimer)this.cloudTimer=setTimeout(()=>{this.cloudTimer=null;void this.flush();},5000);
  }
  async flush() {
    if(this.saving||!this.player||!this.cloudLoaded||!this.pendingSave)return;
    this.saving=true;const value=this.pendingSave;this.pendingSave=null;
    // Keep real writes serialized even if a connection stalls; local saves remain available.
    try {await this.player.setData({[SAVE_KEY]:value},true);}
    catch {if(!this.pendingSave)this.pendingSave=value;}
    finally {this.saving=false;if(this.pendingSave&&!this.cloudTimer)this.cloudTimer=setTimeout(()=>{this.cloudTimer=null;void this.flush();},12000);}
  }
  async submit(mode,score) {
    if(!['endless','hardcore','rush'].includes(mode))return false;
    try {if(!await timeout(()=>this.sdk?.isAvailableMethod('leaderboards.setScore')))return false;await timeout(()=>this.sdk.leaderboards.setScore('traffino_'+mode,Math.round(score)));return true;}catch{return false;}
  }
  ad(rewarded=false) {
    if(this.adBusy||(!rewarded&&this.playing)||(!rewarded&&this.now()-this.lastAd<120000))return Promise.resolve(false);
    const method=rewarded?'showRewardedVideo':'showFullscreenAdv';
    if(!this.sdk?.adv?.[method])return Promise.resolve(false);
    this.adBusy=true;this.onPause('ad',true);
    return new Promise(resolve=>{
      let reward=false,done=false,opened=false;
      const finish=(shown=false)=>{if(done){if(opened){opened=false;this.adBusy=false;this.onPause('ad',false);}return;}done=true;clearTimeout(timer);this.adBusy=false;if(opened)this.lastAd=this.now();opened=false;this.onPause('ad',false);resolve(rewarded?reward:shown);};
      // Never resume behind a still-visible ad. Opening cancels the pre-open watchdog.
      const timer=setTimeout(()=>{if(!opened)finish();},10000);
      try {this.sdk.adv[method]({callbacks:{onOpen:()=>{opened=true;clearTimeout(timer);if(done){this.adBusy=true;this.onPause('ad',true);}},onRewarded:()=>{if(!done)reward=true;},onClose:finish,onError:()=>finish()}});}catch{finish();}
    });
  }
}
