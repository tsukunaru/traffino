import * as THREE from 'three';
import { VEHICLES, SERVICE } from './config.js';

export const PALETTE={cream:0xffe7b0,stone:0xe8cfa4,road:0x656974,ink:0x333c50,glass:0x476674,coral:0xde7058,mint:0x72b8ac,yellow:0xebbc55,lime:0xb8bd67,plum:0x785463,white:0xfff3d2};
// Eight keyframes, with the final midnight repeating the first for a seamless day.
export const OFFICER_POST={x:5.65,z:5.70};
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

export function vehicleParts(kind,onDuty=false) {
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
    const cargo=kind==='truck'?(onDuty?0x297b7b:0xd5af78):kind==='garbage'?0x689c7d:c;
    part(0,1.16,-l*.19,w*.99,1.10,l*.58,cargo);
    part(0,1.76,-l*.20,w,.12,l*.60,kind==='firetruck'?0xffeed0:cargo);
    for(const side of [-1,1])part(side*w*.47,1.24,l*.26,.045,.38,l*.24,PALETTE.glass);
    if(kind==='truck'||kind==='van')for(let i=0;i<3;i++)part(0,.9+i*.23,-l*.485,w*.85,.035,.03,PALETTE.cream);
    if(kind==='ambulance')for(const side of [-1,1]){part(side*w*.505,1.26,-l*.18,.03,.63,.19,0xe66d5c);part(side*w*.51,1.26,-l*.18,.03,.20,.65,0xe66d5c);part(side*w*.51,.7,0,.03,.12,l*.9,0xde6a58);}
    if(kind==='firetruck'){for(const x of [-.39,.39])part(x,1.9,-.32,.10,.12,l*.56,PALETTE.cream);for(let i=0;i<7;i++)part(0,1.9,-l*.32+i*.27,.86,.08,.07,PALETTE.cream);}
    if(kind==='garbage')part(0,1.05,-l*.49,w*.7,.65,.14,PALETTE.ink);
  }else{
    part(0,1.035,-l*.055,w*.89,.59,l*.59,0x426575);p[p.length-1].shape='cab';
    part(0,1.344,-l*.061,w*.83,.082,l*.345,c);
    for(const side of [-1,1]){
      part(side*w*.439,1.028,-l*.047,.05,.48,.087,c);
      part(side*w*.44,.817,-l*.057,.05,.055,l*.53,c);
    }
    part(0,.852,l*.32,w*.76,.059,l*.275,c);
    part(0,.836,-l*.39,w*.8,.056,l*.16,c);
    if(kind==='taxi'){part(0,1.49,0,.56,.22,.3,PALETTE.cream);part(0,1.51,.16,.33,.08,.025,PALETTE.ink);}
    if(kind==='police'){for(const side of [-1,1])part(side*w*.501,.61,0,.035,.20,l*.74,PALETTE.white);}
    if(kind==='pizza'){part(0,1.49,-.15,.75,.22,.66,0xf6c45b);part(0,1.61,-.15,.44,.04,.41,0xd2644e);}
    if(kind==='reckless'){part(0,1.1,-l*.44,w*1.04,.11,.29,PALETTE.ink);part(0,.86,l*.32,.19,.03,l*.28,PALETTE.cream);}
  }
  for(const side of [-1,1]){
    part(side*w*.52,big?1.22:1.07,l*(big?.32:.18),.19,.12,.18,c);
    part(side*w*.54,big?1.22:1.07,l*(big?.32:.18)-.055,.15,.08,.083,0xa9cbca);
    part(side*w*.505,.78,l*.01,.028,.039,l*.66,PALETTE.cream);
    part(side*w*.466,big?1.03:.94,l*.08,.038,.043,.14,PALETTE.ink);
  }
  part(0,.58,l*.482,w*.38,.12,.041,PALETTE.ink);
  part(0,.447,-l*.492,w*.26,.095,.025,PALETTE.cream);
  part(0,.46,l*.48,w*.88,.16,.14,PALETTE.cream);part(0,.44,-l*.48,w*.83,.13,.12,PALETTE.ink);
  for(const side of [-1,1]){part(side*w*.31,.69,l*.48,.26,.20,.045,0xffebb4,'headlight');part(side*w*.33,.69,-l*.482,.24,.17,.045,0xb54f4b,'brake');part(side*w*.43,.74,l*.44,.12,.12,.08,0xe5a454,'indicator');}
  if(onDuty){
    if(kind==='truck')for(const z of [-1.72,-.16])part(0,1.27,z,1.63,1.16,.09,0xe9cf88);
    part(0,1.91,-.8,.95,.08,.95,0x31444a);p.at(-1).yaw=Math.PI/4;
    part(0,1.97,-.8,.71,.05,.71,0xffdc79);p.at(-1).yaw=Math.PI/4;
  }
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
    for(const xx of [-w*.245,w*.245]){
      const rear=-d*.5;
      box(xx,y,rear-.07,w*.25+.18,1.48,.12,PALETTE.cream);
      box(xx,y,rear-.15,w*.24,1.24,.07,PALETTE.glass).material=v.quietWindowMaterial;
      box(xx,y+.13,rear-.21,w*.24,.06,.04,PALETTE.stone);
      box(xx,y-.77,rear-.14,w*.28,.13,.26,PALETTE.stone);
    }
    if(row%2===0&&!tower){box(w*.23,y-.84,front+.34,.92,.56,.54,PALETTE.white);v.mesh(g,'cylinder',w*.23,y-.84,front+.64,.35,.055,.35,0x897577,Math.PI/2);}
  }
  // Plinths, drainpipes and recessed windows continue around the side elevations.
  for(const side of [-1,1]){
    const sx=side*(w/2+.13);
    v.mesh(g,'cylinder',sx,h*.49,-d*.41,.12,h*.95,.12,0x71918b);
    for(let y=1.2;y<h;y+=2.5){
      box(sx,y,-d*.41,.18,.115,.20,PALETTE.cream);
      box(sx,y+.42,0,.12,1.2,.09,PALETTE.cream);
      box(sx,y+.58,0,.13,.08,d*.44,PALETTE.cream);
    }
    for(let y=.7;y<h-.5;y+=1.28)box(side*(w*.5-.12),y,front-.04,.40,.26,.20,PALETTE.stone);
  }
  // Glazed rooflights and narrow brass mullions catch the afternoon light.
  if(w>=6 && !shop) {
    box(0,h+.49,d*.18,w*.38,.24,1.29,PALETTE.cream);
    box(0,h+.65,d*.18,w*.34,.14,1.11,PALETTE.glass);
    for(const offset of [-.1,0,.1])box(w*offset,h+.735,d*.18,.075,.035,1.12,PALETTE.cream);
  }
  box(w*.25,h+1.0,-d*.18,.98,1.3,1.05,color);box(w*.25,h+1.68,-d*.18,1.18,.14,1.21,PALETTE.cream);
  box(-w*.25,h+.48,-d*.16,1.18,.45,.82,0xb0b9ac);
  for(let vent=0;vent<5;vent++)box(-w*.25-.43+vent*.21,h+.72,-d*.16,.068,.055,.65,PALETTE.glass);
  box(w*.25,h+1.79,-d*.18,.63,.10,.65,PALETTE.ink);
  if(tower){v.mesh(g,'cylinder',-w*.22,h+1.08,d*.20,.07,1.2,.07,PALETTE.cream);const dish=v.mesh(g,'sphere',-w*.22,h+1.57,d*.20,.75,.17,.75,PALETTE.white);dish.rotation.z=.7;}
  if(shop){
    for(const side of [-1,1]){
      const edge=side*(w*.5+.075);
      box(edge,1.51,d*.1,.19,1.97,d*.54,PALETTE.cream);
      box(edge+side*.1,1.52,d*.1,.09,1.75,d*.49,PALETTE.glass);
      for(let k=-1;k<=1;k++)box(edge+side*.16,1.52,d*(.10+k*.15),.08,1.76,.085,PALETTE.cream);
      for(let k=0;k<6;k++)box(edge+side*.43,2.63,d*(-.16+k*.105),.95,.17,d*.105,k%2?PALETTE.cream:color).rotation.z=-side*.16;
    }
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

function clockHall(v, g, x, z) {
  const p = PALETTE;
  building(v, g, x, z, 7, 6.4, 5.8, p.mint);
  v.box(g, x, 8.6, z, 3.5, 4.6, 3.5, p.coral);
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const face = new THREE.Group();
    face.position.set(x, 9, z); face.rotation.y = angle; g.add(face);
    v.mesh(face, 'cylinder', 0, 0, 1.80, 2.65, .18, 2.65, p.ink, Math.PI/2);
    v.mesh(face, 'cylinder', 0, 0, 1.94, 2.30, .13, 2.30, p.cream, Math.PI/2);
    for(let hour=0;hour<12;hour++){
      const mark=hour*Math.PI/6;
      v.box(face,.94*Math.sin(mark),.94*Math.cos(mark),2.03,.09,.20,.07,p.plum).rotation.z=-mark;
    }
    v.box(face, -.19, .18, 2.09, .13, .63, .08, p.ink).rotation.z=.80;
    v.box(face, .29, .24, 2.14, .11, .85, .07, p.ink).rotation.z=-.90;
  }
  for (let level=0;level<4;level++) {
    const width=4.4-level*.85;
    v.box(g,x,11.15+level*.49,z,width,.55,width,p.glass);
  }
  v.mesh(g,'sphere',x,13.1,z,.68,.72,.68,p.yellow);
}

function drawQuay(v, g, e) {
  const p = PALETTE;
  // The east approach continues over a causeway between the two basins.
  for (const side of [-1, 1]) {
    const length = e - 5.4;
    const center = side * (5.4 + length / 2);
    v.box(g,e-3,.24,center,5.9,.18,length,0x42989f);
    for(let i=0;i<9;i++){
      const z=side*(6.6+i*2.3);
      v.box(g,e-1.5-(i%3)*1.2,.35,z,i%2?.85:1.4,.035,.10,0x9bd6cb);
    }
    for(let z=6.2;z<e-1;z+=3.1) {
      v.box(g,e-6.15,.83,side*z,.24,1.28,.24,p.cream);
      if(z+3.1<e-1)v.box(g,e-6.15,1.25,side*(z+1.55),.15,.12,3.12,p.glass);
    }
  }
  const x=e-3, z=-19;
  v.mesh(g,'cylinder',x,.60,z,4.2,.52,4.2,p.stone);
  for(let i=0;i<5;i++){
    const diameter=2.65-.19*i;
    v.mesh(g,'cylinder',x,1.4+1.1*i,z,diameter,1.13,diameter,i%2?p.coral:p.white);
  }
  v.mesh(g,'cylinder',x,6.65,z,2.55,.25,2.55,p.ink);
  v.mesh(g,'cylinder',x,7.28,z,1.55,1.1,1.55,p.yellow).material=v.lampMaterial;
  for(const offset of [-.81,.81])v.box(g,x+offset,7.28,z,.16,1.2,.15,p.ink);
  v.mesh(g,'cylinder',x,8,z,2.45,.34,2.45,p.coral);
  for(let plank=0;plank<13;plank++)
    v.box(g,e-5.25,.67,11.2+plank*.49,1.65,.25,.47,plank%3?p.stone:0xbe8562);
  for(const postZ of [11.1,14.1,17.1])
    v.mesh(g,'cylinder',e-4.48,.72,postZ,.32,1.35,.32,p.glass);
  const boatX=e-2.7, boatZ=14;
  v.mesh(g,'sphere',boatX,.71,boatZ,2.75,1.15,6.25,p.glass);
  v.box(g,boatX,1.19,boatZ,2.3,.31,4.9,p.cream);
  v.box(g,boatX,1.93,boatZ+.6,1.72,1.22,1.98,p.mint);
  v.box(g,boatX,2.15,boatZ+1.61,1.42,.50,.08,p.glass);
  v.box(g,boatX,2.64,boatZ+.60,2.03,.20,2.23,p.coral);
  v.mesh(g,'cylinder',boatX,2.2,boatZ-1.0,.59,1.55,.59,p.ink);
  v.mesh(g,'cylinder',boatX,2.90,boatZ-1.0,.66,.30,.66,p.yellow);
  const craneX=15;
  for(const offset of [-1.4,1.4]) {
    v.box(g,craneX+offset,3.5,-18,.65,7,.8,p.yellow);
    v.box(g,craneX,3.6,-18,.27,6.6,.38,p.yellow).rotation.z=offset>0?.42:-.42;
  }
  v.box(g,craneX+2.5,7.1,-18,9.8,.7,1.2,p.yellow);
  v.box(g,craneX-1.3,7.9,-18,2.0,1.45,1.7,p.glass);
  v.box(g,craneX+6.6,5.6,-18,.12,2.5,.12,p.ink);
  for(const [cx,cy,cz,color] of [[16,1.15,-11,p.mint],[16,1.15,-14,p.coral],[16,3.05,-14,p.yellow],[20.1,4.1,-18,p.coral]]) {
    v.box(g,cx,cy,cz,4.6,1.85,2.1,color);
    for(let rib=-2;rib<=2;rib+=.5)v.box(g,cx+rib,cy,cz+1.06,.10,1.6,.12,color);
  }
}

function dutyStation(v, city) {
  const p=PALETTE, booth=new THREE.Group();
  booth.position.set(11.6,.22,10.9);
  booth.rotation.y=-.28;
  city.add(booth);
  v.postPosition=booth.position;
  const box=(...parts)=>v.box(booth,...parts);
  const round=(...parts)=>v.mesh(booth,'cylinder',...parts);

  // Stepped kerb, enamel panels, glazed corner and a folding street counter.
  box(0,.14,0,4.9,.28,3.95,p.stone);
  box(-.3,.17,2.05,2.8,.19,.54,p.cream);
  box(0,.30,0,4.44,.19,3.46,p.ink);
  box(0,.90,0,4.29,1.18,3.35,p.mint);
  for(const x of [-1.55,-.78,0,.78,1.55])box(x,.91,1.68,.055,1.08,.09,p.glass);
  box(0,1.5,0,4.48,.18,3.51,p.cream);
  box(0,2.23,-1.58,4.2,1.42,.14,p.glass);
  for(const x of [-2.04,2.04]){
    box(x,2.24,0,.12,1.49,3.09,p.glass).material=v.shopWindowMaterial;
    box(x,2.23,.06,.18,1.51,.11,p.cream);
    for(const z of [-1.57,1.57])box(x,2.25,z,.19,1.56,.2,p.cream);
  }
  box(0,2.27,-1.45,1.82,.74,.1,p.cream);
  for(const x of [-1.49,1.43]){
    box(x,2.26,-1.44,.64,.92,.18,p.plum);
    for(const h of [1.98,2.25,2.52])box(x,h,-1.29,.58,.10,.24,p.cream);
  }
  for(const y of [2.1,2.31,2.53])box(0,y,-1.38,1.32,.046,.04,p.glass);
  box(-.18,1.57,1.76,3.25,.17,.60,p.plum);
  box(-.18,1.67,1.79,3.28,.08,.62,p.cream);
  for(const x of [-1.35,1])box(x,1.42,1.76,.13,.43,.55,p.ink).rotation.x=-.2;
  box(0,3.03,0,4.69,.25,3.79,p.ink);
  box(0,3.19,0,4.75,.14,3.86,p.yellow);
  box(0,3.32,0,4.63,.17,3.74,p.mint);
  box(0,3.45,-.12,3.86,.12,3.05,p.glass);
  for(const x of [-1.5,-.75,0,.75,1.5])box(x,3.53,-.12,.06,.05,2.85,p.mint);
  // Glazed eaves, a striped canvas valance and the lamp over the working counter.
  for(let i=0;i<8;i++){
    const x=-1.82+i*.52, color=i%2?p.cream:p.mint;
    box(x,2.99,1.92,.521,.12,.72,color).rotation.x=.23;
    box(x,2.83,2.24,.521,.19,.12,color);
  }
  const taskLamp=box(-.92,2.78,.97,.93,.14,.36,p.cream);
  taskLamp.material=v.lampMaterial;
  box(-1.47,1.81,1.57,.25,.25,.24,p.coral);
  for(const x of [-1.53,-1.42])box(x,2.01,1.58,.05,.32,.05,p.yellow).rotation.z=x===-1.53?.18:-.1;
  for(const z of [-.97,.1,1.16])box(2.16,.95,z,.08,.83,.05,p.glass);
  box(2.2,.89,.23,.13,.61,.85,p.cream);
  for(const y of [.72,.87,1.02])box(2.29,y,.23,.07,.05,.66,p.glass);
  // A raised street number and three signal lenses read at diorama scale.
  box(-1.1,3.64,1.48,1.75,.73,.25,p.cream);
  box(-1.10,3.66,1.64,1.58,.58,.08,p.glass);
  v.sign(booth,'01',-1.1,3.66,1.69,1.43,.55,'#fff1c7');
  for(const [i,col] of [p.coral,p.yellow,p.mint].entries())round(.22+i*.38,3.15,1.98,.22,.06,.22,col,Math.PI/2);
  for(let i=0;i<v.postGrade;i++)box(1.58-i*.28,2.89,1.92,.15,.3,.055,p.yellow).rotation.z=-.42;

  if(v.postSkills.has('board')){
    // The double-arrow enamel board faces the junction outside the booth.
    for(const x of [-3.07,-2.27])box(x,1.2,1.15,.11,1.94,.12,p.ink);
    box(-2.67,2,1.15,1.62,1.40,.21,p.cream);
    box(-2.67,2,1.29,1.44,1.22,.12,p.glass);
    box(-2.99,1.98,1.38,.105,.65,.06,p.white);
    for(const side of [-1,1])box(-2.99+side*.1,2.23,1.38,.095,.29,.06,p.yellow).rotation.z=side*.78;
    box(-2.47,1.9,1.38,.105,.47,.06,p.white);
    box(-2.30,2.10,1.38,.41,.105,.06,p.white);
    for(const side of [-1,1])box(-2.19,2.10+side*.1,1.38,.29,.095,.06,p.yellow).rotation.z=-side*.78;
  }
  if(v.postSkills.has('ledger')){
    box(.85,1.84,1.65,.81,.30,.62,p.mint);
    box(.85,2.03,1.63,.69,.13,.55,p.cream);
    round(.85,2.19,1.45,.31,.69,.31,p.white).rotation.z=Math.PI/2;
    box(.85,2.05,1.90,.50,.045,.35,p.white).rotation.x=.25;
  }
  if(v.postSkills.has('radio')){
    round(1.66,3.69,-1.22,.43,.47,.43,p.cream);
    round(1.66,4.71,-1.22,.105,2.15,.105,p.ink);
    for(const [y,w] of [[4.75,.82],[5.12,1.19],[5.47,1.63]])box(1.66,y,-1.22,w,.075,.095,p.yellow);
    box(-.86,1.88,1.63,.79,.38,.51,p.ink);
    for(const x of [-1.10,-.96,-.82])box(x,1.9,1.90,.045,.18,.06,p.cream);
  }
  if(v.postSkills.has('survey')){
    box(2.82,.92,1.5,.13,1.75,.13,p.ink);
    box(2.82,1.84,1.5,1.2,.92,.12,p.cream);
    box(2.82,1.84,1.59,.16,.71,.06,p.glass);
    box(2.82,1.8,1.6,1.05,.13,.06,p.glass);
  }
  if(v.postSkills.has('crew')){
    box(-1.12,.49,2.62,.95,.58,.56,p.coral);
    box(-1.12,.82,2.62,1,.13,.58,p.yellow);
    box(-1.12,.94,2.62,.39,.10,.13,p.ink);
  }
  if(v.postSkills.has('dividend')){
    box(.74,.98,1.78,1.65,.72,.14,p.glass);
    box(.74,1.02,1.88,1.44,.55,.07,p.yellow);
    v.sign(booth,'+'+SERVICE.premium,.74,1.03,1.93,1.38,.52,'#343f44');
  }
}

function riverBridge(v){
  const g=v.city,p=PALETTE, road=v.map;
  const box=(...args)=>v.box(g,...args);
  box(0,-1.27,0,43,1.5,66,0xb39c78);
  for(const side of [-1,1])box(0,-.28,side*19.2,42.8,.53,27.5,0x94ac76);
  box(0,-.37,0,42.7,.15,11.1,0x68b1ba);
  for(const side of [-1,1])for(let i=0;i<13;i++)
    box(side*(5.5+(i*3.37)%15),-.286,Math.sin(2.9*i)*4,.46+i%4*.36,.018,.07,0xa0cbc3);
  for(const z of [-4.9,4.9])box(0,-.58,z,road.width+1.6,.95,1.6,0xb8a78b);
  box(0,.015,0,road.width+1.65,.29,65.8,p.stone);
  box(0,.15,0,road.width,.12,65.7,p.road);
  for(let z=-31;z<=31;z+=3)box(0,.221,z,.11,.018,1.45,p.cream);
  for(const side of [-1,1]){
    box(side*3.84,.221,0,.075,.018,65,p.cream);
    for(const z of [-9,9])box(side*4.38,.33,z,.70,.27,6,p.stone);
    for(let z=-7.5;z<=8;z+=2.15)box(side*4.48,.75,z,.18,1.22,.23,0x526e6a);
    for(const y of [.67,1.13])box(side*4.48,y,0,.16,.16,16.2,0x688b7d);
    for(let z=-28;z<=29;z+=6)if(Math.abs(z)>10){
      box(side*4.8,.60,z,.19,.99,.23,p.white);
      box(side*4.8,.87,z,.20,.20,.24,p.ink);
    }
    box(side*road.lane,.23,side*(road.entry+1.55),3.5,.025,.24,p.white);
  }
  for(let i=0;i<34;i++){
    const side=i%2?1:-1,z=(i*13%61)-30,x=side*(8+(i*7%12));
    if(Math.abs(z)<6 || (x < -6&&z < -10) || (x>5&&z>5&&z<11))continue;
    const h=2.8+(i%5)*.43;
    box(x,.7,z,.51,1.6,.50,0x87674a);
    if(i%4===1){
      for(const [dx,dh,dz] of [[-.56,0,0],[.54,.13,.24],[.07,.85,-.25]])
        v.mesh(g,'sphere',x+dx,h*.59+dh,z+dz,2.26,2.47,2.1,[0x82a367,0x95ad6d,0x719768][i%3]);
    }else for(let j=0;j<3;j++)v.mesh(g,'cone',x,1.5+j*h*.26,z,h*(.77-j*.15),h*.75,h*(.77-j*.15),[0x4c7361,0x648966,0x81a178][j]);
  }
  for(const side of [-1,1])for(let i=0;i<9;i++){
    const x=side*(5.4+i*1.76),z=(i%2?1:-1)*(5.23+i%3*.15);
    v.mesh(g,'sphere',x,-.18,z,.74+i%3*.22,.48,.67,0xa7a68f);
    for(let j=0;j<3;j++)box(x+.33+j*.12,.05+j%2*.14,z-.15,.07,.75+j%2*.23,.07,0x8f9c57).rotation.z=(j-1)*.17;
  }
  // A moored skiff and wooden landing give the waterline a readable scale.
  box(14.6,-.04,4.76,3.4,.24,1.88,0xb5936c);
  for(let i=0;i<8;i++)box(13.15+i*.41,.095,4.76,.35,.06,1.88,0xcfac7a);
  for(const x of [13.12,16.08])box(x,-.06,3.98,.22,1.02,.24,0x836e54);
  v.mesh(g,'sphere',14.6,-.20,2.88,3.48,.64,1.14,p.coral);
  v.mesh(g,'sphere',14.6,.06,2.88,2.97,.23,.88,0x835f4d);
  for(const x of [13.95,15.2])box(x,.15,2.88,.23,.09,.82,p.cream);
  building(v,g,-13.4,-18.5,8.6,3.4,5.6,p.mint,'');
  box(-12.8,.12,-12.4,9.9,.15,5.8,0xada68e);
  box(-13.45,2,-15.59,4.8,3.15,.16,0x556d70);
  for(let y=.65;y<3.3;y+=.38)box(-13.45,y,-15.48,4.67,.08,.08,0x91a49a);
  v.sign(g,'17',-10.15,2.48,-15.55,1.0,.7,'#fff1cb');
  for(const x of [-11.3,-9.7]){
    box(x,.65,-11.7,.60,1.33,.56,p.coral);box(x,1.54,-11.7,.74,.65,.59,p.cream);
    box(x,1.58,-11.38,.46,.25,.04,p.glass);
  }
  for(const x of [-11.9,-9.07])box(x,1.7,-11.7,.12,3.1,.12,p.ink);
  box(-10.48,3.31,-11.7,4.43,.25,1.78,p.coral);box(-10.48,3.47,-11.7,4.48,.10,1.82,p.cream);
  for(const x of [8.0,13.7])box(x,2,-21,.19,3.9,.2,p.ink);
  box(10.85,3.46,-21,6.42,2.16,.23,p.cream);
  box(10.85,3.46,-20.84,6.18,1.96,.09,0x377363);
  v.sign(g,'M 17',10.85,3.5,-20.77,5.6,1.60,'#fff1cb');
  v.mesh(g,'cylinder',OFFICER_POST.x,.18,OFFICER_POST.z,1.75,.25,1.75,p.cream);
  v.postPosition={x:OFFICER_POST.x,z:OFFICER_POST.z};
}

export function buildCity(v) {
  if(v.map.id==='highway'){riverBridge(v);return;}
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
    // Slab joints, cast drains and a bolted inspection cover sit clear of the crossing.
    for(let z=-e+2;z<-map.entry-2;z+=2.2){
      for(const side of [-1,1])v.box(q,side*(map.width/2+1.55),.328,z,1.94,.012,.026,0xd3bfa4);
    }
    v.mesh(q,'cylinder',1.06,.207,-18,.92,.024,.92,0x56565b);
    for(const off of [-.22,0,.22])v.box(q,1.06,.225,-18+off,.63,.012,.043,0x838086);
    const drainX=map.width/2-.28;
    v.box(q,drainX,.215,-13,.39,.021,1.04,0x49494e);
    for(let j=0;j<5;j++)v.box(q,drainX,.232,-13.38+j*.19,.33,.02,.061,0x97928b);
    for(const z of [-11,-21]){
      v.mesh(q,'cylinder',-map.width/2-1.4,2.3,z,.17,4.4,.17,P.ink);v.box(q,-map.width/2-1.02,4.49,z,.95,.17,.17,P.ink);
      const lamp=v.box(q,-map.width/2-.68,4.31,z,.62,.25,.59,P.cream);lamp.material=v.lampMaterial;
      const pos=new THREE.Vector3(-map.width/2-.68,.23,z).applyAxisAngle(v.up,-d*Math.PI/2);v.lampPositions.push(pos);
    }
    for(let i=0;i<2;i++){
      if (map.id==='harbor' && d===1 && i===1) continue; // Container yard.
      const x=d===2&&i===1?-8.15:-7.5-i*3.8,z=d===2&&i===1?-18.6:-11.5-i*4.6;
      v.box(q,x,.36,z,2.6,.43,2.5,0xd4b793);v.box(q,x,.6,z,2.3,.08,2.2,0x83995e);
      if(d===2&&i===0){
        // Low planting keeps the station board visible from the pavement.
        for(const side of [-1,0,1]){
          v.mesh(q,'sphere',x+side*.65,.82,z,.8,.54,.76,0x80a778);
          v.mesh(q,'sphere',x+side*.60,1.07,z-.05,.28,.22,.3,side?P.yellow:P.coral);
        }
        continue;
      }
      v.mesh(q,'cylinder',x,1.35,z,.26,1.7,.26,0x9c7756);
      const tall=(i+d)%3===0;
      for(let branch=0;branch<6;branch++){
        const phase=branch*2.4+d, reach=tall?.38:.72, lift=branch*.135;
        const xx=Math.cos(phase)*reach, zz=Math.sin(phase)*reach;
        if(branch<3)v.mesh(q,'cylinder',x+xx*.33,1.86+lift,z+zz*.33,.13,.91,.13,0x886e51).rotation.z=-xx*.77;
        v.mesh(q,'sphere',x+xx,2.28+lift,z+zz,tall?1.03:1.53,tall?1.54:1.42,tall?1.07:1.48,[0x568873,0x78a577,0x91ae70,0x70a486,0x9bb773,0x83b18a][branch]);
      }
      v.mesh(q,'sphere',x,tall?3.27:3.02,z,1.30,tall?1.68:1.14,1.30,0xa4bf7c);
    }
    v.box(q,-10.8,.76,-7.25,2,.2,.66,0xbe8562);v.box(q,-10.8,1.07,-7.57,2,.51,.16,0xbe8562);
    for(const x of [-11.5,-10.1])v.box(q,x,.47,-7.25,.12,.5,.65,P.ink);
    v.box(q,-7.8,.71,-20,.61,1,.61,0x67938b);v.box(q,-7.8,1.27,-20,.69,.15,.7,P.ink);
    // A little sidewalk delivery parcel and flower boxes, away from real crossings.
    v.box(q,-8.7,.52,-19.5,.55,.52,.5,0xdcb585);v.box(q,-8.7,.80,-19.5,.12,.025,.5,P.cream);
    for(let i=0;i<3;i++)v.mesh(q,'sphere',-12.5+i*.42,.63,-7.25,.32,.45,.32,i%2?0xdd957c:0xebc569);
  }
  const post=OFFICER_POST;
  v.mesh(g,'cylinder',post.x,.128,post.z,1.76,.18,1.76,P.stone);
  v.mesh(g,'cylinder',post.x,.24,post.z,1.58,.10,1.58,P.glass);
  v.mesh(g,'cylinder',post.x,.297,post.z,1.57,.075,1.57,P.cream);
  dutyStation(v,g);
  if(map.id==='harbor')building(v,g,-16,-18,7,6.2,6.2,P.glass,'DOCK');
  else {
    clockHall(v,g,-16,-18);
    // A two-tier fountain and four flower beds in front of the town hall.
    const x=-16, z=-10;
    v.box(g,x,.17,z,10,.19,7.2,0xa7bc88);
    v.mesh(g,'cylinder',x,.36,z,6.4,.34,5.8,P.stone);
    v.mesh(g,'cylinder',x,.67,z,4.9,.56,4.9,P.cream);
    v.mesh(g,'cylinder',x,.97,z,4.35,.11,4.35,0x70b5c5);
    v.mesh(g,'cylinder',x,1.51,z,.70,1.14,.70,P.cream);
    v.mesh(g,'cylinder',x,2.08,z,2.25,.30,2.25,P.cream);
    v.mesh(g,'sphere',x,2.46,z,.40,.78,.40,0x9bd6cb);
    for (const side of [-1,1]) for (const end of [-1,1]) {
      const bedX=x+side*2.85, bedZ=z+end*2.05;
      v.box(g,bedX,.43,bedZ,1.8,.42,1.35,P.cream);
      v.mesh(g,'sphere',bedX,.72,bedZ,1.7,.65,1.28,0x80a778);
      for(let petal=0;petal<3;petal++)v.mesh(g,'sphere',bedX-.48+petal*.45,.98,bedZ+(petal%2)*.22,.35,.28,.35,end<0?P.yellow:P.coral);
    }
  }
  building(v,g,-23,-10,4.6,5.5,5.5,P.lime);
  building(v,g,-8.9,-22.2,4.4,5.5,5.3,P.coral);
  if (map.id === 'harbor') drawQuay(v,g,e);
  else {
    building(v,g,15,-19.8,6.9,10,6.1,0xc9b28b,'',true);
    building(v,g,22,-10.5,5.6,7.8,6.3,P.coral);
  }
  building(v,g,8.5,-22.6,4.4,5.3,4.6,P.yellow);
  building(v,g,-17.5,17.5,8.3,4.5,6.7,P.coral,'PIZZA');
  building(v,g,-23,9.1,4.5,4.2,4.2,P.yellow,'CAFE');
  building(v,g,16.7,18.3,7.2,5.8,6.4,P.mint,'MARKET');
  if(map.id!=='harbor')building(v,g,22.7,9.4,4.3,4.2,5.2,0xd99488);
  // Separate the shop terraces from the pavement using laid stone and parasols.
  for(const x of [-20.7,-18.8,-16.9,-15,-13.1])
    for(const z of [10.1,12,13.9])v.box(g,x,.13,z,1.86,.13,1.86,0xd7ba98);
  for(const x of [-21,-19]){
    v.mesh(g,'cylinder',x,1.53,12,.12,2.6,.12,P.ink);
    v.mesh(g,'sphere',x,2.82,12,2.2,.57,2.2,x===-21?P.coral:P.yellow);
    for(const offset of [-.88,.88]){
      v.box(g,x,.62,12+offset,.58,.14,.54,P.mint);
      v.box(g,x,.93,12+offset*1.23,.58,.53,.13,P.mint);
      for(const sx of [-.20,.20])for(const sz of [-.17,.17])v.box(g,x+sx,.38,12+offset+sz,.067,.42,.067,P.ink);
    }
    v.mesh(g,'cylinder',x+.28,1.34,12,.19,.19,.19,P.white);
    v.box(g,x-.22,1.28,12,.29,.035,.41,P.coral);
  }
  // The supplied street-prop sheet informs this small bus shelter; keep it off the road.
  for(const z of [-14.8,-10.8])v.box(g,7.5,1.55,z,.15,2.6,.15,P.mint);
  v.box(g,7.5,2.96,-12.8,1.65,.24,4.5,P.mint);v.box(g,8.12,1.5,-12.8,.12,2.7,4.1,0xb5d2c7);
  v.box(g,7.8,.85,-12.8,.66,.18,3,0xcb9571);v.sign(g,'BUS',7.48,2.45,-10.61,1,.38,'#fff3d2');
  for(const x of [-21,-19]){v.mesh(g,'cylinder',x,.7,12,.15,1,.15,P.cream);v.mesh(g,'cylinder',x,1.2,12,1.25,.12,1.25,P.cream);}

}
