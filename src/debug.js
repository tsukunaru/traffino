import { VEHICLES, EVENTS } from './config.js';
export function installDebug(app) {
  window.__traffino=app;
  const panel=document.createElement('details');panel.className='debug-panel';panel.innerHTML=`<summary>DEV</summary><label>Density <input id="debug-density" type="range" min=".1" max="3" step=".1" value="1"></label><label>Day <input id="debug-day" type="number" min="1" max="100" value="1"></label><label>Time <input id="debug-time" type="range" min="0" max=".99" step=".01" value=".22"></label><label>Flow <input id="debug-flow" type="range" min="1" max="5" step=".1" value="1"></label><select id="debug-vehicle">${Object.keys(VEHICLES).map(v=>`<option>${v}</option>`).join('')}</select><button id="debug-spawn">Spawn</button><select id="debug-event">${EVENTS.map(v=>`<option>${v}</option>`).join('')}</select><button id="debug-trigger">Trigger event</button><button id="debug-clear">Clear traffic</button><label><input id="debug-god" type="checkbox">Invulnerable</label><label><input id="debug-routes" type="checkbox">All routes / conflict points</label><pre id="debug-states"></pre>`;document.querySelector('#app').append(panel);
  panel.querySelector('#debug-density').oninput=e=>{if(app.game)app.game.densityScale=Number(e.target.value);};
  const setTime=()=>{if(app.game)app.game.time=app.game.elapsed=Math.max(0,(Number(panel.querySelector('#debug-day').value)-1+Number(panel.querySelector('#debug-time').value)-.22)*180);};
  panel.querySelector('#debug-day').onchange=setTime;panel.querySelector('#debug-time').oninput=setTime;
  panel.querySelector('#debug-flow').oninput=e=>{if(app.game)app.game.flow=Number(e.target.value);};
  panel.querySelector('#debug-spawn').onclick=()=>app.game?.spawn(0,panel.querySelector('#debug-vehicle').value);
  panel.querySelector('#debug-trigger').onclick=()=>app.game?.triggerEvent(panel.querySelector('#debug-event').value,1);
  panel.querySelector('#debug-clear').onclick=()=>app.game?.clearTraffic();
  panel.querySelector('#debug-god').onchange=e=>{if(app.game)app.game.invulnerable=e.target.checked;};
  panel.querySelector('#debug-routes').onchange=e=>{app.view.debugRoutes=e.target.checked;};
  setInterval(()=>{if(panel.open)panel.querySelector('#debug-states').textContent=`FPS ${(1000/app.frameMs).toFixed(0)} | CPU ${app.cpuMs?.toFixed(1)} ms\nDraws ${app.view.renderer.info.render.calls}\n`+(app.game?.vehicles.filter(v=>v.active).map(v=>`${v.id} ${v.kind} ${v.state}`).join('\n')??'');},500);
}
