import { BALANCE as B, VEHICLES, STORY, INTERSECTIONS, EVENTS, SERVICE } from './config.js';
import { makeRoutes, conflictMatrix, sample, overlaps, rotate } from './routes.js';
import { random, difficulty, flowAfter, passScore, clamp, storyGoalMet } from './systems.js';

import { HIGHWAY, ROAD_DUTY, highwayIncident, highwayRoute, selectConvoy, updateConvoy } from './highway.js';

export class Simulation {
  constructor({ mode='endless', shift=0, map=INTERSECTIONS[0], seed, emit=()=>{}, director=true, skills=[], radio=skills.includes('radio'), survey=skills.includes('survey'), crew=skills.includes('crew'), incident='repair' } = {}) {
    seed ??= mode==='story'?(STORY[shift].seed??1000+shift):Date.now();
    if(mode==='highway')map=HIGHWAY;
    this.mode=mode; this.shift=shift; this.map=map; this.emit=emit; this.rng=random(seed); this.seed=seed;
    this.emergencyLimit = B.emergencyTimer + (radio ? SERVICE.radioSeconds : 0);
    this.warningSeconds = B.eventWarning + (survey ? SERVICE.warningLead : 0);
    this.recoveryDiscount = crew ? SERVICE.crewSeconds : 0;
    this.towDiscount=this.recoveryDiscount+(skills.includes('tow')?SERVICE.towSeconds:0);
    this.jamLimit=(mode==='hardcore'?B.hardJamGrace:B.jamGrace)+(skills.includes('reserve')?SERVICE.jamSeconds:0);
    this.flowDecay=B.flowDecay*(skills.includes('rhythm')?1-SERVICE.flowRetention:1);
    this.priorityBoost=skills.includes('priority')?SERVICE.priorityAcceleration:0;
    this.duty = { number: 1, passed: 0, promptPasses: 0, collisions:0 };
    this.routes=makeRoutes(map); this.conflicts=conflictMatrix(this.routes);
    this.directions=map.directions??[0,1,2,3];this.routesByDirection=this.directions.map(d=>this.routes.filter(r=>r.direction===d));
    this.vehicles=Array.from({length:B.capacity}, (_,id)=>({ id, active:false, x:0,z:0,dx:0,dz:1 }));
    this.people=Array.from({length:B.pedestrianCapacity}, (_,id)=>({id,active:false,x:0,z:0,dx:1,dz:0,length:.45,width:.45}));
    this.signals=[false,false,false,false];
    this.wrecks=[];this.lookAhead={};
    this.dangerStates=[false,false,false,false];this.dangerClock=0;
    this.queues=Array.from({length:4},()=>({count:0,length:0,average:0,longest:0,jam:0}));
    this.lanes=Array.from({length:4},()=>[]); this.grid=Array.from({length:144},()=>[]);
    this.waitingPeople=[0,0,0,0];this.pedestrianHead=[0,0,0,0]; this.pedClock=8; this.eventClock=B.eventInterval-SERVICE.warningLead;
    this.time=0; this.elapsed=0; this.day=1; this.timeOfDay=.22; this.flow=1; this.running=true; this.director=director;
    this.trafficProfile={};this.spawnClock=1; this.serial=0; this.event=null; this.tutorial=mode==='story'&&shift===0 ? 0 : 4;
    this.densityScale=1; this.invulnerable=false; this.guaranteed=false;
    this.stats={score:0,playTime:0,day:1,passed:0,cars:0,buses:0,emergencyPassed:0,emergencyFailed:0,pedestrians:0,collisions:0,jams:0,maxFlow:1,averageWait:0,totalWait:0,longestWait:0,longestQueue:0,rushHours:0,eventsCompleted:0,nights:0,cleanShifts:0};
    this.level=mode==='story'?STORY[shift]:mode==='highway'?ROAD_DUTY:null; this.duration=this.level?.duration??(mode==='rush'?B.rushDuration:Infinity);
    if(this.level?.objectives?.some(o=>o.stat==='pedestrians'))this.waitingPeople[1]=3;
    // Rush Hour rewards clearing every approach between collisions.
    this.circuit = mode === 'rush' ? new Set() : null;
    this.stats.circuits = 0;
    this.stats.promptPasses = 0;
    this.forcedQueue=[];
    this.renderVehicles=this.vehicles;
    if(mode==='highway'){
      this.highway=highwayIncident(this,incident==='crash'?'crash':'repair');
      this.renderVehicles=this.vehicles.concat(this.highway.vehicles);
      this.stats.northConvoy=this.stats.southConvoy=0;
      for(const d of this.directions){
        const lead=this.spawn(d,d===0?'bus':'truck',0);lead.s=lead.route.entry-B.stopMargin-lead.length/2;sample(lead.route,lead.s,lead);
        const second=this.spawn(d,'car',0);second.s=lead.s-(lead.length+second.length)/2-B.gap;sample(second.route,second.s,second);
      }
    }
    if (this.tutorial===0) this.spawn(0,'car',0);
  }

  command({type,direction}) {
    if (!this.running) return;
    if (type === 'stopAll') {
      if(this.highway)this.highway.requested=null;
      for (const car of this.vehicles) if (car.active && car.runnerAt !== null && !car.committed) {
        car.runnerAt = null;
        car.obey = true;
      }
      for (const d of this.directions) if (this.signals[d]) {
        if(this.highway)this.signal(d,false);else this.command({ type:'toggle', direction:d });
      }
      return;
    }
    if(type==='detour') {
      const option=this.detourOption();
      if(option && option.car.serial===direction) {
        option.car.route=option.route;option.car.turn=option.route.turn;
        this.emit('detourSet',option.car);
      }
      return;
    }
    if (!Number.isInteger(direction) || !this.directions.includes(direction)) return;
    if(type==='toggle') {
      if(this.highway && this.highway.phase!=='open'){
        if(this.highway.phase==='closed')selectConvoy(this,direction);
        return;
      }
      if(this.tutorial===2 && direction!==1) return;
      if(this.tutorial<2 && direction!==0) return;
      if(this.tutorial===1 && this.stats.passed===0 && this.signals[0]) return;
      this.signal(direction,!this.signals[direction]);
      if(this.tutorial===0) this.tutorial=1;
      else if(this.tutorial===1&&!this.signals[0]) { this.tutorial=2; this.spawn(1,'taxi',0); }
      else if(this.tutorial===2&&direction===1&&this.signals[1])this.tutorial=3;
    } else if(type==='pedestrian') this.cross(direction);
  }

  signal(direction,open){
    if(this.signals[direction]===open)return;
    this.signals[direction]=open;
    this.emit(open?'directionOpened':'directionClosed',{direction});
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
    const route=this.highway?highwayRoute(this,direction):choices.find(r=>r.turn===turn)??choices[0];if(!route)return null;turn=route.turn;
    Object.assign(v,{active:true,serial:++this.serial,kind,direction,route,turn,s:0,speed:0,maxSpeed:def.speed*(.94+this.rng()*.12),length:def.length,width:def.width,wait:0,age:0,committed:false,state:'Spawning',emergencyLeft:this.emergencyLimit,emergencyFailed:false,crashLeft:0,broken:0,runnerAt:null,obey:Boolean(this.highway),convoy:false});
    sample(route,0,v); this.emit('vehicleSpawned',v);
    if(def.emergencyPriority)this.emit('emergency',v);
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

  detourOption() {
    const site=this.event;
    if(site?.kind!=='works'||!['active','clearing'].includes(site.phase))return null;
    let car, route;
    for(const lane of this.lanes){
      const lead=lane.find(v=>v.active&&!v.committed);
      if(!lead||lead.s<lead.route.entry-7||lead.route.exit!==site.direction||lead.broken>0||lead.crashLeft>0)continue;
      if(car&&car.wait>=lead.wait)continue;
      const choices=this.routesByDirection[this.directions.indexOf(lead.direction)];
      const alternate=choices.find(r=>r.exit!==site.direction && r.turn!==1);
      if(alternate){car=lead;route=alternate;}
    }
    return car?{car,route}:null;
  }

  destinationClear(v) {
    const e=this.event;
    if(e?.kind==='works' && (e.phase==='clearing'||e.phase==='active')&&e.direction===v.route.exit)return false;
    if(e?.phase==='active'&&e.kind==='turn'&&e.direction===v.direction&&v.turn===1)return false;
    for (const wreck of this.wrecks) if (wreck.active
      && (wreck.s >= wreck.route.entry - wreck.length && wreck.s <= wreck.route.exitS + wreck.length
        ? this.conflicts[v.route.id][wreck.route.id] || v.route === wreck.route
        : wreck.route.exit === v.route.exit && wreck.s >= wreck.route.exitS)) return false;
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
    if(this.highway)updateConvoy(this,dt);
    const p=this.profile();
    for(const lane of this.lanes)lane.length=0;
    this.wrecks.length=0;
    for(const v of this.vehicles)if(v.active){
      this.lanes[v.direction].push(v);
      if(v.crashLeft>0)this.wrecks.push(v);
    }
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
    this.flow=clamp(this.flow-dt*this.flowDecay*(bad?5:1),1,B.flowMax);
    this.stats.maxFlow=Math.max(this.stats.maxFlow,this.flow);
    if (this.elapsed >= this.duration) {
      const met = this.level ? storyGoalMet(this.stats,this.level) : this.stats.passed >= SERVICE.rushGoal;
      this.end(met ? 'complete' : 'goal');
    } else if (!Number.isFinite(this.duration) && this.elapsed >= this.duty.number * SERVICE.dutySeconds) {
      const record = this.dutyRecord();
      this.duty = { number:record.number+1, passed:this.stats.passed, promptPasses:this.stats.promptPasses, collisions:this.stats.collisions };
      this.emit('dutyClosed', record);
    }
  }

  dutyRecord() {
    return { number:this.duty.number, passed:this.stats.passed-this.duty.passed,
      promptPasses:this.stats.promptPasses-this.duty.promptPasses, collisions:this.stats.collisions-this.duty.collisions };
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
    if (!v.committed) {
      const clear = (this.signals[v.direction] || def.reckless && !v.obey && v.s>=stop-.15) && this.destinationClear(v);
      if (def.reckless && !v.obey && !this.signals[v.direction] && clear && index===0 && v.s >= stop-.15 && v.runnerAt===null) {
        v.runnerAt = this.time + SERVICE.runnerWarning;
        this.emit('reckless',v);
      }
      const runningRed = v.runnerAt !== null && this.time >= v.runnerAt;
      if (!clear || (!this.signals[v.direction] && !runningRed)) limit=stop;
    }
    if(index>0) {
      const ahead=lane[index-1];
      if((v.s<v.route.entry+2&&ahead.s<ahead.route.entry+8)||ahead.route===v.route)limit=Math.min(limit,ahead.s-(ahead.length+v.length)/2-B.gap);
    }
    // Shared exits need following distance even when cars arrived from different approaches.
    if(v.s>v.route.exitS-2)for(const other of this.vehicles)if(other.active&&other!==v&&other.route.exit===v.route.exit&&other.s>other.route.exitS-2) {
      const gap=(other.s-other.route.exitS)-(v.s-v.route.exitS);
      if(gap>0)limit=Math.min(limit,v.s+gap-(other.length+v.length)/2-B.gap);
    }
    // Drivers already inside the junction brake short of a wreck in their swept path.
    for (const wreck of this.wrecks) if (wreck.active && wreck!==v && v.committed) {
      const braking=1+v.speed*v.speed/(2*def.brake);
      if(Math.hypot(wreck.x-v.x,wreck.z-v.z)>braking+(v.length+wreck.length)/2+1)continue;
      const pose=this.lookAhead;pose.length=v.length;pose.width=v.width;
      for(let ahead=.25;ahead<=braking+.5;ahead+=.5){
        sample(v.route,v.s+ahead,pose);
        if(overlaps(pose,wreck)){limit=Math.min(limit,v.s+Math.max(0,ahead-.55));break;}
      }
    }
    let target=v.maxSpeed*profile.speed;
    if(v.turn&&v.s>v.route.entry-1&&v.s<v.route.exitS)target*=.72;
    const gap=Math.max(0,limit-v.s);
    target=Math.min(target,Math.sqrt(2*def.brake*gap));
    if(v.broken>0){v.broken-=dt;target=0;}
    const acceleration=def.accel*(def.bus||def.emergencyPriority?1+this.priorityBoost:1);
    v.speed=Math.max(0,v.speed+clamp(target-v.speed,-def.brake*dt,acceleration*dt));
    v.s=Math.max(v.s,Math.min(v.s+v.speed*dt,limit));
    if(limit-v.s<.015)v.speed=0;
    if(!v.committed && v.s>stop+.025){
      if(this.signals[v.direction])v.runnerAt=null;
      v.convoy=this.highway?.phase==='closed';v.committed=true;
    }
    if(v.convoy && v.s>v.route.exitS+v.length/2+.25){
      this.stats[v.direction===0?'northConvoy':'southConvoy']++;v.convoy=false;
    }
    v.held=limit-v.s<1.5||v.broken>0;
    if(!v.committed&&v.held&&v.speed<1) {v.wait+=dt;this.stats.longestWait=Math.max(this.stats.longestWait,v.wait);}
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
      for(const v of this.lanes[d])if(v.active&&!v.committed&&v.held&&v.speed<2) {q.count++;q.length+=v.length+B.gap;q.longest=Math.max(q.longest,v.wait);q.average+=v.wait;}
      if(q.count)q.average/=q.count;
      this.stats.longestQueue=Math.max(this.stats.longestQueue,q.count);
      const critical=Math.min(B.jamLength,(this.map.extent-this.map.entry-B.stopMargin)*.83);
      if(q.length>=critical) { if(q.jam===0){this.stats.jams++;this.emit('jam',{direction:d});}q.jam+=dt; }
      else {if(q.jam>0)this.emit('jamResolved',{direction:d});q.jam=0;}
      if(q.jam>=this.jamLimit&&!this.invulnerable){this.end('jam');return;}
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
    a.runnerAt=null;a.crashLeft=B.wreckTime-this.towDiscount;a.speed=0;a.state='Crashed';
    if(b){b.runnerAt=null;b.crashLeft=a.crashLeft;b.speed=0;b.state='Crashed';}
    this.stats.collisions++;this.flow=Math.max(1,this.flow-.85);this.stats.score=Math.max(0,this.stats.score-B.collisionPenalty);
    this.emit('collision',{x:a.x,z:a.z,direction:a.direction,pedestrian:!b});
    if(!b||this.mode==='hardcore'||this.stats.collisions>=3)this.end(!b?'pedestrian':'collision');
  }

  queuePoint(direction,index,out) {
    return rotate(-4.7-(index%2)*.52,-this.map.entry-.8-Math.floor(index/2)*.55,direction,out);
  }
  cross(direction) {
    if(this.people.some(p=>p.active&&p.direction===direction))return;
    const count=Math.min(this.waitingPeople[direction],8);let started=0;
    for(let i=0;i<count;i++) {
      const p=this.people.find(p=>!p.active);if(!p)break;
      this.queuePoint(direction,i,p);
      Object.assign(p,{active:true,direction,appearance:direction*8+this.pedestrianHead[direction]+i,fromX:p.x,fromZ:p.z,t:-i*.12,speed:.16+this.rng()*.02});started++;
    }
    this.waitingPeople[direction]-=started;this.pedestrianHead[direction]+=started;
    if(started)this.emit('pedestriansStarted',{direction,count:started});
  }

  updatePeople(dt) {
    for(const p of this.people)if(p.active) {
      p.t+=dt*p.speed;
      const t=clamp(p.t,0,1),join=Math.min(1,t*4);
      rotate(-4.7+9.4*t,-this.map.entry-.8,p.direction,p);
      p.x=(p.fromX??p.x)*(1-join)+p.x*join;p.z=(p.fromZ??p.z)*(1-join)+p.z*join;
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
    if(this.level?.events&&!this.announced && this.time>12-SERVICE.warningLead){
      this.announced=true;
      this.triggerEvent(this.shift===6?'works':'delivery',1,true);
    }
    if(this.level&&!this.guaranteed&&this.time>12) {
      this.guaranteed=true;
      if(this.shift===3)this.forcedQueue.push({direction:1,kind:'bus'},{direction:3,kind:'truck'});
      if(this.level.objectives?.some(o=>o.stat==='emergencyPassed'))this.forcedQueue.push({direction:2,kind:'ambulance'});
      if(this.shift===5)this.waitingPeople[1]+=3;
      if(this.shift===7)this.forcedQueue.push({direction:3,kind:'reckless'});
    }
    if(this.level?.pedestrians||!this.level) {
      this.pedClock-=dt;
      if(this.pedClock<=0) {this.pedClock=(12+this.rng()*7)/this.profile().pedestrians;const d=this.directions[Math.floor(this.rng()*this.directions.length)];this.waitingPeople[d]=Math.min(16,this.waitingPeople[d]+1+Math.floor(this.rng()*3));}
    }
    if(this.level?.events||!this.level) {
      this.eventClock-=dt;
      if(this.eventClock<=0&&!this.event){this.eventClock=B.eventInterval/this.profile().events+this.rng()*15;this.triggerEvent(undefined,undefined,true);}
    }
  }

  triggerEvent(kind=EVENTS[Math.floor(this.rng()*EVENTS.length)],direction=this.directions[Math.floor(this.rng()*this.directions.length)],planned=false) {
    if(this.event||this.highway)return;
    const delayed=planned&&this.warningSeconds===B.eventWarning;
    this.event={kind,direction,phase:delayed?'scheduled':'warning',remaining:delayed?SERVICE.warningLead:this.warningSeconds,collisions:this.stats.collisions};
    if(!delayed)this.emit('eventWarning',this.event);
  }

  updateEvent(dt) {
    const e=this.event;if(!e)return;
    if (e.phase==='clearing') {
      if (this.vehicles.some(v=>v.active && v.committed && v.route.exit===e.direction && v.s < v.route.exitS + 10 + v.length/2)) return;
    } else {
      e.remaining-=dt;
      if(e.remaining>1e-8)return;
      if(e.phase==='scheduled'){e.phase='warning';e.remaining=B.eventWarning;this.emit('eventWarning',e);return;}
      if(e.phase==='warning' && e.kind==='works') { e.phase='clearing'; e.remaining=0; return; }
    }
    if(e.phase!=='active') {
      e.phase='active';e.remaining=B.eventDuration-(e.kind==='broken'?this.towDiscount:e.kind==='works'?this.recoveryDiscount:0);
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
