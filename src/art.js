import * as THREE from 'three';
import { VEHICLES } from './config.js';

export const PALETTE={cream:0xffe7b0,stone:0xe8cfa4,road:0x80696b,ink:0x333c50,glass:0x476674,coral:0xde7058,mint:0x72b8ac,yellow:0xebbc55,lime:0xb8bd67,plum:0x785463,white:0xfff3d2};
// Eight keyframes, with the final midnight repeating the first for a seamless day.
export const SKY=[
  [0,0x252d53,0x77779c,0x99bcff,.65], [.18,0x586589,0xcaa398,0xf8bb8d,.85],
  [.25,0xd9cab0,0xffedcf,0xffd396,2.4], [.42,0xafd6dd,0xffecd1,0xffefc9,3.0],
  [.61,0xd2dbc2,0xffe6be,0xffdea6,2.6], [.73,0xbe889d,0xffcea0,0xffac70,1.8],
  [.83,0x60658f,0xd097aa,0xb0bbff,.8], [1,0x252d53,0x77779c,0x99bcff,.65]
];
export function lightPhase(time,out={}) {
  const t=((time%1)+1)%1;let i=0;while(i<SKY.length-2&&t>SKY[i+1][0])i++;
  out.index=i;out.blend=(t-SKY[i][0])/(SKY[i+1][0]-SKY[i][0]);out.night=Math.max(0,Math.min(1,Math.max((.25-t)/.075,(t-.72)/.11)));return out;
}

export function vehicleParts(kind) {
  const v=VEHICLES[kind],w=v.width,l=v.length,p=[],big=v.bus||['truck','van','ambulance','firetruck','garbage'].includes(kind);
  const part=(x,y,z,sx,sy,sz,color,role='body')=>p.push({x,y,z,sx,sy,sz,color,role});
  const c=kind==='ambulance'?PALETTE.white:v.color;
  part(0,.54,0,w,.58,l*.95,c);part(0,.27,0,w*.81,.15,l*.76,PALETTE.ink);
  if(v.bus){
    part(0,1.17,-.05,w*.97,1.13,l*.94,c);part(0,1.78,-.06,w,.16,l*.91,PALETTE.cream);
    part(0,1.28,l*.465,w*.80,.64,.04,PALETTE.glass);
    for(const side of [-1,1])for(let i=0;i<5;i++)part(side*w*.493,1.35,-l*.35+i*l*.165,.04,.58,l*.13,PALETTE.glass);
    part(w*.5,.89,l*.29,.04,1.17,.55,PALETTE.ink);part(w*.52,1.10,l*.29,.035,.54,.43,PALETTE.glass);
    part(0,.83,l*.48,w*.94,.15,.045,PALETTE.cream);
  }else if(big){
    part(0,1.08,l*.26,w*.93,.8,l*.37,c);part(0,1.24,l*.447,w*.79,.43,.04,PALETTE.glass);
    const cargo=kind==='truck'?0xd5af78:kind==='garbage'?0x689c7d:c;
    part(0,1.16,-l*.19,w*.99,1.10,l*.58,cargo);
    part(0,1.76,-l*.20,w,.12,l*.60,kind==='firetruck'?0xffeed0:cargo);
    for(const side of [-1,1])part(side*w*.47,1.24,l*.26,.045,.38,l*.24,PALETTE.glass);
    if(kind==='truck'||kind==='van')for(let i=0;i<3;i++)part(0,.9+i*.23,-l*.485,w*.85,.035,.03,PALETTE.cream);
    if(kind==='ambulance')for(const side of [-1,1]){part(side*w*.505,1.26,-l*.18,.03,.63,.19,0xe66d5c);part(side*w*.51,1.26,-l*.18,.03,.20,.65,0xe66d5c);part(side*w*.51,.7,0,.03,.12,l*.9,0xde6a58);}
    if(kind==='firetruck'){for(const x of [-.39,.39])part(x,1.9,-.32,.10,.12,l*.56,PALETTE.cream);for(let i=0;i<7;i++)part(0,1.9,-l*.32+i*.27,.86,.08,.07,PALETTE.cream);}
    if(kind==='garbage')part(0,1.05,-l*.49,w*.7,.65,.14,PALETTE.ink);
  }else{
    part(0,1.0,-l*.06,w*.88,.6,l*.52,c);part(0,1.31,-l*.08,w*.89,.14,l*.48,c);
    part(0,1.05,l*.209,w*.75,.38,.045,PALETTE.glass);part(0,1.04,-l*.333,w*.75,.36,.045,PALETTE.glass);
    for(const side of [-1,1])for(const z of [-.19,.08])part(side*w*.45,1.07,z*l,.04,.34,l*.21,PALETTE.glass);
    if(kind==='taxi'){part(0,1.49,0,.56,.22,.3,PALETTE.cream);part(0,1.51,.16,.33,.08,.025,PALETTE.ink);}
    if(kind==='police'){for(const side of [-1,1])part(side*w*.501,.61,0,.035,.20,l*.74,PALETTE.white);}
    if(kind==='pizza'){part(0,1.49,-.15,.75,.22,.66,0xf6c45b);part(0,1.61,-.15,.44,.04,.41,0xd2644e);}
    if(kind==='reckless'){part(0,1.1,-l*.44,w*1.04,.11,.29,PALETTE.ink);part(0,.86,l*.32,.19,.03,l*.28,PALETTE.cream);}
  }
  part(0,.46,l*.48,w*.88,.16,.14,PALETTE.cream);part(0,.44,-l*.48,w*.83,.13,.12,PALETTE.ink);
  for(const side of [-1,1]){part(side*w*.31,.69,l*.48,.26,.20,.045,0xffebb4,'headlight');part(side*w*.33,.69,-l*.482,.24,.17,.045,0xb54f4b,'brake');part(side*w*.43,.74,l*.44,.12,.12,.08,0xe5a454,'indicator');}
  if(v.emergencyPriority)for(const side of [-1,1])part(side*.25,big?1.89:1.48,big?l*.24:0,.32,.20,.27,side<0?0xf57e65:0x83c9ff,'siren');
  return p;
}

function building(v,parent,x,z,w,h,d,color,shop='',tower=false) {
  const g=new THREE.Group();g.position.set(x,.31,z);parent.add(g);const box=(...a)=>v.box(g,...a);
  box(0,h/2,0,w,h,d,color);box(0,.16,0,w+.22,.32,d+.22,0xc69d81);
  box(0,h+.06,0,w+.45,.28,d+.45,PALETTE.cream);box(0,h+.24,0,w-.42,.16,d-.42,0xcab985);
  for(const side of [-1,1]){box(side*w/2,h+.4,0,.19,.62,d+.25,PALETTE.cream);box(0,h+.4,side*d/2,w,.62,.19,PALETTE.cream);}
  const floors=Math.max(1,Math.floor(h/2.6)),front=d/2+.06;
  for(let row=0;row<floors;row++){
    const y=1.65+row*2.5;if(y+.9>h)continue;
    if(row>0)box(0,row*2.5-.15,0,w+.12,.16,d+.14,PALETTE.cream);
    const cols=tower?3:2;
    for(let col=0;col<cols;col++){
      const xx=(col-(cols-1)/2)*(w/(cols+.3)),ww=tower?w*.19:w*.25,hh=tower?1.95:1.35;
      box(xx,y,front,ww+.25,hh+.22,.15,PALETTE.cream);box(xx,y,front+.09,ww,hh,.12,PALETTE.plum);
      const win=box(xx-.06,y+.01,front+.16,ww*.78,hh*.86,.03,0x574650);win.material=(row+col)%3?v.windowMaterial:v.quietWindowMaterial;
      box(xx,y-hh/2-.03,front+.2,ww+.38,.16,.33,PALETTE.cream);
      if(row===1&&col===0&&!tower){box(xx,y-.8,front+.51,ww+.65,.19,.95,PALETTE.cream);box(xx,y-.36,front+.96,ww+.55,.08,.08,PALETTE.cream);for(let k=-2;k<=2;k++)box(xx+k*ww/4,y-.57,front+.96,.055,.43,.055,PALETTE.cream);box(xx,y-.62,front+.96,.65,.18,.29,PALETTE.coral);v.mesh(g,'sphere',xx,y-.43,front+.96,.74,.31,.38,PALETTE.lime);}
      if(row===0&&col===0&&!shop){box(xx-.1,.76,front+.15,ww*.8,1.5,.16,0x64505a);box(xx+.2,.72,front+.27,.07,.1,.04,PALETTE.cream);}
    }
    for(const side of [-1,1]){const win=box(side*(w/2+.04),y,0,.13,1.35,d*.46,PALETTE.plum);win.material=v.windowMaterial;box(side*(w/2+.08),y-.76,0,.3,.12,d*.51,PALETTE.cream);}
    if(row%2===0&&!tower){box(w*.23,y-.84,front+.34,.92,.56,.54,PALETTE.white);v.mesh(g,'cylinder',w*.23,y-.84,front+.64,.35,.055,.35,0x897577,Math.PI/2);}
  }
  box(w*.25,h+1.0,-d*.18,.98,1.3,1.05,color);box(w*.25,h+1.68,-d*.18,1.18,.14,1.21,PALETTE.cream);
  box(-w*.25,h+.48,-d*.16,1.18,.45,.82,0xb0b9ac);
  if(tower){v.mesh(g,'cylinder',-w*.22,h+1.08,d*.20,.07,1.2,.07,PALETTE.cream);const dish=v.mesh(g,'sphere',-w*.22,h+1.57,d*.20,.75,.17,.75,PALETTE.white);dish.rotation.z=.7;}
  if(shop){
    box(0,1.36,front+.14,w*.86,2.06,.2,PALETTE.cream);const glass=box(0,1.36,front+.26,w*.81,1.86,.07,0x54899a);glass.material=v.shopWindowMaterial;for(let i=-1;i<=1;i++)box(i*w*.255,1.4,front+.32,.1,1.9,.08,PALETTE.cream);
    box(-w*.07,1.21,front+.39,.07,.44,.07,PALETTE.cream);box(w*.065,1.21,front+.39,.07,.44,.07,PALETTE.cream);
    for(const side of [-1,1]){box(side*w*.47,.37,front+.5,.5,.59,.5,0xc38a60);v.mesh(g,'sphere',side*w*.47,.91,front+.5,.69,.87,.64,0x8fac6b);}
    for(let i=0;i<8;i++){const aw=v.box(g,-w*.48+(i+.5)*w*.12,2.68,front+.66,w*.121,.19,1.5,i%2?PALETTE.cream:color);aw.rotation.x=.12;box(-w*.48+(i+.5)*w*.12,2.5,front+1.36,w*.121,.35,.12,i%2?PALETTE.cream:color);}
    v.sign(g,shop,0,3.25,front+.22,w*.84,.8,shop==='PIZZA'?'#fff0bf':'#42635d');
    if(shop==='PIZZA'){
      const pizza=new THREE.Group();pizza.position.set(0,h+1.8,.05);g.add(pizza);
      v.mesh(pizza,'cylinder',0,0,0,2.7,.26,2.7,0xdca157,Math.PI/2);v.mesh(pizza,'cylinder',0,0,.17,2.39,.06,2.39,0xffdb79,Math.PI/2);
      for(const [px,py] of [[-.6,.45],[.5,.59],[0,-.24],[-.65,-.5],[.7,-.4]])v.mesh(pizza,'cylinder',px,py,.22,.38,.05,.38,0xd77753,Math.PI/2);
      v.sign(g,'PIZZA',0,h+.75,.45,w*.94,1.3,'#fff1bd');
    }
    if(shop==='CAFE'){
      v.mesh(g,'cylinder',0,h+.55,.15,1.85,.12,1.85,PALETTE.cream);v.mesh(g,'cylinder',0,h+1.1,.15,1.24,1.1,1.24,PALETTE.white);v.mesh(g,'cylinder',0,h+1.68,.15,1.37,.12,1.37,PALETTE.cream);v.mesh(g,'cylinder',0,h+1.75,.15,1.06,.035,1.06,0x6a4439);v.mesh(g,'torus',.78,h+1.16,.15,.83,.85,.65,PALETTE.cream);
    }
    if(shop==='MARKET')for(const side of [-1,1]){const cx=side*w*.32;box(cx,.47,front+.87,1.55,.67,.85,0xb98755);box(cx,.86,front+.93,1.38,.1,.72,PALETTE.cream);for(let k=0;k<6;k++)v.mesh(g,'sphere',cx+(k%3-1)*.36,1.02,front+.78+Math.floor(k/3)*.31,.32,.33,.32,side<0?0xe79755:0xa5bb64);}
  }
}

export function buildCity(v) {
  const g=v.city,map=v.map,e=map.extent+1,P=PALETTE;
  v.box(g,0,-.72,0,e*2,1.4,e*2,0xcfbba1);v.box(g,0,-.05,0,e*2,.18,e*2,P.stone);
  v.box(g,0,.06,0,e*2,.12,map.width+1.4,0xf2d8af);v.box(g,0,.065,0,map.width+1.4,.12,e*2,0xf2d8af);
  v.mesh(g,'plane',0,.196,0,e*2,map.width,1,P.road,-Math.PI/2);for(const side of [-1,1])v.mesh(g,'plane',0,.196,side*(e+map.width/2)/2,map.width,e-map.width/2,1,P.road,-Math.PI/2);
  for(let d=0;d<4;d++){
    const q=new THREE.Group();q.rotation.y=-d*Math.PI/2;g.add(q);
    for(let z=-e+1;z<-map.entry-2;z+=3)v.box(q,0,.206,z,.10,.018,1.38,P.cream);
    for(const side of [-1,1]){
      for(let z=-e+1;z<-map.entry-1;z+=2)v.box(q,side*(map.width/2+.27),.25,z,.42,.28,1.95,P.cream);
      v.box(q,side*(map.width/2+1.55),.21,-(e+map.entry)/2,2,.22,e-map.entry-1,0xf5dbb1);
    }
    v.box(q,-map.lane,.21,-map.entry-1.6,map.width/2-.35,.024,.26,P.white);
    for(let x=-map.width/2+.3;x<map.width/2;x+=.82)v.box(q,x,.21,-map.entry-.8,.46,.026,1.09,P.white);
    for(const z of [-11,-21]){
      v.mesh(q,'cylinder',-map.width/2-1.4,2.3,z,.17,4.4,.17,P.ink);v.box(q,-map.width/2-1.02,4.49,z,.95,.17,.17,P.ink);
      const lamp=v.box(q,-map.width/2-.68,4.31,z,.62,.25,.59,P.cream);lamp.material=v.lampMaterial;
      const pos=new THREE.Vector3(-map.width/2-.68,.23,z).applyAxisAngle(v.up,-d*Math.PI/2);v.lampPositions.push(pos);
    }
    for(let i=0;i<2;i++){
      const x=-7.5-i*3.8,z=-11.5-i*4.6;
      v.box(q,x,.36,z,2.6,.43,2.5,0xd4b793);v.box(q,x,.6,z,2.3,.08,2.2,0x83995e);
      v.mesh(q,'cylinder',x,1.35,z,.26,1.7,.26,0x9c7756);
      for(const [dx,dy,dz,r] of [[0,2.5,0,1.2],[-.65,2.18,.2,.77],[.6,2.45,-.1,.8]])v.mesh(q,'sphere',x+dx,dy,z+dz,r*1.6,r*1.65,r*1.6,i?0x9ab578:0x80a778);
    }
    v.box(q,-10.8,.76,-7.25,2,.2,.66,0xbe8562);v.box(q,-10.8,1.07,-7.57,2,.51,.16,0xbe8562);
    for(const x of [-11.5,-10.1])v.box(q,x,.47,-7.25,.12,.5,.65,P.ink);
    v.box(q,-7.8,.71,-20,.61,1,.61,0x67938b);v.box(q,-7.8,1.27,-20,.69,.15,.7,P.ink);
    // A little sidewalk delivery parcel and flower boxes, away from real crossings.
    v.box(q,-8.7,.52,-19.5,.55,.52,.5,0xdcb585);v.box(q,-8.7,.80,-19.5,.12,.025,.5,P.cream);
    for(let i=0;i<3;i++)v.mesh(q,'sphere',-12.5+i*.42,.63,-7.25,.32,.45,.32,i%2?0xdd957c:0xebc569);
  }
  building(v,g,-16,-18,7,8.2,6.2,P.mint,'',false);
  building(v,g,-23,-10,4.6,5.5,5.5,P.lime);
  building(v,g,-8.9,-22.2,4.4,5.5,5.3,P.coral);
  building(v,g,15,-19.8,6.9,10,6.1,0xc9b28b,'',true);
  building(v,g,22,-10.5,5.6,7.8,6.3,P.coral);
  building(v,g,8.5,-22.6,4.4,5.3,4.6,P.yellow);
  building(v,g,-17.5,17.5,8.3,4.5,6.7,P.coral,'PIZZA');
  building(v,g,-23,9.1,4.5,4.2,4.2,P.yellow,'CAFE');
  building(v,g,16.7,18.3,7.2,5.8,6.4,P.mint,'MARKET');
  building(v,g,22.7,9.4,4.3,4.2,5.2,0xd99488);
  // The supplied street-prop sheet informs this small bus shelter; keep it off the road.
  for(const z of [-14.8,-10.8])v.box(g,7.5,1.55,z,.15,2.6,.15,P.mint);
  v.box(g,7.5,2.96,-12.8,1.65,.24,4.5,P.mint);v.box(g,8.12,1.5,-12.8,.12,2.7,4.1,0xb5d2c7);
  v.box(g,7.8,.85,-12.8,.66,.18,3,0xcb9571);v.sign(g,'BUS',7.48,2.45,-10.61,1,.38,'#fff3d2');
  for(const x of [-21,-19]){v.mesh(g,'cylinder',x,.7,12,.15,1,.15,P.cream);v.mesh(g,'cylinder',x,1.2,12,1.25,.12,1.25,P.cream);}
  if(map.id==='harbor'){
    v.box(g,e-2,.27,0,3.4,.16,e*2,0x70b5c5);
    for(let z=-e+1;z<e;z+=3){v.box(g,e-4,.77,z,.16,1.1,.16,P.cream);v.box(g,e-4,1.16,z,.16,.12,3.1,P.cream);}
  }
}
