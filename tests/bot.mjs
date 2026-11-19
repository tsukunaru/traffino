import { BALANCE as B } from '../src/config.js';
export function playBot(game) {
  let pedUntil=0,pedRequested=false;
  for(let frame=0;frame<60*(Number.isFinite(game.duration)?game.duration+40:720)&&game.running;frame++) {
    if(game.tutorial===0)game.command({type:'toggle',direction:0});
    if(game.tutorial===1&&game.stats.passed>0)game.command({type:'toggle',direction:0});
    if(game.tutorial===2)game.command({type:'toggle',direction:1});
    if(game.tutorial>=4&&frame%12===0) {
      const wanted=[false,false,false,false];
      const crossing=game.vehicles.filter(v=>v.active&&v.committed&&v.s<v.route.exitS+v.length/2+1);
      const candidates=game.vehicles.filter(v=>v.active&&!v.committed);
      if(game.time>=pedUntil) {
        if(game.level?.objectives?.some(o=>o.stat==='pedestrians')&&Math.max(...game.waitingPeople)>=3&&game.queues.every(q=>q.count<2)&&game.stats.pedestrians<3)pedRequested=true;
        if(pedRequested) {
          if(!game.vehicles.some(v=>v.active&&v.committed)){for(let d=0;d<4;d++)game.command({type:'pedestrian',direction:d});pedUntil=game.time+8;pedRequested=false;}
        } else {
          const priority=game.queues.map((q,i)=>({i,weight:q.count*20+q.longest+(game.event?.direction===i?25:0)})).sort((a,b)=>b.weight-a.weight);
          const reserved=[...crossing];
          for(const {i} of priority) {
            const incoming=candidates.filter(v=>v.direction===i&&v.s>v.route.entry-7);
            if(incoming.length&&!incoming.some(v=>reserved.some(other=>other.direction!==i&&game.conflicts[v.route.id][other.route.id])))wanted[i]=true;
            reserved.push(...incoming);
          }
        }
      }
      for(let d=0;d<4;d++)if(wanted[d]!==game.signals[d])game.command({type:'toggle',direction:d});
    }
    game.tick();
  }
  return game.stats;
}

