import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Simulation } from '../src/simulation.js';
import { BALANCE as B } from '../src/config.js';
import { medalFor } from '../src/systems.js';
import { playBot } from '../tests/bot.mjs';

const campaign=[];
for(let shift=0;shift<8;shift++) {
  const game=new Simulation({mode:'story',shift});playBot(game);
  campaign.push({shift:shift+1,seed:game.seed,result:game.reason,medal:medalFor(game.stats,shift),stats:game.stats});
}
const rush=new Simulation({mode:'rush',seed:1007});playBot(rush);
const game=new Simulation({mode:'endless',seed:553,emit:()=>{}});game.invulnerable=true;game.densityScale=3;game.signals.fill(true);
const started=performance.now();let maxVehicles=0,maxPeople=0;
for(let i=0;i<108000;i++) {
  game.tick();
  if(i%120===0)for(let d=0;d<4;d++)game.cross(d);
  maxVehicles=Math.max(maxVehicles,game.vehicles.filter(v=>v.active).length);maxPeople=Math.max(maxPeople,game.people.filter(p=>p.active).length);
}
const milliseconds=performance.now()-started;
// Synthetic capacity test: long approaches keep every pooled vehicle alive and stopped.
const full=new Simulation({mode:'endless',director:false,map:{...game.map,extent:200},seed:2});full.invulnerable=true;
for(let i=0;i<B.capacity;i++){const v=full.spawn(i%4,'car',0);if(!v)throw Error('Capacity setup failed');v.s=10+Math.floor(i/4)*5;v.broken=10000;}
for(const p of full.people)Object.assign(p,{active:true,direction:p.id%4,t:-1000,speed:.16});
const capacityStart=performance.now();for(let i=0;i<10000;i++)full.tick();
const capacityStress={ticks:10000,vehicles:full.vehicles.filter(v=>v.active).length,pedestrians:full.people.filter(p=>p.active).length,averageMillisecondsPerTick:(performance.now()-capacityStart)/10000};
const report={date:new Date().toISOString(),runtime:process.version,platform:process.platform,campaign,rush:{seed:1007,result:rush.reason,stats:rush.stats},simulationStress:{ticks:108000,simulatedSeconds:108000*B.step,wallMilliseconds:Math.round(milliseconds),averageMillisecondsPerTick:milliseconds/108000,maxVehicles,maxPeople,vehicleCapacity:game.vehicles.length,pedestrianCapacity:game.people.length},limits:'CPU simulation measurement includes sampling overhead. It is not a GPU FPS measurement or a physical mobile-device benchmark.'};
report.capacityStress=capacityStress;
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({campaign:campaign.map(x=>({shift:x.shift,result:x.result,medal:x.medal})),rush:report.rush.result,simulationStress:report.simulationStress},null,2));
if(campaign.some(x=>x.result!=='complete'||!x.medal)||rush.reason!=='complete')process.exitCode=1;
