import { BALANCE as B, VEHICLES, STORY, INTERSECTIONS, EVENTS, SERVICE } from './config.js';
import { makeRoutes, conflictMatrix, sample, overlaps, rotate } from './routes.js';
import { random, difficulty, flowAfter, passScore, clamp, storyGoalMet } from './systems.js';

export class Simulation {
  constructor({ mode='endless', shift=0, map=INTERSECTIONS[0], seed, emit=()=>{}, director=true, radio=false } = {}) {
    seed ??= mode==='story'?(STORY[shift].seed??1000+shift):Date.now();
    this.mode=mode; this.shift=shift; this.map=map; this.emit=emit; this.rng=random(seed); this.seed=seed;
    this.emergencyLimit = B.emergencyTimer + (radio ? SERVICE.radioSeconds : 0);
    this.routes=makeRoutes(map); this.conflicts=conflictMatrix(this.routes);
    this.directions=map.directions??[0,1,2,3];this.routesByDirection=this.directions.map(d=>this.routes.filter(r=>r.direction===d));
    this.vehicles=Array.from({length:B.capacity}, (_,id)=>({ id, active:false, x:0,z:0,dx:0,dz:1 }));
    this.people=Array.from({length:B.pedestrianCapacity}, (_,id)=>({id,active:false,x:0,z:0,dx:1,dz:0,length:.45,width:.45}));
    this.signals=[false,false,false,false]; this.closedAt=[-99,-99,-99,-99];
    this.dangerStates=[false,false,false,false];this.dangerClock=0;
    this.queues=Array.from({length:4},()=>({count:0,length:0,average:0,longest:0,jam:0}));
    this.lanes=Array.from({length:4},()=>[]); this.grid=Array.from({length:144},()=>[]);
    this.waitingPeople=[0,0,0,0]; this.pedClock=8; this.eventClock=B.eventInterval;
    this.time=0; this.elapsed=0; this.day=1; this.timeOfDay=.22; this.flow=1; this.running=true; this.director=director;
    this.trafficProfile={};this.spawnClock=1; this.serial=0; this.event=null; this.tutorial=mode==='story'&&shift===0 ? 0 : 4;
    this.densityScale=1; this.invulnerable=false; this.guaranteed=false;
    this.stats={score:0,playTime:0,day:1,passed:0,cars:0,buses:0,emergencyPassed:0,emergencyFailed:0,pedestrians:0,collisions:0,jams:0,maxFlow:1,averageWait:0,totalWait:0,longestWait:0,longestQueue:0,rushHours:0,eventsCompleted:0,nights:0,cleanShifts:0};
    this.level=mode==='story'?STORY[shift]:null; this.duration=this.level?.duration??(mode==='rush'?B.rushDuration:Infinity);
    if(this.level?.objectives?.some(o=>o.stat==='pedestrians'))this.waitingPeople[1]=3;
    // Rush Hour rewards clearing every approach between collisions.
    this.circuit = mode === 'rush' ? new Set() : null;
    this.stats.circuits = 0;
    this.stats.promptPasses = 0;
    this.forcedQueue=[];
    if (this.tutorial===0) this.spawn(0,'car',0);
  }

  command({type,direction}) {
    if (!this.running || !Number.isInteger(direction) || !this.directions.includes(direction)) return;
    if(type==='toggle') {
      if(this.tutorial===2 && direction!==1) return;
      if(this.tutorial<2 && direction!==0) return;
      if(this.tutorial===1 && this.stats.passed===0 && this.signals[0]) return;
      this.signals[direction]=!this.signals[direction];
      if(!this.signals[direction])this.closedAt[direction]=this.time;
      this.emit(this.signals[direction]?'directionOpened':'directionClosed',{direction});
      if(this.tutorial===0) this.tutorial=1;
      else if(this.tutorial===1&&!this.signals[0]) { this.tutorial=2; this.spawn(1,'taxi',0); }
      else if(this.tutorial===2&&direction===1&&this.signals[1])this.tutorial=3;
    } else if(type==='pedestrian') this.cross(direction);
  }

  spawn(direction, kind, turn) {
    if(direction===undefined)direction=this.directions[Math.floor(this.rng()*this.directions.length)];
    if(!this.directions.includes(direction))return null;
    kind ??= this.pickVehicle();
    if(!VEHICLES[kind])return null;
    const def=VEHICLES[kind];
    for(const v of this.vehicles) if(v.active&&v.direction===direction&&v.s<(v.length+def.length)/2+B.gap)return null;
    const v=this.vehicles.find(v=>!v.active); if(!v)return null;
    if(turn===undefined) { const r=this.rng(); turn=this.level&&!this.level.turns?0:r<this.profile().left?1:r<.4?2:0; }
    if(this.event?.phase==='active'&&this.event.kind==='turn'&&this.event.direction===direction&&turn===1)turn=0;
    const choices=this.routesByDirection[this.directions.indexOf(direction)];
    const route=choices.find(r=>r.turn===turn)??choices[0];if(!route)return null;turn=route.turn;
    Object.assign(v,{active:true,serial:++this.serial,kind,direction,route,turn,s:0,speed:0,maxSpeed:def.speed*(.94+this.rng()*.12),length:def.length,width:def.width,wait:0,age:0,committed:false,state:'Spawning',emergencyLeft:this.emergencyLimit,emergencyFailed:false,crashLeft:0,broken:0});
    sample(route,0,v); this.emit('vehicleSpawned',v);
    if(def.emergencyPriority)this.emit('emergency',v);
    if(def.reckless)this.emit('reckless',v);
    return v;
  }

  pickVehicle() {
    const tier=this.level?.tier??3, p=this.profile();
    if(tier>=2&&this.rng()<p.emergency)return ['ambulance','firetruck','police'][Math.floor(this.rng()*3)];
    const choices=Object.entries(VEHICLES).filter(([id,v])=>!v.emergencyPriority&&(tier>=3||!v.reckless)&& (tier>=1||id==='car'||id==='taxi'));
    const busFactor=.8+Math.sin(this.timeOfDay*Math.PI)**2*.6;
    let total=0; for(const [,v] of choices)total+=v.weight*(v.bus?busFactor:1);
    let r=this.rng()*total; for(const [id,v] of choices) { r-=v.weight*(v.bus?busFactor:1); if(r<=0)return id; }
    return 'car';
  }

  profile() { return difficulty(this.day,this.timeOfDay,this.mode,this.trafficProfile); }

  destinationClear(v) {
    const e=this.event;
    if(e?.phase==='active'&&e.kind==='works'&&e.direction===v.route.exit)return false;
    if(e?.phase==='active'&&e.kind==='turn'&&e.direction===v.direction&&v.turn===1)return false;
    const needed=v.length+B.gap+1;
    for(const other of this.vehicles) if(other.active&&other!==v&&other.route.exit===v.route.exit) {
      const tail=other.s-other.route.exitS-other.length/2;
      if(other.s>other.route.exitS-1&&tail<needed)return false;
    }
    return true;
  }

  tick(dt=B.step) {
    if(!this.running)return;
    this.time+=dt; this.stats.playTime=this.time;if(this.tutorial>=3)this.elapsed+=dt;
    const oldDay=this.day, oldPhase=this.timeOfDay;
    const cycle=this.elapsed/B.dayDuration+.22;
    this.day=1+Math.floor(cycle); this.timeOfDay=cycle%1; this.stats.day=this.day;
    if(this.day>oldDay) { this.stats.nights++; this.stats.score+=B.score.day; this.emit('day',{day:this.day}); }
    if((oldPhase<.36&&this.timeOfDay>=.36)||(oldPhase<.70&&this.timeOfDay>=.70))this.stats.rushHours++;
    if(this.tutorial===3&&this.stats.passed>=2)this.tutorial=4;
    if(this.director&&this.tutorial>=3)this.updateDirector(dt);
    this.updateEvent(dt);
    const p=this.profile();
    for(const lane of this.lanes)lane.length=0;
    for(const v of this.vehicles)if(v.active)this.lanes[v.direction].push(v);
    for(const lane of this.lanes)lane.sort((a,b)=>b.s-a.s);
    for(const lane of this.lanes)for(let i=0;i<lane.length;i++)this.move(lane[i],lane,i,dt,p);
    this.updatePeople(dt);
    this.collisions();
    if(!this.running)return;
    this.updateQueues(dt);
    if(!this.running)return;
    this.dangerClock-=dt;
    if(this.dangerClock<=0){this.dangerClock=.1;this.updateDanger();}
    const bad=this.queues.some(q=>q.longest>B.timelyWait||q.jam>0);
    this.flow=clamp(this.flow-dt*B.flowDecay*(bad?5:1),1,B.flowMax);
    this.stats.maxFlow=Math.max(this.stats.maxFlow,this.flow);
    if(this.running&&this.elapsed>=this.duration)this.end(this.level&&!storyGoalMet(this.stats,this.level)?'goal':'complete');
  }

  move(v,lane,index,dt,profile) {
    const def=VEHICLES[v.kind]; v.age+=dt;
    if(v.crashLeft>0) { v.crashLeft-=dt; if(v.crashLeft<=0)v.active=false; return; }
    if(def.emergencyPriority&&!v.emergencyFailed) {
      v.emergencyLeft-=dt;
      if(v.emergencyLeft<=0) { v.emergencyFailed=true; this.stats.emergencyFailed++; this.stats.score=Math.max(0,this.stats.score-B.emergencyPenalty); this.flow=Math.max(1,this.flow-.35); this.emit('emergencyFailed',v); }
    }
    let limit=Infinity;
    const stop=v.route.entry-B.stopMargin-v.length/2;
    const recklessGrace=def.reckless&&this.time-this.closedAt[v.direction]<.45;
    if(!v.committed&&((!this.signals[v.direction]&&!recklessGrace)||!this.destinationClear(v)))limit=stop;
    if(index>0) {
      const ahead=lane[index-1];
      if((v.s<v.route.entry+2&&ahead.s<ahead.route.entry+8)||ahead.route===v.route)limit=Math.min(limit,ahead.s-(ahead.length+v.length)/2-B.gap);
    }
    // Shared exits need following distance even when cars arrived from different approaches.
    if(v.s>v.route.exitS-2)for(const other of this.vehicles)if(other.active&&other!==v&&other.route.exit===v.route.exit&&other.s>other.route.exitS-2) {
      const gap=(other.s-other.route.exitS)-(v.s-v.route.exitS);
      if(gap>0)limit=Math.min(limit,v.s+gap-(other.length+v.length)/2-B.gap);
    }
    let target=v.maxSpeed*profile.speed;
    if(v.turn&&v.s>v.route.entry-1&&v.s<v.route.exitS)target*=.72;
    const gap=Math.max(0,limit-v.s);
    target=Math.min(target,Math.sqrt(2*def.brake*gap));
    if(v.broken>0){v.broken-=dt;target=0;}
    v.speed=Math.max(0,v.speed+clamp(target-v.speed,-def.brake*dt,def.accel*dt));
    v.s=Math.max(v.s,Math.min(v.s+v.speed*dt,limit));
    if(limit-v.s<.015)v.speed=0;
    if(v.s>stop+.025)v.committed=true;
    if(!v.committed&&v.speed<1) {v.wait+=dt;this.stats.longestWait=Math.max(this.stats.longestWait,v.wait);}
    v.state=v.broken>0?'Broken':v.s>v.route.exitS?'Leaving':v.committed?'Crossing':v.speed<.1?'Waiting':v.speed<2?'Starting':'Approaching';
    sample(v.route,v.s,v);
    if(v.s>=v.route.length-.05)this.pass(v);
  }

  pass(v) {
    v.active=false;
    const def=VEHICLES[v.kind], timely=def.emergencyPriority?!v.emergencyFailed:v.wait<(def.scheduleTolerance??B.timelyWait);
    this.flow=flowAfter(this.flow,v.wait,timely&&(def.bus||def.emergencyPriority));
    this.stats.score+=passScore(def,this.flow,timely,this.mode);
    if (v.wait < B.timelyWait && this.flow >= SERVICE.premiumFlow) this.stats.promptPasses++;
    this.stats.passed++; if(def.bus)this.stats.buses++; else this.stats.cars++;
    if(def.emergencyPriority&&timely)this.stats.emergencyPassed++;
    this.stats.totalWait+=v.wait; this.stats.averageWait=this.stats.totalWait/this.stats.passed;
    this.stats.maxFlow=Math.max(this.flow,this.stats.maxFlow);
    if (this.circuit) {
      this.circuit.add(v.direction);
      if (this.circuit.size === this.directions.length) {
        this.circuit.clear();
        this.stats.circuits++;
        this.stats.score += B.circuitBonus;
        this.emit('circuitComplete');
      }
    }
    this.emit('vehiclePassed',v);
    if(this.flow>=4)this.emit('highFlow',{flow:this.flow});
  }

  updateQueues(dt) {
    for(let d=0;d<4;d++) {
      const q=this.queues[d]; q.count=0;q.length=0;q.longest=0;q.average=0;
      for(const v of this.lanes[d])if(v.active&&!v.committed&&v.speed<2) {q.count++;q.length+=v.length+B.gap;q.longest=Math.max(q.longest,v.wait);q.average+=v.wait;}
      if(q.count)q.average/=q.count;
      this.stats.longestQueue=Math.max(this.stats.longestQueue,q.count);
      const critical=Math.min(B.jamLength,(this.map.extent-this.map.entry-B.stopMargin)*.83);
      if(q.length>=critical) { if(q.jam===0){this.stats.jams++;this.emit('jam',{direction:d});}q.jam+=dt; }
      else {if(q.jam>0)this.emit('jamResolved',{direction:d});q.jam=0;}
      if(q.jam>=(this.mode==='hardcore'?B.hardJamGrace:B.jamGrace)&&!this.invulnerable){this.end('jam');return;}
    }
  }

  collisions() {
    for(const cell of this.grid)cell.length=0;
    for(const v of this.vehicles)if(v.active&&!v.crashLeft) {
      const gx=clamp(Math.floor(v.x/6)+6,0,11),gz=clamp(Math.floor(v.z/6)+6,0,11);
      for(let x=Math.max(0,gx-1);x<=Math.min(11,gx+1);x++)for(let z=Math.max(0,gz-1);z<=Math.min(11,gz+1);z++)for(const other of this.grid[z*12+x]) {
        if(v.crashLeft||other.crashLeft)continue;
        if(Math.hypot(v.speed*v.dx-other.speed*other.dx,v.speed*v.dz-other.speed*other.dz)<B.collisionSpeed)continue;
        if(overlaps(v,other,B.collisionInset)){this.crash(v,other);if(!this.running)return;}
      }
      this.grid[gz*12+gx].push(v);
    }
    for(const person of this.people)if(person.active)for(const v of this.vehicles)if(v.active&&!v.crashLeft&&v.speed>.4&&overlaps(v,person)) {
      person.active=false;this.crash(v);if(!this.running)return;break;
    }
  }

  crash(a,b) {
    if(this.invulnerable)return;
    this.circuit?.clear();
    a.crashLeft=B.wreckTime;a.speed=0;a.state='Crashed';
    if(b){b.crashLeft=B.wreckTime;b.speed=0;b.state='Crashed';}
    this.stats.collisions++;this.flow=Math.max(1,this.flow-.85);this.stats.score=Math.max(0,this.stats.score-B.collisionPenalty);
    this.emit('collision',{x:a.x,z:a.z,pedestrian:!b});
    if(!b||this.mode==='hardcore'||this.stats.collisions>=3)this.end(!b?'pedestrian':'collision');
  }

  cross(direction) {
    if(this.people.some(p=>p.active&&p.direction===direction))return;
    const count=Math.min(this.waitingPeople[direction],8);let started=0;
    for(let i=0;i<count;i++) {
      const p=this.people.find(p=>!p.active);if(!p)break;
      Object.assign(p,{active:true,direction,t:-i*.12,speed:.16+this.rng()*.02});started++;
      const pos=rotate(-4,-this.map.entry-.8,direction);p.x=pos.x;p.z=pos.z;
    }
    this.waitingPeople[direction]-=started;
    if(started)this.emit('pedestriansStarted',{direction,count:started});
  }

  updatePeople(dt) {
    for(const p of this.people)if(p.active) {
      p.t+=dt*p.speed;rotate(-4+8*clamp(p.t,0,1),-this.map.entry-.8,p.direction,p);
      if(p.t>=1){p.active=false;this.stats.pedestrians++;this.stats.score+=Math.round(B.score.pedestrian*this.flow);this.emit('pedestrianPassed',p);}
    }
  }

  updateDirector(dt) {
    if(this.level&&this.elapsed>this.duration-12)return; // Finish by draining the final wave.
    this.spawnClock-=dt;
    if(this.spawnClock<=0) {
      const density=(this.level?.density??this.profile().density)*this.densityScale;
      this.spawnClock=1/Math.max(.05,density)*(.8+this.rng()*.4);
      let d=this.directions[Math.floor(this.rng()*this.directions.length)],kind;
      if(this.shift===0&&this.mode==='story'&&this.tutorial<4)d=1;
      if(this.event?.phase==='active'&&['surge','delivery'].includes(this.event.kind)) { d=this.event.direction;this.spawnClock*=.6;if(this.event.kind==='delivery')kind='van'; }
      const forced=this.forcedQueue[0];
      if(forced) {d=forced.direction;kind=forced.kind;}
      if(this.spawn(d,kind)&&forced)this.forcedQueue.shift();
    }
    if(this.level&&!this.guaranteed&&this.time>12) {
      this.guaranteed=true;
      if(this.shift===3)this.forcedQueue.push({direction:1,kind:'bus'},{direction:3,kind:'truck'});
      if(this.level.objectives?.some(o=>o.stat==='emergencyPassed'))this.forcedQueue.push({direction:2,kind:'ambulance'});
      if(this.shift===5)this.waitingPeople[1]+=3;
      if(this.shift>=6)this.triggerEvent(this.shift===6?'surge':'delivery',1);
    }
    if(this.level?.pedestrians||!this.level) {
      this.pedClock-=dt;
      if(this.pedClock<=0) {this.pedClock=(12+this.rng()*7)/this.profile().pedestrians;const d=this.directions[Math.floor(this.rng()*this.directions.length)];this.waitingPeople[d]=Math.min(16,this.waitingPeople[d]+1+Math.floor(this.rng()*3));}
    }
    if(this.level?.events||!this.level) {
      this.eventClock-=dt;
      if(this.eventClock<=0&&!this.event){this.eventClock=B.eventInterval/this.profile().events+this.rng()*15;this.triggerEvent();}
    }
  }

  triggerEvent(kind=EVENTS[Math.floor(this.rng()*EVENTS.length)],direction=this.directions[Math.floor(this.rng()*this.directions.length)]) {
    if(this.event)return;
    this.event={kind,direction,phase:'warning',remaining:B.eventWarning,collisions:this.stats.collisions};this.emit('eventWarning',this.event);
  }

  updateEvent(dt) {
    const e=this.event;if(!e)return;e.remaining-=dt;
    if(e.remaining>0)return;
    if(e.phase==='warning') {
      e.phase='active';e.remaining=B.eventDuration;
      if(e.kind==='broken') {
        const v=this.vehicles.find(v=>v.active&&!v.committed&&v.direction===e.direction)??this.spawn(e.direction,'car',0);
        if(v)v.broken=e.remaining;
      }
      if(e.kind==='wave')this.waitingPeople[e.direction]=Math.min(16,this.waitingPeople[e.direction]+8);
      this.emit('eventStarted',e);
    } else {
      if(this.stats.collisions===e.collisions){this.stats.eventsCompleted++;this.stats.score+=B.score.event;}
      this.emit('eventEnded',e);this.event=null;
    }
  }

  danger(direction) {
    for(const v of this.vehicles)if(v.active&&v.direction===direction&&!v.committed)for(const other of this.vehicles)if(other.active&&other.direction!==direction&&other.committed&&other.s<other.route.exitS+other.length/2&&this.conflicts[v.route.id][other.route.id])return true;
    return false;
  }

  updateDanger() {
    for(const direction of this.directions){const active=this.danger(direction);if(active!==this.dangerStates[direction]){this.dangerStates[direction]=active;this.emit('danger',{direction,active});}}
  }

  end(reason) { if(!this.running)return;this.running=false;this.reason=reason;if(reason==='complete'&&!this.stats.collisions)this.stats.cleanShifts=1;this.emit('ended',{reason,stats:this.stats}); }
  clearTraffic() {for(const v of this.vehicles)v.active=false;for(const p of this.people)p.active=false;}
}
