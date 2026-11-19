export const MUSIC_STATES=['Calm','Normal','Busy','RushHour','Danger','Night'];
export const SOUND_NAMES=['go','stop','tap','warning','pause','confirm','reward','unlock','mission','crash','near','flow','horn','hornDouble','hornLow','hornToy','taxi','brake','start','tick','ambulance','firetruck','police','bird','shop'];
const TAU=Math.PI*2, hz=m=>440*2**((m-69)/12);
function note(data,rate,start,duration,midi,volume,timbre=0) {
  const offset=Math.floor(start*rate),n=Math.floor(duration*rate),f=hz(midi);
  for(let i=0;i<n&&offset+i<data.length;i++){const t=i/rate,env=Math.min(1,t/.007)*Math.exp(-t/(duration*.26))*Math.min(1,(duration-t)/.025),phase=TAU*f*t;
    data[offset+i]+=(Math.sin(phase)+.24*Math.sin(phase*2.002)*Math.exp(-t*14)+(timbre?.10*Math.sin(phase*3):0))*env*volume;
  }
}
export function musicSamples(state,rate=22050) {
  const beat=.5,seconds=16,data=new Float32Array(rate*seconds),night=state==='Night',busy=state==='Busy'||state==='RushHour',danger=state==='Danger';
  const roots=[48,53,57,55,48,53,50,55],melody=[72,76,79,76,74,77,81,77,76,79,84,79,74,79,83,79,72,76,79,84,81,77,76,74,74,77,81,77,79,76,74,72];
  for(let bar=0;bar<8;bar++){
    const root=roots[bar],start=bar*4*beat;
    for(let j=0;j<4;j++){
      const t=start+j*beat;note(data,rate,t,.42,root-12,.13);if(j%2===0)for(const interval of [0,[50,57].includes(root)?3:4,7])note(data,rate,t+.015,.63,root+12+interval,night?.019:.025);
      if(state!=='Calm'||j%2===0)note(data,rate,t+(j%2?.026:0),night?.85:.30,melody[bar*4+j]-(night?12:0),night?.056:.085,1);
      if(busy)note(data,rate,t+.25,.15,melody[bar*4+j]-12,.037,1);
      if(state==='RushHour')note(data,rate,t+.375,.095,root+24,.028,1);
      if(danger&&j%2===0)note(data,rate,t+.25,.18,root+13,.035);
      if(!night){const off=Math.floor(t*rate);for(let k=0;k<rate*.075;k++){const s=k/rate,env=Math.exp(-s*64);data[off+k]+=(j%2?Math.sin(k*1.91)*Math.sin(k*.43)*.035:Math.sin(TAU*(65*s-170*s*s))*.07)*env;}}
    }
  }
  for(let i=0;i<data.length;i++)data[i]=Math.tanh(data[i]*.85)*Math.min(1,i/(rate*.006),(data.length-1-i)/(rate*.006));return data;
}
export function soundSamples(name,variant=0,rate=22050) {
  const long=['reward','unlock','mission'].includes(name),siren=['ambulance','firetruck','police'].includes(name),duration=siren?.75:long?.65:name==='crash'?.28:name==='bird'?.40:.19;
  const data=new Float32Array(Math.ceil(duration*rate)),offset=variant-1;
  const notes={go:[72,79],stop:[64,60],tap:[67],warning:[62,61],pause:[67,64],confirm:[72,76],reward:[72,76,79,84],unlock:[67,72,76,79,84],mission:[72,79,84],near:[79,76],flow:[76,79,84],horn:[60],taxi:[72,74],brake:[58],start:[48,55],tick:[77],shop:[79,84],bird:[88,91]};
  Object.assign(notes,{hornDouble:[60,60],hornLow:[55,52],hornToy:[67,72]});
  if(siren){const base={ambulance:67,firetruck:62,police:69}[name];for(let n=0;n<4;n++)note(data,rate,n*.17,.23,base+(n%2?7:0)+offset*.1,.18);}
  else if(name==='crash'){
    let seed=19+variant,filtered=0;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;filtered+=(((seed/4294967296)*2-1)-filtered)*.12;const t=i/rate;data[i]=(filtered*.56+Math.sin(TAU*(125*t-130*t*t))*.27)*Math.min(1,t*250)*Math.exp(-t*18);}
  }else{const sequence=notes[name]??notes.tap,spacing=long?.11:name==='bird'?.10:.055;sequence.forEach((m,i)=>note(data,rate,i*spacing,long?.29:.13,m+offset*.12,name==='tick'?.10:.28,1));}
  return data;
}
export function engineSamples(kind,rate=22050) {
  const data=new Float32Array(rate*2),f={car:70,bus:45,truck:38,van:84,city:32,night:48}[kind]??70;
  for(let i=0;i<data.length;i++){const t=i/rate;data[i]=(Math.sin(TAU*f*t)*.16+Math.sin(TAU*f*2*t)*.042+Math.sin(TAU*f*3*t)*.015)*(.75+.25*Math.sin(TAU*6*t));}return data;
}
