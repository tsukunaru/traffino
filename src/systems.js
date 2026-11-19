import { BALANCE as B, STORY } from './config.js';
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function random(seed) { let n = seed >>> 0 || 1; return () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 4294967296; }; }
export function curve(points, time) {
  for (let i=1; i<points.length; i++) if (time<=points[i][0]) { const [x,y]=points[i-1], [xx,yy]=points[i]; return y+(yy-y)*((time-x)/(xx-x)); }
  return points.at(-1)[1];
}
const DENSITY_CURVE=[[0,.65],[.18,1.0],[.31,1.45],[.45,.85],[.64,1.4],[.78,.85],[1,.65]];
export function difficulty(day, time, mode = 'endless', result={}) {
  const growth = 1 - Math.exp(-(day-1)/6);
  const density = curve(DENSITY_CURVE, time);
  result.density=density*(mode==='rush'?B.rushDensity:.46+growth*.42);result.left=.16+growth*.16;result.events=1+growth;result.emergency=.055+growth*.065;result.speed=1+growth*.15;result.pedestrians=1+growth;
  return result;
}
export function flowAfter(flow, wait, bonus = false) { return clamp(flow + (wait < B.timelyWait ? B.flowGain : .025) + (bonus ? .12 : 0), 1, B.flowMax); }
export function passScore(type, flow, timely, mode) {
  const base=type.emergencyPriority && timely ? B.score.emergency : type.bus && timely ? B.score.bus*type.passengerImportance : B.score.car;
  return Math.round(base*flow*(mode==='hardcore'?1.5:1));
}
export function medalFor(stats, shift) {
  const level=STORY[shift];
  if (!storyGoalMet(stats,level)) return 0;
  if (!stats.collisions && !stats.jams && stats.score>=level.medals[1] && stats.averageWait<=level.wait[1] && stats.maxFlow>=level.flow[1]) return 3;
  if (stats.collisions<=1 && stats.score>=level.medals[0] && stats.averageWait<=level.wait[0] && stats.maxFlow>=level.flow[0]) return 2;
  return 1;
}
export function storyGoalMet(stats,level) {return stats.passed>=level.goal&&(level.objectives??[]).every(o=>(stats[o.stat]??0)>=o.target);}
export class PauseState {
  constructor(change = () => {}) { this.reasons=new Set(); this.change=change; }
  set(reason, active) { const before=this.paused; if(active)this.reasons.add(reason); else this.reasons.delete(reason); if(before!==this.paused)this.change(this.paused); }
  get paused() { return this.reasons.size>0; }
}
export class InputCommands {
  constructor() { this.queue=[]; }
  push(type, direction) { if(this.queue.length<16)this.queue.push({type,direction}); }
  drain(game) { for(const cmd of this.queue) game.command(cmd); this.queue.length=0; }
  clear() { this.queue.length=0; }
}
