import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ink=0x322f34, cream=0xffe9be, brass=0xd89c43, leather=0x654539;
export const residents=[
  {coat:0xc55843,skin:0xc68a62,hair:0x3f302b,pants:0x41586a,size:1.00}, // Bicycle messenger
  {coat:0x598a82,skin:0xe7b794,hair:0xa5a094,pants:0x564956,size:.94}, // Gardener
  {coat:0xf1cc8c,skin:0x915e47,hair:0x352d2e,pants:0x4d6670,size:1.07}, // Baker
  {coat:0x4e7fa0,skin:0xf0c29e,hair:0xac6945,pants:0x735c55,size:.78}, // Schoolchild
  {coat:0x98617a,skin:0xb08062,hair:0x4b3433,pants:0x475867,size:1.03}, // Photographer
  {coat:0x809159,skin:0xe2b08a,hair:0x69514a,pants:0x435963,size:1.00}, // Commuter
];
export const roadWorker={coat:0x344e60,skin:0xc28c68,hair:0x513c32,pants:0x314b59,size:1.05};
const officer={coat:0x32675f,skin:0xdfa377,hair:0x504338,pants:0x334756,size:1.20};
export const joints={body:[0,0,0],leftLeg:[-.135,.68,0],rightLeg:[.135,.68,0],leftArm:[-.30,1.24,0],rightArm:[.30,1.24,0]};
const oval=new THREE.SphereGeometry(.5,12,8), block=new RoundedBoxGeometry(1,1,1,1,.14), drum=new THREE.CylinderGeometry(.5,.5,1,16);
const smallOval=new THREE.SphereGeometry(.5,8,5),simpleBlock=new THREE.BoxGeometry(),smallDrum=new THREE.CylinderGeometry(.5,.5,1,8);
const matrix=new THREE.Object3D(), tint=new THREE.Color();

export function figureParts(style,low=false) {
  const hero=style==='officer', worker=style==='worker', look=hero?officer:worker?roadWorker:residents[style], {coat,skin,hair,pants}=look;
  const parts={}, coloredUniform=[], eyeRanges=[];
  let pieces=[],vertexOffset=0;
  function shape(base,x,y,z,w,h,d,color,rz=0,rx=0) {
    if(low){
      if(Math.max(w,h,d)<.045)return;
      base=base===oval?smallOval:base===block?simpleBlock:base===drum?smallDrum:base;
    }
    const g=base.index?base.toNonIndexed():base.clone();
    matrix.position.set(x,y,z);matrix.scale.set(w,h,d);matrix.rotation.set(rx,0,rz);matrix.updateMatrix();g.applyMatrix4(matrix.matrix);
    const count=g.attributes.position.count, rgb=new Float32Array(count*3);
    tint.setHex(color);
    for(let i=0;i<count;i++)tint.toArray(rgb,i*3);
    if(hero&&color===coat)coloredUniform.push({start:vertexOffset,count});
    vertexOffset+=count;g.setAttribute('color',new THREE.BufferAttribute(rgb,3));pieces.push(g);
  }
  const ball=(...a)=>shape(oval,...a), box=(...a)=>shape(block,...a), cyl=(...a)=>shape(drum,...a);
  function finish(key){
    const geometry=mergeGeometries(pieces);geometry.userData.cloth=coloredUniform.splice(0);
    parts[key]=geometry;pieces=[];vertexOffset=0;
  }
  // The jacket flares at the hem, tapers around the waist and rounds over the shoulders.
  const profile=[[.19,.60],[.28,.64],[.26,.79],[.28,1.03],[.31,1.18],[.30,1.26],[.18,1.32],[.10,1.33]];
  const tailor=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),16);
  shape(tailor,0,0,0,1,1,.74,coat);
  ball(0,1.35,0,.22,.24,.20,skin);
  ball(0,1.67,.018,.61,.69,.55,skin);
  const capped=hero||worker||style===0||style===2||style===3;
  ball(0,capped?1.826:1.89,-.062,capped?.565:.62,capped?.23:.38,.49,hair);
  for(const side of [-1,1]){
    ball(side*.287,1.63,.008,.11,.18,.12,skin);
    ball(side*.23,1.78,.109,.096,.23,.16,hair,-side*.17);
    const eyeStart=vertexOffset;
    ball(side*.112,1.68,.259,.089,.077,.042,cream);
    ball(side*.11,1.681,.281,.051,.060,.025,ink);
    ball(side*.108-.008,1.696,.296,.015,.015,.009,0xfff5da);
    if(hero)eyeRanges.push([eyeStart,vertexOffset]);
    ball(side*.119,1.752,.249,.131,.041,.049,hair,side*.11);
    ball(side*.156,1.585,.232,.09,.043,.029,hero?0xce8667:skin);
    box(side*.07,1.266,.16,.108,.12,.034,hero?cream:coat,-side*.45);
  }
  ball(0,1.62,.28,.128,.13,.145,skin);
  ball(.015,1.506,.244,.095,.023,.031,0x9e6351,.04);
  if(hero){
    for(const side of [-1,1])ball(side*.059,1.549,.278,.146,.065,.052,hair,side*.23);
    const crown=new THREE.LatheGeometry([[.24,0],[.294,.028],[.376,.105],[.361,.166],[.28,.201],[0,.207]].map(([r,y])=>new THREE.Vector2(r,y)),20);
    shape(crown,0,1.858,-.008,1,1,.87,coat,-.045,-.09);
    cyl(0,1.86,.007,.652,.097,.55,ink);
    ball(0,1.81,.178,.64,.070,.49,0x303737,0,.09);
    box(0,1.91,.293,.093,.105,.025,brass,.07);
    cyl(0,1.873,.012,.657,.019,.558,brass);
    box(0,1.13,.215,.068,.24,.034,ink);
    for(const side of [-1,1]){
      box(side*.29,1.26,.012,.16,.045,.18,brass,side*-.16);
      box(side*.155,1.04,.188,.115,.097,.027,coat);
      box(side*.155,1.082,.208,.127,.027,.03,cream);
    }
    box(-.126,1.157,.208,.089,.093,.024,brass,.1);
    box(.031,.998,.207,.061,.55,.038,leather,-.48);
    cyl(0,.770,0,.557,.089,.409,ink);box(0,.771,.216,.11,.063,.027,brass);
    for(let j=0;j<3;j++)ball(.02,1.09-j*.117,.217,.038,.04,.024,brass);
    box(.17,1.145,.209,.108,.12,.044,ink);
    for(let j=0;j<3;j++)box(.17,1.13+j*.024,.235,.076,.008,.008,0x9baa96);
    box(-.248,.79,.074,.098,.21,.108,ink);box(-.248,.94,.08,.027,.16,.023,ink);
  } else if(worker){
    ball(0,1.923,-.005,.65,.29,.57,0xf6b535);
    cyl(0,1.872,.019,.722,.05,.653,0xfbd36a);
    box(0,2.044,0,.087,.05,.34,0xffcf5c);
    for(const side of [-1,1]){
      ball(side*.295,1.688,0,.116,.16,.14,0xdd8c37);
      box(side*.143,1.01,.133,.215,.52,.16,0xd9e749,-side*.08);
      box(side*.14,1.16,.223,.053,.245,.025,0xfff3c4,-side*.16);
      box(side*.14,.91,.23,.218,.055,.025,0xf0ead0);
    }
    cyl(0,.862,0,.555,.076,.431,0xd2dd49);
    box(0,1.03,-.163,.47,.44,.12,0xd9e749);
    box(0,.94,-.232,.43,.05,.024,0xfff3c4);
  } else if(style===0 || style===3){
    ball(0,1.952,-.015,.68,.249,.57,style===0?0xddae46:0xba614d);
    ball(0,1.904,.185,.57,.054,.44,style===0?0x96673a:0x84504a);
    box(.03,1.025,.2,.058,.54,.036,leather,-.49);
    box(style===0?.23:0,.89,style===0?.07:-.225,style===0?.22:.43,.36,.18,style===0?leather:0xca9554);
    box(0,1.21,.20,.19,.065,.04,cream);
  } else if(style===1){
    ball(-.05,1.91,-.255,.295,.31,.27,hair);
    cyl(0,1.304,0,.41,.105,.32,0xce825e);box(-.138,1.12,.184,.097,.29,.045,0xce825e,-.18);
    for(const side of [-1,1]){const rim=new THREE.TorusGeometry(.052,.009,5,12);shape(rim,side*.112,1.68,.285,1.3,1,.65,leather);}
    box(0,1.68,.287,.083,.014,.02,leather);
  } else if(style===2){
    cyl(0,1.952,0,.56,.16,.48,cream);
    for(const [x,y,z] of [[-.16,2.04,0],[.15,2.05,-.02],[0,2.10,.06]])ball(x,y,z,.38,.30,.33,0xffebcc);
    box(0,.91,.182,.39,.56,.051,0x6b8780);box(0,.89,.218,.24,.112,.025,0x46675e);
    for(const side of [-1,1])box(side*.153,1.21,.168,.046,.23,.036,0x6b8780,side*-.18);
  } else if(style===4){
    for(let i=0;i<8;i++)ball(Math.cos(i*.785)*.20,1.888+Math.sin(i*2)*.03,Math.sin(i*.785)*.16,.245,.245,.23,hair);
    for(const side of [-1,1])box(side*.08,1.126,.205,.025,.31,.03,leather,-side*.38);
    box(0,.958,.24,.23,.15,.115,ink);ball(0,.96,.32,.111,.108,.062,0x8ca9a8);
  } else {
    ball(.07,1.899,.095,.48,.18,.38,hair,.24);
    for(const side of [-1,1])box(side*.09,1.16,.181,.085,.26,.041,0xaab989,-side*.28);
    for(let j=0;j<3;j++)ball(.025,1.05-j*.12,.207,.037,.04,.03,brass);
  }
  finish('body');
  if(hero){
    const pos=parts.body.attributes.position, blink=new Float32Array(pos.count*3);
    for(const [start,end] of eyeRanges)for(let i=start;i<end;i++)blink[i*3+1]=(1.68-pos.getY(i))*.91;
    parts.body.morphTargetsRelative=true;parts.body.morphAttributes.position=[new THREE.BufferAttribute(blink,3)];
  }
  for(const side of [-1,1]){
    ball(0,-.147,0,.208,.38,.219,pants);
    cyl(0,-.368,0,.171,.265,.188,pants);
    box(0,-.506,.005,.177,.06,.194,hero?ink:pants);
    ball(0,-.554,.063,.21,.167,.335,hero?0x393b39:leather);
    box(0,-.611,.055,.211,.046,.312,ink);finish(side<0?'leftLeg':'rightLeg');
    ball(side*.025,-.125,0,.208,.343,.219,coat,side*.10);
    ball(side*.047,-.315,.025,.163,.24,.169,coat,-side*.11,.14);
    if(hero){
      cyl(side*.04,-.25,.018,.181,.060,.18,0xe6c477);
      box(side*.12,-.162,0,.024,.11,.105,cream);
    }
    cyl(side*.045,-.407,.042,.169,.075,.17,hero?cream:coat);
    ball(side*.047,-.489,.055,.138,.188,.15,hero?0xfff0d3:skin);
    ball(side*-.018,-.47,.107,.080,.111,.084,hero?cream:skin);
    if(worker){
      cyl(side*.042,-.30,.022,.181,.056,.18,0xe3d59c);
      ball(side*.047,-.493,.055,.154,.19,.17,0xb88851);
    }
    if(hero&&side>0){
      for(let i=0;i<6;i++)cyl(.064,-.583-i*.101,.065,.079,.105,.079,i%2?cream:ink);
      ball(.064,-1.13,.065,.079,.066,.079,cream);
    }
    if(style===5&&side<0){
      box(-.05,-.61,.051,.042,.13,.14,leather);box(-.055,-.774,.055,.127,.285,.40,leather);
      box(-.128,-.726,.055,.023,.039,.37,brass);
    }
    finish(side<0?'leftArm':'rightArm');
  }
  return parts;
}

export function paintUniform(parts,hex){
  tint.setHex(hex);
  for(const geometry of Object.values(parts)){
    const color=geometry.attributes.color;
    for(const {start,count} of geometry.userData.cloth)
      for(let i=start;i<start+count;i++)color.setXYZ(i,tint.r,tint.g,tint.b);
    color.needsUpdate=true;
  }
}
