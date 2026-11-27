import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BALANCE as B, VEHICLES, COSMETICS } from './config.js';
import { rotate } from './routes.js';
import { PALETTE as P, SKY, OFFICER_POST, lightPhase, vehicleParts, buildCity } from './art.js';

import { figureParts, joints, residents, roadWorker, paintUniform } from './figures.js';

import { drawRoadSite, drawHazards } from './incidents.js';

export class CityView {
  constructor(host,map,career={learned:[],certified:[]}) {
    this.postSkills=new Set([...career.learned,...career.certified]);
    this.postGrade=career.certified.length;
    this.host=host;this.map=map;this.scene=new THREE.Scene();
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.06;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.canvas=this.renderer.domElement;host.append(this.canvas);this.camera=new THREE.OrthographicCamera(-40,40,30,-30,.1,200);
    this.baseAngle=0;this.cameraAngle=.42;this.zoom=1;this.currentZoom=1;this.up=new THREE.Vector3(0,1,0);
    this.scratch=new THREE.Object3D();this.carRoot=new THREE.Object3D();this.matrix=new THREE.Matrix4();this.projected=new THREE.Vector3();this.roadRay=new THREE.Raycaster();this.roadPlane=new THREE.Plane(this.up,-.22);this.color=new THREE.Color();this.skyColor=new THREE.Color();this.floorColor=new THREE.Color();this.sunColor=new THREE.Color();
    this.geometry={cone:new THREE.ConeGeometry(.5,1,8),box:new RoundedBoxGeometry(1,1,1,1,.08),sphere:new THREE.IcosahedronGeometry(.5,1),cylinder:new THREE.CylinderGeometry(.5,.5,1,10),torus:new THREE.TorusGeometry(.35,.10,8,12),plane:new THREE.PlaneGeometry(1,1)};this.materials=new Map();
    const silhouette=new THREE.Shape();
    silhouette.moveTo(-.5,-.46);silhouette.lineTo(.5,-.46);silhouette.lineTo(.48,-.22);silhouette.lineTo(.29,.45);
    silhouette.quadraticCurveTo(.25,.50,.17,.50);silhouette.lineTo(-.25,.50);silhouette.lineTo(-.46,.06);silhouette.closePath();
    this.geometry.cab=new THREE.ExtrudeGeometry(silhouette,{depth:.92,bevelEnabled:true,bevelSegments:2,bevelSize:.032,bevelThickness:.034,curveSegments:3}).translate(0,0,-.46).rotateY(-Math.PI/2);
    this.windowMaterial=new THREE.MeshStandardMaterial({color:0x665363,roughness:.55,emissive:0xffc777,emissiveIntensity:0});this.lampMaterial=new THREE.MeshStandardMaterial({color:P.cream,emissive:0xffce84,emissiveIntensity:0});
    this.quietWindowMaterial=this.windowMaterial.clone();
    this.shopWindowMaterial=new THREE.MeshStandardMaterial({color:0x54899a,roughness:.4,emissive:0xffc983,emissiveIntensity:0});
    this.simpleBox=new THREE.BoxGeometry(1,1,1);
    this.hemi=new THREE.HemisphereLight(0xffecd6,0x988bb1,2.1);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xffdfa7,2.6);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-39,right:39,top:39,bottom:-39,near:1,far:140});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.08;this.sun.shadow.radius=3;this.scene.add(this.sun);
    this.fill=new THREE.DirectionalLight(0xa9d8ed,.55);this.fill.position.set(25,18,-20);this.scene.add(this.fill);
    this.figureMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.76});
    this.officerParts=figureParts('officer');
    this.environment=new THREE.Group();this.scene.add(this.environment);this.buildEnvironment();
    this.models=Object.fromEntries(Object.keys(VEHICLES).map(kind=>[kind,vehicleParts(kind)]));
    this.cars=this.instances(B.capacity*55,'box');this.cabs=this.instances(B.capacity,'cab');this.wheels=this.instances(B.capacity*4,'cylinder');this.hubs=this.instances(B.capacity*4,'cylinder');this.lights=this.instances(B.capacity*10,'box',new THREE.MeshBasicMaterial({toneMapped:false}));this.lights.castShadow=false;
    this.figureStyles=[...residents.keys(),'worker'];
    this.residentModels=this.figureStyles.map(style=>figureParts(style));
    this.crowd=this.residentModels.map(parts=>Object.fromEntries(Object.entries(parts).map(([joint,geometry])=>{
      const batch=new THREE.InstancedMesh(geometry,this.figureMaterial,B.pedestrianCapacity+40);
      batch.frustumCulled=false;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.castShadow=batch.receiveShadow=true;batch.count=0;this.scene.add(batch);return [joint,batch];
    })));
    this.crowdBatches=this.crowd.flatMap(rig=>Object.values(rig));const glow=this.radialTexture();
    // ponytail: pooled light decals do not light nearby geometry; use clustered lights only if that becomes necessary.
    this.lightPools=this.instances(20,'plane',new THREE.MeshBasicMaterial({map:glow,color:0xffd386,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));this.lightPools.castShadow=false;
    this.beams=this.instances(B.capacity,'plane',new THREE.MeshBasicMaterial({map:glow,color:0xffe4ad,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));this.beams.castShadow=false;
    this.fumes=this.instances(B.capacity*3,'plane',new THREE.MeshBasicMaterial({map:glow,transparent:true,opacity:.85,depthWrite:false}));this.fumes.castShadow=this.fumes.receiveShadow=false;
    this.particles=this.instances(72,'sphere',new THREE.MeshBasicMaterial({toneMapped:false}));this.particles.castShadow=false;this.effects=Array.from({length:72},()=>({life:0}));this.effectIndex=0;
    this.motion=Array.from({length:B.capacity+2},()=>({serial:-1,speed:0,yaw:0,pitch:0,roll:0,wheel:0}));
    this.routeGroup=new THREE.Group();this.scene.add(this.routeGroup);this.routeLines=[];this.showRoutes=true;this.debugRoutes=false;this.shakeLeft=0;
    this.skyKeys=SKY.map(k=>({top:new THREE.Color(k[1]),bottom:new THREE.Color(k[2]),sun:new THREE.Color(k[3])}));this.phase={};this.lastSky=-1;this.qualityLevel='medium';
    if(globalThis.ResizeObserver){this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);}else addEventListener('resize',()=>this.resize());this.resize();
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.onContextLost?.();});this.canvas.addEventListener('webglcontextrestored',()=>location.reload());
  }
  material(color) {if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.74}));return this.materials.get(color);}
  mesh(parent,kind,x,y,z,w,h,d,color,rx=0) {const m=new THREE.Mesh(this.geometry[kind],this.material(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.x=rx;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  box(parent,...args) {return this.mesh(parent,'box',...args);}
  sign(parent,text,x,y,z,w,h,color) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle=color;c.font='900 90px Arial';c.textAlign='center';c.textBaseline='middle';c.shadowColor='#684c4c';c.shadowOffsetY=5;c.fillText(text,256,66,490);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(this.geometry.plane,new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,toneMapped:false}));m.position.set(x,y,z);m.scale.set(w,h,1);parent.add(m);
  }
  radialTexture() {const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,.65)');g.addColorStop(.4,'rgba(255,255,255,.2)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
  instances(count,kind='box',material) {const m=new THREE.InstancedMesh(this.geometry[kind],material??new THREE.MeshStandardMaterial({roughness:.72}),count);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;m.count=0;this.scene.add(m);return m;}
  instance(mesh,x,y,z,w,h,l,color,rx=0,ry=0,rz=0,parentMatrix=null) {const o=this.scratch;o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.scale.set(w,h,l);o.updateMatrix();if(parentMatrix)this.matrix.multiplyMatrices(parentMatrix,o.matrix);else this.matrix.copy(o.matrix);const i=mesh.count++;mesh.setMatrixAt(i,this.matrix);if(color!==undefined)mesh.setColorAt(i,this.color.setHex(color));}
  buildEnvironment() {
    this.environment.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.material?.map){o.material.map.dispose();o.material.dispose();}});this.environment.clear();this.city=new THREE.Group();this.environment.add(this.city);this.lampPositions=[];buildCity(this);
    // Static facade detail is batched once per district; shared materials also drive window lighting.
    this.city.updateMatrixWorld(true);
    const batches=new Map(),labels=[],standard=new Set(this.materials.values()),plain=this.material(0xffffff);
    this.city.traverse(o=>{
      if(!o.isMesh)return;
      if(o.material.map){o.matrix.copy(o.matrixWorld);o.matrixAutoUpdate=false;labels.push(o);return;}
      const painted=standard.has(o.material), material=painted?plain:o.material, key=o.geometry.uuid+material.uuid;
      if(!batches.has(key))batches.set(key,{geometry:o.geometry,material,items:[],painted});
      batches.get(key).items.push(o);
    });
    this.city.clear();
    for(const b of batches.values()){
      const m=new THREE.InstancedMesh(b.geometry,b.material,b.items.length);
      b.items.forEach((o,i)=>{m.setMatrixAt(i,o.matrixWorld);if(b.painted)m.setColorAt(i,o.material.color);});
      m.castShadow=m.receiveShadow=true;this.city.add(m);
    }
    for(const label of labels)this.city.add(label);
    this.neonSigns=labels;this.neonHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:this.radialTexture(),color:0xffce83,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));this.neonHalo.position.set(-17.5,6.9,17.8);this.neonHalo.scale.set(6,5,1);this.environment.add(this.neonHalo);
    this.signs=[];this.roadGlows=[];
    for(let d=0;d<4;d++){const g=new THREE.Group();g.rotation.y=-d*Math.PI/2;g.visible=!this.map.directions||this.map.directions.includes(d);this.environment.add(g);this.mesh(g,'cylinder',-this.map.width/2-.68,1.43,-this.map.entry-1,.18,2.5,.18,P.ink);this.box(g,-this.map.width/2-.68,2.67,-this.map.entry-1,.72,1.08,.5,P.ink);this.signs.push(this.mesh(g,'sphere',-this.map.width/2-.68,2.73,-this.map.entry-.72,.46,.46,.17,0xde745e));this.roadGlows.push(this.box(g,-this.map.lane,.23,-this.map.entry-1.97,this.map.width/2-.4,.025,.15,0xe18971));}
    this.character=new THREE.Group();this.character.position.set(OFFICER_POST.x,.27,OFFICER_POST.z);this.character.scale.setScalar(1.42);this.environment.add(this.character);
    this.heroBody=new THREE.Group();this.character.add(this.heroBody);
    const limbs={};
    for(const [joint,geometry] of Object.entries(this.officerParts)){
      const m=new THREE.Mesh(geometry,this.figureMaterial);m.position.set(...joints[joint]);m.castShadow=m.receiveShadow=true;
      this.heroBody.add(m);limbs[joint]=m;
    }
    this.face=limbs.body;this.arm=limbs.leftArm;this.batonArm=limbs.rightArm;
    this.heroState='idle';this.heroUntil=0;this.heroFacing=-2.48;this.heroAngle=-2.48;
    this.eventBarrier=new THREE.Group();this.environment.add(this.eventBarrier);this.box(this.eventBarrier,0,.72,0,3.4,.65,.2,P.cream);for(let i=0;i<5;i++){const stripe=this.box(this.eventBarrier,-1.25+i*.62,.72,.12,.27,.65,.04,0xdb8e5f);stripe.rotation.z=-.4;}for(const x of [-1.25,1.25])this.box(this.eventBarrier,x,.34,0,.18,.65,.6,P.ink);this.eventBarrier.visible=false;
    this.birds=new THREE.Group();this.environment.add(this.birds);for(let i=0;i<3;i++){const b=new THREE.Group();this.birds.add(b);for(const side of [-1,1])this.box(b,side*.22,0,0,.5,.055,.20,0xf9edcf);}
  }
  setMap(map,career) {
    let rebuild=this.map.id!==map.id;
    if (career) {
      const skills=new Set([...career.learned,...career.certified]);
      rebuild=rebuild || this.postGrade!==career.certified.length || skills.size!==this.postSkills.size || [...skills].some(id=>!this.postSkills.has(id));
      this.postSkills=skills;this.postGrade=career.certified.length;
    }
    this.map=map;
    if(rebuild){this.buildEnvironment();this.quality(this.qualityLevel);}else this.resize();
  }
  vehiclePreviews(kinds=Object.keys(this.models)) {
    const images=this.previews??={}, missing=kinds.filter(kind=>!images[kind]);if(!missing.length)return images;
    const renderer=this.renderer,ratio=renderer.getPixelRatio(),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3.3,3.3,2.475,-2.475,.1,50);
    camera.position.set(7,5.8,9);camera.lookAt(0,.8,0);scene.add(new THREE.HemisphereLight(0xfff1d8,0x8b90b4,2));const sun=new THREE.DirectionalLight(0xffe1b8,2.8);sun.position.set(-4,8,6);scene.add(sun);
    const model=new THREE.Group();scene.add(model);
    try {renderer.setPixelRatio(1);renderer.setSize(240,180,false);
      for(const kind of missing){const parts=this.models[kind];model.clear();for(const p of parts)this.mesh(model,p.shape??'box',p.x,p.y,p.z,p.sx,p.sy,p.sz,p.color);const v=VEHICLES[kind];for(const side of [-1,1])for(const end of [-1,1]){const wheel=this.mesh(model,'cylinder',side*v.width*.49,.31,end*v.length*.30,.62,.20,.62,0x39404c);wheel.rotation.z=Math.PI/2;}
        camera.zoom=Math.min(2.2,6.1/Math.max(v.length,v.width*1.9));camera.updateProjectionMatrix();
        renderer.render(scene,camera);images[kind]=this.canvas.toDataURL('image/png');}
    }finally {renderer.setPixelRatio(ratio);renderer.setSize(this.width,this.height);renderer.renderLists.dispose();}
    return images;
  }
  bind(game) {
    this.boundGame=game;this.lastSimTime=game.time;this.heroUntil=0;this.heroState='idle';this.cameraImpulse=0;this.shakeLeft=0;for(const m of this.motion)m.serial=-1;for(const e of this.effects)e.life=0;
    this.routeGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.routeGroup.clear();this.routeLines=[];
    for(const r of game.routes){const geometry=new THREE.BufferGeometry().setFromPoints(r.points.map(p=>new THREE.Vector3(p.x,.235,p.z)));const line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color:[0xffdf97,0x9cdeee,0xe9a995,0xc7b6eb][r.direction],dashSize:.42,gapSize:.45,transparent:true,opacity:.50}));line.computeLineDistances();line.visible=false;this.routeGroup.add(line);this.routeLines.push(line);}
    if(__DEV__){this.debugMarkers=new THREE.Group();this.routeGroup.add(this.debugMarkers);const dots=(pts,color,size)=>this.debugMarkers.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts),new THREE.PointsMaterial({color,size,depthTest:false})));
      dots(game.routes.flatMap(r=>r.points.filter((_,i)=>i%8===0).map(p=>new THREE.Vector3(p.x,.32,p.z))),0xffffff,.25);dots(game.routes.map(r=>new THREE.Vector3(r.points[0].x,.3,r.points[0].z)),0x48e099,.9);dots(game.routes.map(r=>new THREE.Vector3(r.points.at(-1).x,.3,r.points.at(-1).z)),0xed6371,.9);
      const pts=[];for(const a of game.routes)for(const b of game.routes)if(a.id<b.id&&a.direction!==b.direction)for(let i=2;i<a.points.length-2;i+=5)for(let j=2;j<b.points.length-2;j+=5){const p=a.points[i],q=b.points[j];if(Math.hypot(p.x-q.x,p.z-q.z)<.6)pts.push(new THREE.Vector3(p.x,.32,p.z));}dots(pts,0xf270a6,.55);this.debugMarkers.visible=false;}
  }
  quality(level) {this.qualityLevel=level;
    if(level==='low')this.lowResidents??=this.figureStyles.map(style=>figureParts(style,true));
    const models=level==='low'?this.lowResidents:this.residentModels;
    this.crowd.forEach((rig,i)=>{for(const joint in rig)rig[joint].geometry=models[i][joint];});this.scene.traverse(o=>{if(o.geometry===this.geometry.box||o.geometry===this.simpleBox)o.geometry=level==='low'?this.simpleBox:this.geometry.box;});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,{low:1,medium:1.5,high:2}[level]));this.renderer.shadowMap.enabled=level!=='low';const size=level==='high'?2048:1024;if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(size,size);}this.resize();}
  resize() {const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.width=w;this.height=h;this.renderer.setSize(w,h);this.setProjection();}
  setProjection() {const a=this.width/this.height,span=Math.max(53,(this.map.extent*2+21)/a)/this.currentZoom;this.camera.left=-span*a/2;this.camera.right=span*a/2;this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.updateProjectionMatrix();}
  project(x,z,y=0) {this.projected.set(x,y,z).project(this.camera);return {x:(this.projected.x*.5+.5)*this.width,y:(-.5*this.projected.y+.5)*this.height};}
  roadAt(x,y,directions) {
    this.roadRay.setFromCamera({x:2*x/this.width-1,y:1-2*y/this.height},this.camera);
    const hit=this.roadRay.ray.intersectPlane(this.roadPlane,this.projected);
    if(!hit)return;
    return directions.find(d=>{
      const lane=rotate(hit.x,hit.z,(4-d)%4);
      return lane.x>=-this.map.width/2 && lane.x<=0 && lane.z>=-this.map.extent && lane.z<=-this.map.entry;
    });
  }
  roadPoint(direction) {const p=rotate(-this.map.width/2-4.2,this.map.id==='highway'?-21:-13.5,direction);return this.project(p.x,p.z,.4);}
  crossingPoint(direction) {const p=rotate(4.6,-this.map.entry-.8,direction);return this.project(p.x,p.z,.5);}
  burst(x,z,color=0xffd780,count=9) {if(this.qualityLevel==='low')count=Math.min(count,4);for(let i=0;i<count;i++){const p=this.effects[this.effectIndex++%this.effects.length],a=i*2.399+this.effectIndex;Object.assign(p,{x,z,y:.6,life:.7+i%3*.09,vx:Math.sin(a)*(1+i%3),vz:Math.cos(a)*(1+i%3),vy:1.6+i%3*.55,color,size:.12+i%3*.05});}}
  event(name,data={}) {
    const now=this.boundGame?.time??0;
    if(name==='directionOpened'||name==='directionClosed'){this.heroState=name==='directionOpened'?'go':'stop';this.heroFacing=Math.PI+data.direction*Math.PI/2;this.heroUntil=now+.8;const p=rotate(-this.map.lane,-this.map.entry-2,data.direction);this.burst(p.x,p.z,name==='directionOpened'?0xaad8a3:0xf2b08c,5);}
    if(name==='danger'){this.heroState=data.active?'danger':'relief';this.heroUntil=now+.8;}
    if(name==='collision'){this.impact=data;this.heroState='collision';this.heroUntil=now+1.2;this.burst(data.x,data.z,0xffdc9a,16);}
    if(name==='highFlow'&&now>(this.lastCelebration??-10)+5){this.lastCelebration=now;this.heroState='celebrate';this.heroUntil=now+1.1;this.burst(5.25,5.65,0xffda75,9);}
    if(name==='emergency')this.burst(data.x,data.z,0xbadfec,10);
    if(name==='pedestriansStarted'){const p=rotate(0,-this.map.entry-.8,data.direction);this.burst(p.x,p.z,0xa4d7bc,6);}
    if(name==='pedestrianPassed')this.burst(data.x,data.z,0xb3ddb0,3);
    if(name==='jamResolved'){const p=rotate(-this.map.lane,-this.map.entry-2,data.direction);this.burst(p.x,p.z,0xaad8a3,7);this.heroState='relief';this.heroUntil=now+.7;}
    if(name==='emergency'||name==='highFlow')this.cameraImpulse=name==='emergency'?.012:.006;
    if(name==='reward'||name==='unlock'||name==='circuitComplete'){this.heroState='celebrate';this.heroUntil=now+1.3;this.burst(5.25,5.65,0xffd978,15);}
  }
  person(x,z,id,time,walking,angle=0,working=false) {
    const style=id<0?residents.length:id%residents.length,rig=this.crowd[style],look=residents[style]??roadWorker;
    const phase=time*(style===3?7.7:5.8)+id*2.3, swing=walking?Math.sin(phase)*.49:0;
    this.carRoot.position.set(x,.29+(walking?Math.abs(Math.cos(phase))*.042:Math.sin(time*2+id)*.012),z);
    this.carRoot.rotation.set(0,angle,walking?Math.sin(phase)*.03:0);this.carRoot.scale.setScalar(look.size);
    this.carRoot.updateMatrix();
    for(const joint in rig){
      const [px,py,pz]=joints[joint],left=joint.startsWith('left'),leg=joint.endsWith('Leg');
      const rx=working&&joint.endsWith('Arm') ? -.82+Math.sin(time*14)*.07 : joint==='body'?0:leg?(left?swing:-swing):(left?-swing:swing)*.76-.12;
      this.instance(rig[joint],px,py,pz,1,1,1,undefined,rx,0,0,this.carRoot.matrix);
    }
  }
  render(game,dt,settings) {
    const step=Math.min(.1,Math.max(0,game.time-this.lastSimTime));this.lastSimTime=game.time;lightPhase(game.timeOfDay,this.phase);const phase=this.phase,a=this.skyKeys[phase.index],b=this.skyKeys[phase.index+1],night=phase.night;
    this.skyColor.lerpColors(a.top,b.top,phase.blend);this.floorColor.lerpColors(a.bottom,b.bottom,phase.blend);this.sunColor.lerpColors(a.sun,b.sun,phase.blend);
    const skyTick=Math.floor(game.timeOfDay*500);if(skyTick!==this.lastSky){this.lastSky=skyTick;this.host.style.background=`radial-gradient(ellipse at 50% 90%,#${this.floorColor.getHexString()} 0%,transparent 70%),linear-gradient(#${this.skyColor.getHexString()},#${this.floorColor.getHexString()})`;}
    this.sun.color.copy(this.sunColor);this.sun.intensity=THREE.MathUtils.lerp(SKY[phase.index][4],SKY[phase.index+1][4],phase.blend);this.hemi.color.copy(this.skyColor).lerp(this.floorColor,.32);this.hemi.intensity=1.65-night*.55;this.fill.intensity=.65+night*.22;
    const arc=(game.timeOfDay-.25)*Math.PI*2;this.sun.position.set(-28*Math.cos(arc),28+16*Math.max(0,Math.sin(arc)),20+8*Math.sin(arc));this.sun.shadow.radius=night?4:3;
    this.windowMaterial.emissiveIntensity=night*1.5;this.lampMaterial.emissiveIntensity=night*2.1;this.lightPools.material.opacity=night*(this.qualityLevel==='low'?.23:.40);this.beams.material.opacity=night*.24;
    this.quietWindowMaterial.emissiveIntensity=night*.35;this.shopWindowMaterial.emissiveIntensity=night*.75;const neon=night*(.94+.06*Math.sin(game.time*3));this.neonHalo.material.opacity=neon*.29;this.neonHalo.visible=this.qualityLevel!=='low'&&this.map.id!=='highway';for(const sign of this.neonSigns)sign.material.color.setScalar(.83+neon*.42);
    for(const mesh of [this.cars,this.cabs,this.wheels,this.hubs,this.lights,...this.crowdBatches,this.beams,this.lightPools,this.fumes,this.particles])mesh.count=0;
    for(const pos of this.lampPositions)this.instance(this.lightPools,pos.x,.232,pos.z,5.7,6.8,1,undefined,-Math.PI/2);
    for(const v of game.renderVehicles){
      if(!v.active)continue;const m=this.motion[v.id],yaw=Math.atan2(v.dx,v.dz);
      if(m.serial!==v.serial)Object.assign(m,{serial:v.serial,speed:v.speed,yaw,pitch:0,roll:0,wheel:0});
      const turn=THREE.MathUtils.euclideanModulo(yaw-m.yaw+Math.PI,Math.PI*2)-Math.PI,acc=step?(v.speed-m.speed)/step:0;
      if(step){m.pitch+=(THREE.MathUtils.clamp(acc*.015,-.07,.07)-m.pitch)*Math.min(1,step*7);m.roll+=(THREE.MathUtils.clamp(-turn/step*v.speed*.018,-.08,.08)-m.roll)*Math.min(1,step*6);m.wheel+=v.speed*step/.31;}
      if((m.speed<.2&&v.speed>=.2)||(m.speed>1&&v.speed<.2))this.burst(v.x-v.dx*v.length*.46,v.z-v.dz*v.length*.46,0xe4d5bd,3);m.speed=v.speed;m.yaw=yaw;
      this.carRoot.position.set(v.x,.10+Math.sin(game.time*12+v.id)*Math.min(.025,v.speed*.004),v.z);this.carRoot.rotation.set(v.crashLeft>0?.065:0,yaw,v.crashLeft>0?(v.id%2?-.08:.08):0);this.carRoot.scale.set(1,1,1);this.carRoot.updateMatrix();const base=this.carRoot.matrix;
      for(const p of this.models[v.kind]){const glow=p.role!=='body';let color=p.color;if(p.role==='headlight')color=night>.2?0xffe8ac:0xe5d5b0;if(p.role==='brake')color=acc<-.3||v.speed<.1?0xff7960:0x9e544f;if(p.role==='indicator')color=(v.turn||v.broken>0||v.crashLeft>0||v.runnerAt!==null)&&Math.sin(game.time*10)>0?0xffc568:0x987861;if(p.role==='siren')color=Math.sin(game.time*12+(p.x<0?0:Math.PI))>0?p.color:0x647888;this.instance(glow?this.lights:p.shape==='cab'?this.cabs:this.cars,p.x,p.y+p.z*m.pitch+p.x*m.roll,p.z,p.sx,p.sy,p.sz,color,m.pitch,0,m.roll,base);}
      for(const side of [-1,1])for(const end of [-1,1]){const x=side*v.width*.49,z=end*v.length*.30,steer=end>0?THREE.MathUtils.clamp(turn*10,-.25,.25):0;this.instance(this.wheels,x,.31,z,.62,.20,.62,0x39404c,m.wheel,steer,Math.PI/2,base);this.instance(this.hubs,x+side*.105,.31,z,.30,.034,.30,0xc9ccbd,m.wheel,steer,Math.PI/2,base);}
      drawHazards(this,v,game.time,base);
      if(night>.05)this.instance(this.beams,0,.15,v.length*.5+1.8,v.width*2,5,1,undefined,-Math.PI/2,0,0,base);
    }
    drawRoadSite(this,game);
    const hazard=game.vehicles.find(v=>v.active&&(v.crashLeft>0||v.broken>0||v.runnerAt!==null));
    const site=game.event?.kind==='works'&&game.event.phase!=='scheduled'?game.event:null;
    this.incidentPoint=(!game.running&&['collision','pedestrian'].includes(game.reason)?this.impact:null)??hazard??(site?rotate(site.phase==='active'?this.map.lane:this.map.width/2+1.35,-this.map.entry-6,site.direction,this.sitePoint??={}):game.highway?.vehicles.find(v=>v.active));
    this.incidentAngle=-((hazard?.direction??site?.direction??game.highway?.blocked??0)*Math.PI/2)+.15;
    for(const p of game.people)if(p.active)this.person(p.x,p.z,p.appearance??p.id,game.time,p.t>0,-p.direction*Math.PI/2+Math.PI/2);
    for(let d=0;d<4;d++)for(let i=0;i<Math.min(game.waitingPeople[d],this.qualityLevel==='low'?3:8);i++){const p=game.queuePoint(d,i);this.person(p.x,p.z,game.pedestrianHead[d]+i+d*8,game.time,false,-d*Math.PI/2+Math.PI/2);}
    if(!game.highway && (this.qualityLevel!=='low'||this.photoSubject==='street'))for(let i=0;i<8;i++){
      const d=i%4, phase=game.time*.13+i, lane=this.map.width/2+(i<4?.85:2.1);
      const p=rotate(-lane,-13+Math.sin(phase)*4,d);
      if(i===0){this.streetTarget??=new THREE.Vector3();this.streetTarget.set(p.x,0,p.z);}
      this.person(p.x,p.z,24+i,game.time,true,-d*Math.PI/2+(Math.cos(phase)<0?Math.PI:0));
    }
    for(const p of this.effects)if(p.life>0){p.life=Math.max(0,p.life-step);p.x+=p.vx*step;p.z+=p.vz*step;p.y+=p.vy*step;p.vy-=3.8*step;const size=p.size*Math.min(1,p.life*5);this.instance(this.particles,p.x,Math.max(.25,p.y),p.z,size,size,size,p.color);}
    for(const mesh of [this.cars,this.cabs,this.wheels,this.hubs,this.lights,...this.crowdBatches,this.beams,this.lightPools,this.fumes,this.particles]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
    if(this.debugMarkers)this.debugMarkers.visible=this.debugRoutes;for(const line of this.routeLines)line.visible=this.debugRoutes;if(this.showRoutes&&!this.debugRoutes)for(const lane of game.lanes){const lead=lane.find(v=>v.active&&!v.committed);if(lead)this.routeLines[lead.route.id].visible=true;}
    for(let d=0;d<4;d++){const color=game.signals[d]?0x9cdda2:0xe58972;this.signs[d].material=this.material(color);this.roadGlows[d].material=this.material(color);}
    if(this.lastUniform!==settings.selectedCosmetic){this.lastUniform=settings.selectedCosmetic;paintUniform(this.officerParts,COSMETICS.find(c=>c.id===this.lastUniform)?.color??0x32675f);}
    if(game.time>this.heroUntil)this.heroState='idle';const state=this.heroState;this.heroAngle+=(THREE.MathUtils.euclideanModulo(this.heroFacing-this.heroAngle+Math.PI,Math.PI*2)-Math.PI)*Math.min(1,dt*7);this.character.rotation.y=this.heroAngle;
    this.heroBody.position.y=state==='celebrate'?Math.abs(Math.sin(game.time*10))*.19:Math.sin(game.time*2)*.018;this.heroBody.rotation.z=state==='collision'?Math.sin(game.time*18)*.15:state==='relief'?.07:0;
    this.heroClock=(this.heroClock??0)+Math.min(.1,dt);if(!step&&state==='idle')this.heroBody.position.y=Math.sin(this.heroClock*2)*.018;
    this.arm.rotation.z=state==='stop'?-1.65:state==='danger'?-1.25:state==='celebrate'?-2.5:state==='collision'?-2:Math.sin(game.time*2)*.04;this.batonArm.rotation.z=state==='go'?1.4:state==='danger'?1.7:state==='celebrate'?2.5:state==='collision'?2:night>.5?.18:.32;this.batonArm.rotation.x=state==='go'?Math.sin(game.time*14)*.23:-.38;this.heroBody.rotation.x=state==='idle'&&night>.5?.07:0;
    this.eventBarrier.visible=game.event?.kind==='turn'&&game.event.phase!=='scheduled';if(this.eventBarrier.visible){const p=rotate(-this.map.width/2-1,-this.map.entry-2,game.event.direction);this.eventBarrier.position.set(p.x,.08,p.z);this.eventBarrier.rotation.y=-game.event.direction*Math.PI/2;}
    this.birds.visible=night<.2&&this.qualityLevel!=='low';this.birds.children.forEach((bird,i)=>{bird.position.set(-18+Math.sin(game.time*.13+i*.6)*5,9+i*.5,-18+Math.cos(game.time*.13+i*.6)*5);bird.rotation.y=-game.time*.13-i*.6;bird.children.forEach((wing,k)=>wing.rotation.z=(k?1:-1)*(.2+Math.sin(game.time*7+i)*.4));});
    this.shakeLeft=Math.max(0,this.shakeLeft-step);const shake=this.shakeLeft>0&&settings.shake?Math.sin(this.shakeLeft*80)*this.shakeLeft*.18:0;this.cameraAngle+=(this.baseAngle+.42-this.cameraAngle)*Math.min(1,dt*9);const z=this.currentZoom;this.currentZoom+=(this.zoom-this.currentZoom)*Math.min(1,dt*10);if(Math.abs(z-this.currentZoom)>.0001)this.setProjection();
    this.cameraImpulse=Math.max(0,(this.cameraImpulse??0)-dt*.025);this.face.morphTargetInfluences[0]=Math.max(0,1-Math.abs(this.heroClock%4.17-3.94)/.105);
    const target=this.photoSubject==='officer'?this.character.position:this.photoSubject==='street'?this.streetTarget:this.photoSubject==='incident'?this.incidentPoint:this.inspectPost?this.postPosition:null, cx=target?.x??0, cz=target?.z??0;
    const distance=this.photoSubject==='incident'?11:this.photoSubject?3.4:46;
    this.camera.position.set(cx+Math.sin(this.cameraAngle)*distance+shake,this.photoSubject?(this.photoSubject==='officer'?3.18:this.photoSubject==='incident'?9:2.65):this.inspectPost?34:48-(settings.shake?this.cameraImpulse*30:0),cz+Math.cos(this.cameraAngle)*distance);this.camera.lookAt(cx,this.photoSubject==='officer'?1.78:this.photoSubject==='street'?1.28:this.inspectPost?2.5:1.3,cz);this.camera.updateMatrixWorld();this.renderer.render(this.scene,this.camera);
  }
}
