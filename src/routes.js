import { TURNS } from './config.js';

export function rotate(x, z, direction, result = {}) {
  for (let i = 0; i < direction; i++) {const oldX=x;x=-z;z=oldX;}
  result.x=x;result.z=z;return result;
}

export function makeRoutes(map) {
  if(map.routes) return map.routes.map((definition,id)=>{
    const points=definition.points.map(p=>({x:p[0],z:p[1]})),distances=[0];
    for(let i=1;i<points.length;i++) {
      const segment=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);
      if(!Number.isFinite(segment)||segment<=0)throw new Error('Route segments must have positive length');
      distances.push(distances[i-1]+segment);
    }
    const entry=distances[definition.entryIndex],exitS=distances[definition.exitIndex];
    if(!(entry>0&&exitS>entry&&exitS<distances.at(-1)))throw new Error('Invalid route entry / exit');
    return {...definition,id,points,distances,entry,exitS,length:distances.at(-1),name:TURNS[definition.turn]};
  });
  const routes = [];
  for (let d = 0; d < 4; d++) for (let turn = 0; turn < 3; turn++) {
    const e = map.entry, l = map.lane, out = (d + [2, 1, 3][turn]) % 4;
    const p0 = [-l, -e], p3 = turn === 0 ? [-l, e] : turn === 1 ? [e, l] : [-e, -l];
    const k = turn === 2 ? (e - l) * .56 : e * .95;
    const p1 = [-l, -e + k], p2 = turn === 0 ? [-l, e - k] : [p3[0] + (turn === 1 ? -k : k), p3[1]];
    const points = [rotate(-l, -map.extent, d)];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80, u = 1 - t;
      points.push(rotate(u ** 3 * p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0], u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1], d));
    }
    const end = turn === 0 ? [-l, map.extent] : [turn === 1 ? map.extent : -map.extent, p3[1]];
    points.push(rotate(...end, d));
    const distances = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances[i-1] + Math.hypot(points[i].x-points[i-1].x, points[i].z-points[i-1].z));
    routes.push({ id: routes.length, direction: d, turn, name: TURNS[turn], exit: out, points, distances, entry: map.extent-e, exitS: distances.at(-2), length: distances.at(-1) });
  }
  return routes.filter(r=>!map.directions||(map.directions.includes(r.direction)&&map.directions.includes(r.exit))).map((r,id)=>({...r,id}));
}

export function sample(route, distance, result) {
  const ds = route.distances, ps = route.points;
  let lo = 0, hi = ds.length - 1;
  while (hi - lo > 1) { const mid = (lo+hi) >> 1; if (ds[mid] <= distance) lo = mid; else hi = mid; }
  const a = ps[lo], b = ps[hi], t = Math.max(0, Math.min(1, (distance-ds[lo])/(ds[hi]-ds[lo])));
  result.x = a.x + (b.x-a.x)*t; result.z = a.z+(b.z-a.z)*t;
  const len = Math.hypot(b.x-a.x, b.z-a.z);
  result.dx = (b.x-a.x)/len; result.dz = (b.z-a.z)/len;
  return result;
}

// Geometric matrix: sampled swept lane widths, independent of compass-specific rules.
export function conflictMatrix(routes) {
  return routes.map(a => routes.map(b => {
    if (a.direction === b.direction || a.exit === b.exit) return true;
    for (let i = 1; i < a.points.length-1; i+=2) for (let j=1; j<b.points.length-1; j+=2) {
      if (Math.hypot(a.points[i].x-b.points[j].x, a.points[i].z-b.points[j].z) < 1.65) return true;
    }
    return false;
  }));
}

export function overlaps(a, b, inset = 0) {
  const x = b.x-a.x, z=b.z-a.z;
  const al=a.length/2-inset, aw=a.width/2-inset, bl=b.length/2-inset, bw=b.width/2-inset;
  const dot=a.dx*b.dx+a.dz*b.dz, cross=a.dx*b.dz-a.dz*b.dx;
  return Math.abs(x*a.dx+z*a.dz)<al+bl*Math.abs(dot)+bw*Math.abs(cross)
    && Math.abs(-x*a.dz+z*a.dx)<aw+bl*Math.abs(cross)+bw*Math.abs(dot)
    && Math.abs(x*b.dx+z*b.dz)<bl+al*Math.abs(dot)+aw*Math.abs(cross)
    && Math.abs(-x*b.dz+z*b.dx)<bw+al*Math.abs(cross)+aw*Math.abs(dot);
}
