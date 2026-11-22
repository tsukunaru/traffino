import { VEHICLES } from './config.js';
import { rotate } from './routes.js';

const amber=0xffbe43, cream=0xffedc0, orange=0xdc6630, iron=0x48515a;

// These props use the same instance buffers and traffic clock as the cars.
export function drawRoadSite(view,game) {
  const site=game.event;
  if(site?.kind!=='works'||site.phase==='scheduled')return;
  const deployed=site.phase==='active', {lane,entry,width}=game.map;
  const angle=-site.direction*Math.PI/2;
  const origin=rotate(deployed?lane:width/2+1.35,-entry-6,site.direction);
  const root=view.carRoot;
  root.position.set(origin.x,.21,origin.z);root.rotation.set(0,angle,0);root.scale.set(1,1,1);root.updateMatrix();
  const box=(x,y,z,w,h,d,color,rz=0)=>view.instance(view.cars,x,y,z,w,h,d,color,0,0,rz,root.matrix);
  const lamp=(x,y,z,w,h,d,color)=>view.instance(view.lights,x,y,z,w,h,d,color,0,0,0,root.matrix);
  function fence(z) {
    for(const x of [-.92,.92]){
      box(x,.4,z,.13,.78,.14,iron);
      box(x,.075,z,.42,.14,.58,iron);
    }
    box(0,.76,z,2.45,.42,.16,cream);
    for(let i=-2;i<=2;i++)box(i*.45,.76,z+.005,.22,.40,.18,orange,-.37);
    for(const x of [-1,1])lamp(x,1.07,z,.19,.21,.19,Math.sin(game.time*5)>0?amber:orange);
  }
  fence(2.05);
  if(deployed){
    fence(-2.16);
    box(0,.031,-.12,2.18,.06,3.36,0x665d59);
    box(-.2,.073,-.4,.77,.04,2.25,0x403e42);
    for(let i=0;i<5;i++)box(-.69+i*.29,.097,-1.13,.13,.11,.18,0xa49680);
    for(const z of [-1.38,0,1.34]){
      box(-1.08,.055,z,.42,.11,.42,iron);
      view.instance(view.wheels,-1.08,.26,z,.34,.41,.34,orange,0,0,0,root.matrix);
      view.instance(view.wheels,-1.08,.51,z,.21,.13,.21,cream,0,0,0,root.matrix);
      view.instance(view.wheels,-1.08,.63,z,.15,.15,.15,orange,0,0,0,root.matrix);
    }
    // Pallet of replacement paving blocks beyond the hammer operator.
    box(.70,.09,-1.50,.77,.13,.55,0x936f50);
    for(const x of [.49,.85])for(const z of [-1.65,-1.36])box(x,.245,z,.33,.18,.26,0xa99e8d);
    // A hammer with handles, motor housing and a bit seated in the opened asphalt.
    const lift=Math.sin(game.time*14)*.028;
    box(.07,.52+lift,-.24,.11,.89,.12,iron);
    box(.07,.83+lift,-.24,.36,.46,.32,amber);
    box(.07,1.1+lift,-.24,.71,.1,.12,iron);
  }
  const driller=rotate(.07,deployed?-.73:-.4,site.direction);
  const lookout=rotate(deployed?1.22:.48,deployed?1.28:-1.48,site.direction);
  view.person(origin.x+driller.x,origin.z+driller.z,-1,game.time,false,angle,deployed);
  view.person(origin.x+lookout.x,origin.z+lookout.z,-2,game.time,false,angle+2.65);
}

export function drawHazards(view,v,time,base) {
  const wreck=v.crashLeft>0, broken=v.broken>0;
  if(!wreck&&!broken&&(v.runnerAt===null||v.s>v.route.exitS))return;
  const box=(batch,x,y,z,w,h,d,color,rz=0)=>view.instance(batch,x,y,z,w,h,d,color,0,0,rz,base);
  const top=1.92+(Math.sin(time*4)*.09);
  if(!wreck&&!broken){
    // Discrete yellow exclamation mark over the driver, legible from either side.
    box(view.lights,0,top+.49,0,.21,.59,.21,amber);
    box(view.lights,0,top+.03,0,.20,.19,.20,cream);
    return;
  }
  const nose=v.length*.39;
  box(view.cars,0,.87,nose,v.width*.83,.12,.67,wreck?0x755349:iron);
  view.instance(view.cars,-.04,1.04,nose-.01,v.width*.78,.09,.65,VEHICLES[v.kind].color,
    wreck?-.39:-.72,.05,wreck?.12:0,base);
  for(let i=0;i<3;i++){
    const t=(time*.64+i/3+v.id*.19)%1, size=(.32+.95*t)*Math.sin(t*Math.PI)**.45;
    const x=v.x+v.dx*nose+.28*t+.09*Math.sin(t*4+v.id);
    const z=v.z+v.dz*nose+.18*t;
    const camera=view.camera.rotation;
    view.instance(view.fumes,x,1.18+t*1.61,z,size,size*1.25,1,0x625b58,camera.x,camera.y,camera.z);
  }
  // Folding warning triangle directly behind the disabled vehicle.
  const z=-v.length*.5-.45;
  box(view.cars,0,.19,z,.70,.08,.31,iron);
  box(view.lights,0,.31,z,.65,.10,.08,orange);
  for(const side of [-1,1])box(view.lights,side*.16,.57,z,.095,.64,.08,orange,side*.50);
}
