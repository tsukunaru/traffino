import { BALANCE as B, VEHICLES } from './config.js';
import { rotate, sample } from './routes.js';

// The first and last 19 metres of every route coincide with its normal lane.
// Both tapers are entirely inside the protected section between the two stop lines.
export const HIGHWAY={id:'highway',extent:32,entry:13,lane:1.95,width:8.0,directions:[0,2],routes:[]};
for(const direction of HIGHWAY.directions) for(const bypass of [false,true]){
  const points=[];
  for(const z of [-32,-13,-12,-11,-10,-9,-8,-7,-6,-5,-4,0,4,5,6,7,8,9,10,11,12,13,32]){
    const t=Math.max(0,Math.min(1,(13-Math.abs(z))/8));
    const x=-HIGHWAY.lane+(bypass?2*HIGHWAY.lane*t*t*(3-2*t):0);
    const p=rotate(x,z,direction);points.push([p.x,p.z]);
  }
  HIGHWAY.routes.push({direction,turn:0,exit:(direction+2)%4,bypass,points,entryIndex:1,exitIndex:points.length-2});
}
export const ROAD_DUTY={duration:150,goal:22,density:.36,tier:1,turns:false,objectives:[{stat:'northConvoy',target:2},{stat:'southConvoy',target:2}],repair:[36,58],crash:[64,88]};

export function highwayIncident(game,kind) {
  const blocked=game.rng()<.5?0:2;
  const [min,max]=ROAD_DUTY[kind],duration=min+Math.floor(game.rng()*(max-min+1))-game.recoveryDiscount;
  const vehicles=(kind==='crash'?['taxi','van']:['bus']).map((kindId,i)=>{
    const def=VEHICLES[kindId],p=rotate(-HIGHWAY.lane,i?2.4:kind==='crash'?-.8:0,blocked);
    const angle=-blocked*Math.PI/2+(kind==='crash'?(i?.10:-.19):0);
    return {...p,active:true,id:B.capacity+i,serial:-10-i,kind:kindId,direction:blocked,dx:Math.sin(angle),dz:Math.cos(angle),speed:0,
      length:def.length,width:def.width,turn:0,runnerAt:null,broken:kind==='repair'?duration:0,crashLeft:kind==='crash'?duration:0};
  });
  return {kind,blocked,remaining:duration,duration,phase:'closed',requested:null,vehicles};
}

export function highwayRoute(game,direction){
  const bypass=game.highway.phase!=='open' && direction===game.highway.blocked;
  return game.routes.find(r=>r.direction===direction && r.bypass===bypass);
}

export function insideWorkZone(car){
  return car.active && car.committed && car.s<=car.route.exitS+car.length/2+.25;
}

export function selectConvoy(game,direction){
  const h=game.highway;
  h.requested=h.requested===direction||game.signals[direction]?null:direction;
  for(const d of game.directions)game.signal(d,false);
  updateConvoy(game,0);
}

export function updateConvoy(game,dt){
  const h=game.highway;
  if(h.phase==='open')return;
  if(h.phase==='closed'){
    h.remaining=Math.max(0,h.remaining-dt);
    if(h.remaining<=1e-8){
      h.phase='draining';h.requested=null;
      for(const d of game.directions)game.signal(d,false);
    }
  }
  if(h.phase==='draining'){
    if(game.vehicles.some(insideWorkZone))return;
    h.phase='open';
    for(const obstacle of h.vehicles)obstacle.active=false;
    for(const car of game.vehicles)if(car.active&&!car.committed){
      car.route=highwayRoute(game,car.direction);sample(car.route,car.s,car);
    }
    for(const d of game.directions)game.signal(d,true);
    game.emit('highwayClear');return;
  }
  if(h.requested!==null && !game.signals[h.requested] && !game.vehicles.some(car=>car.direction!==h.requested&&insideWorkZone(car))){
    game.signal(h.requested,true);
  }
}
