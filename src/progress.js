import { VEHICLES, MISSIONS, COSMETICS, BALANCE as B, RANKS, INTERSECTIONS, AD_COINS, TRAINING, SERVICE } from './config.js';
import { clamp, medalFor } from './systems.js';
export const SAVE_KEY='traffino.save.v2';
const SAVE_VERSION = 4;
export function futureSave(raw) {try{return (typeof raw==='string'?JSON.parse(raw):raw)?.version>SAVE_VERSION;}catch{return false;}}
const integer=(v, max=1e12)=>Number.isFinite(v)?clamp(Math.floor(v),0,max):0;
const statistic=v=>Number.isFinite(v)?clamp(v,0,1e12):0;
export function freshSave() {
  return {version:SAVE_VERSION,career:{ served:0, learned:[], certified:[] },updatedAt:0,revision:0,reputation:0,coins:0,story:Array(8).fill(0),collection:{},best:{endless:0,rush:0,hardcore:0,story:0},totals:{},missions:{},daily:{date:'',progress:{},claimed:[]},session:{progress:{},claimed:[]},cosmetics:['classic'],selectedCosmetic:'classic',map:'garden',settings:{master:.65,music:.35,sfx:.7,language:'',shake:true,haptics:false,quality:'medium'},runs:0,adRewardRun:0};
}
export function parseSave(raw) {
  try {
    const x=typeof raw==='string'?JSON.parse(raw):raw;
    if(!x||typeof x!=='object'||Array.isArray(x))return null;
    if(![1, 2, 3, SAVE_VERSION].includes(x.version))return null;
    const s=freshSave();
    s.updatedAt=integer(x.updatedAt,Number.MAX_SAFE_INTEGER);
    for(const k of ['revision','reputation','coins','runs','adRewardRun'])s[k]=integer(x[k]);
    s.story=s.story.map((_,i)=>clamp(integer(x.story?.[i]),0,3));
    for(const k of Object.keys(s.best))s.best[k]=integer(x.best?.[k]);
    for(const k of ['score','playTime','day','passed','cars','buses','emergencyPassed','emergencyFailed','pedestrians','collisions','jams','maxFlow','longestWait','longestQueue','rushHours','eventsCompleted','nights','cleanShifts','circuits','promptPasses'])s.totals[k]=statistic(x.totals?.[k]);
    const career = s.career;
    career.served = integer(x.version < 3 ? s.totals.passed : x.career?.served);
    if (x.version >= 3) {
      const learned = Array.isArray(x.career?.learned) ? x.career.learned : [];
      const certified = Array.isArray(x.career?.certified) ? x.career.certified : [];
      for (const skill of TRAINING) {
        if (!skill.requires && certified.includes(skill.id)) career.certified.push(skill.id);
        else if (learned.includes(skill.id) && (!skill.requires || career.learned.includes(skill.requires) || career.certified.includes(skill.requires))) {
          career.learned.push(skill.id);
        }
      }
    }
    for(const id of Object.keys(VEHICLES))if(x.collection?.[id])s.collection[id]={seen:integer(x.collection[id].seen),passed:integer(x.collection[id].passed)};
    for(const m of MISSIONS)s.missions[m.id]=x.missions?.[m.id]===true;
    s.cosmetics=COSMETICS.filter(c=>c.id==='classic'||x.cosmetics?.includes?.(c.id)).map(c=>c.id);
    if(s.cosmetics.includes(x.selectedCosmetic))s.selectedCosmetic=x.selectedCosmetic;
    if(INTERSECTIONS.some(m=>m.id===x.map&&m.unlock<=s.reputation))s.map=x.map;
    for(const k of ['master','music','sfx'])if(Number.isFinite(x.settings?.[k]))s.settings[k]=clamp(x.settings[k],0,1);
    for(const k of ['shake','haptics'])if(typeof x.settings?.[k]==='boolean')s.settings[k]=x.settings[k];
    if(['ru','en'].includes(x.settings?.language))s.settings.language=x.settings.language;
    if(['low','medium','high'].includes(x.settings?.quality))s.settings.quality=x.settings.quality;
    if(/^\d{4}-\d{2}-\d{2}$/.test(x.daily?.date)) {
      s.daily.date=x.daily.date;
      for(const m of MISSIONS)s.daily.progress[m.stat]=statistic(x.daily.progress?.[m.stat]);
      s.daily.claimed=MISSIONS.filter(m=>x.daily.claimed?.includes?.(m.id)).map(m=>m.id);
    }
    for(const m of MISSIONS)s.session.progress[m.stat]=statistic(x.session?.progress?.[m.stat]);
    s.session.claimed=MISSIONS.filter(m=>x.session?.claimed?.includes?.(m.id)).map(m=>m.id);
    return s;
  }catch{return null;}
}
export function selectSave(a,b) {
  if(!a)return b??freshSave(); if(!b)return a;
  // ponytail: whole-document last-write wins; use server transactions if multi-device simultaneous play is required.
  return b.updatedAt>a.updatedAt||(b.updatedAt===a.updatedAt&&b.revision>a.revision)?b:a;
}

export class Progress {
  constructor({storage=null,cloud=()=>{},now=()=>Date.now(),warn=()=>{}}={}) {
    this.storage=storage;this.cloud=cloud;this.now=now;this.warn=warn;this.last={};this.resetPayroll();this.readOnly=false;
    let primary=null,backup=null;
    try {
      const raw=storage?.getItem(SAVE_KEY); primary=parseSave(raw);backup=parseSave(storage?.getItem(SAVE_KEY+'.backup'));
      if(raw&&!primary) {
        this.readOnly=futureSave(raw);
        warn(this.readOnly?'saveFuture':'saveRecovered');
      }
    }catch{warn('saveUnavailable');}
    this.data=selectSave(primary,backup);this.rollDaily();
    if(!storage)warn('saveUnavailable');
  }
  rollDaily() {
    const date=new Date(this.now()).toISOString().slice(0,10);
    if(this.data.daily.date!==date)this.data.daily={date,progress:{},claimed:[]};
  }
  save() {
    if(this.readOnly)return false;
    const s=this.data;s.revision++;s.updatedAt=Math.max(s.updatedAt,this.now());const text=JSON.stringify(s);
    try {const old=this.storage?.getItem(SAVE_KEY);if(parseSave(old))this.storage?.setItem(SAVE_KEY+'.backup',old);}catch{} // A full backup quota must not prevent replacing the primary save.
    try {this.storage?.setItem(SAVE_KEY,text);}catch{this.warn('saveUnavailable');}
    this.cloud(text);return true;
  }
  resetPayroll() {
    this.lastDuty = 0;
    this.payroll = { wages:0, premium:0, bonus:0, coins:0, periods:0 };
    this.finishedReward = null;
  }
  start() {this.last={};this.resetPayroll();this.data.session={progress:{},claimed:[]};this.rollDaily();this.save();}
  seen(v) {const c=this.data.collection[v.kind]??={seen:0,passed:0};c.seen++;}
  passed(v) {const c=this.data.collection[v.kind]??={seen:1,passed:0};c.passed++;}
  sync(stats,mode,persist=true) {
    const s=this.data;this.rollDaily();
    for(const [key,value] of Object.entries(stats)) {
      if(['totalWait','averageWait'].includes(key))continue;
      const max=['maxFlow','day','longestWait','longestQueue'].includes(key);
      const delta=Math.max(0,value-(this.last[key]??0));
      s.totals[key]=max?Math.max(s.totals[key]??0,value):(s.totals[key]??0)+delta;
      s.daily.progress[key]=max?Math.max(s.daily.progress[key]??0,value):(s.daily.progress[key]??0)+delta;
      s.session.progress[key]=max?Math.max(s.session.progress[key]??0,value):(s.session.progress[key]??0)+delta;
      if (key === 'passed') {
        s.reputation += delta * B.reputationPerCar;
      }
      if(key==='emergencyPassed')s.reputation+=delta*B.emergencyReputation;
      this.last[key]=value;
    }
    s.best[mode]=Math.max(s.best[mode],stats.score);if(persist)this.save();
  }
  // Each numbered duty is settled once. A closed interval of an open-ended run survives quitting.
  settle(record, bonus, qualified) {
    if (this.finishedReward || record.number <= this.lastDuty) return 0;
    this.lastDuty = record.number;
    if (!qualified) return 0;
    const wages = this.wages(record), total = wages + bonus;
    this.payroll.wages += wages;
    this.payroll.premium += wages - record.passed * this.payRate;
    this.payroll.bonus += bonus;
    this.payroll.coins += total;
    this.payroll.periods++;
    this.data.coins += total;
    this.data.career.served += record.passed;
    return total;
  }
  closeDuty(record) {
    const paid = this.settle(record, B.completionCoins, record.passed >= SERVICE.dutyGoal);
    if (paid) this.save();
    return paid;
  }
  finish(game) {
    if (this.finishedReward) return this.finishedReward;
    this.sync(game.stats,game.mode,false);
    this.data.runs++;
    let medal=0, bonus=B.completionCoins;
    if(game.reason==='complete') {
      this.data.reputation+=25;
      if(game.mode==='story') {
        medal=medalFor(game.stats,game.shift);
        const previous=this.data.story[game.shift];
        bonus+=Math.max(0,medal-previous)*SERVICE.medalCoins;
        this.data.story[game.shift]=Math.max(previous,medal);
      }
      this.settle(game.dutyRecord(), bonus, true);
    }
    this.finishedReward = { ...this.payroll, medal, reputation:game.stats.passed*B.reputationPerCar+game.stats.emergencyPassed*B.emergencyReputation+(game.reason==='complete'?25:0) };
    this.save();
    return this.finishedReward;
  }
  claim(id,scope='all') {
    this.rollDaily();const m=MISSIONS.find(m=>m.id===id);if(!m)return false;
    if(scope===true)scope='daily';if(scope===false)scope='all';
    if(!['all','daily','session'].includes(scope))return false;
    const source=scope==='all'?this.data.totals:this.data[scope].progress,claimed=scope==='all'?this.data.missions[id]:this.data[scope].claimed.includes(id);
    if(claimed||(source[m.stat]??0)<this.challengeTarget(m,scope))return false;
    if(scope==='all')this.data.missions[id]=true;else this.data[scope].claimed.push(id);
    const reward=this.challengeReward(m,scope);this.data.reputation+=reward.rep;this.save();return true;
  }
  challengeTarget(m,scope) {return scope==='all'?m.target:scope==='daily'?this.dailyTarget(m):m.max?3:Math.max(1,Math.ceil(m.target*.15));}
  challengeReward(m,scope) {return {rep:Math.ceil(m.rep*(scope==='session'?.35:1))};}
  dailyTarget(m) {return m.max?4:Math.max(1,Math.ceil(m.target*.2));}
  buy(id) {
    const item=COSMETICS.find(c=>c.id===id);if(!item)return false;
    if(!this.data.cosmetics.includes(id)) {if(this.data.coins<item.cost)return false;this.data.coins-=item.cost;this.data.cosmetics.push(id);}
    this.data.selectedCosmetic=id;this.save();return true;
  }
  get grade() { return this.data.career.certified.length; }
  get payRate() { return B.coinsPerCar + this.grade + Number(this.hasSkill('ledger')); }
  rateAfterPromotion(root) {
    return B.coinsPerCar + this.grade + 1 + Number(root === 'ledger' || this.data.career.certified.includes('ledger'));
  }
  hasSkill(id) {
    const { learned, certified } = this.data.career;
    return learned.includes(id) || certified.includes(id);
  }
  wages(stats) {
    const premium = this.hasSkill('dividend') ? (stats.promptPasses ?? 0) * SERVICE.premium : 0;
    return stats.passed * this.payRate + premium;
  }
  canLearn(skill) {
    return Boolean(skill) && !this.readOnly && !this.hasSkill(skill.id) && this.data.coins >= skill.cost
      && (!skill.requires || this.hasSkill(skill.requires));
  }
  learn(id) {
    const skill = TRAINING.find(item => item.id === id);
    if (!this.canLearn(skill)) return false;
    this.data.coins -= skill.cost;
    this.data.career.learned.push(id);
    this.save();
    return true;
  }
  canPromote(root) {
    const { served, certified } = this.data.career;
    const advanced = TRAINING.find(skill => skill.requires && skill.requires === root);
    return !this.readOnly && Boolean(advanced) && !certified.includes(root)
      && this.hasSkill(advanced.id) && served >= SERVICE.promotionTargets[this.grade];
  }
  promote(root) {
    if (!this.canPromote(root)) return false;
    this.data.career.certified.push(root);
    this.data.career.learned = [];
    this.data.career.served = 0;
    this.data.coins = 0;
    this.save();
    return true;
  }
  get rank() {return RANKS.filter(x=>this.data.reputation>=x).length-1;}
  rewardAd(run) {if(!this.finishedReward?.periods||this.readOnly||run!==this.data.runs||run<=0||this.data.adRewardRun===run)return false;this.data.adRewardRun=run;this.data.coins+=AD_COINS;this.save();return true;}
  get endlessUnlocked() {return this.data.story[0]>0;}
  reset() {this.readOnly=false;this.data=freshSave();this.last={};this.resetPayroll();this.rollDaily();try{this.storage?.removeItem(SAVE_KEY+'.backup');this.storage?.removeItem(SAVE_KEY);}catch{}this.save();}
}
