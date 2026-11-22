import { DIRS, STORY, VEHICLES, MISSIONS, COSMETICS, INTERSECTIONS, RANKS, VERSION, AD_COINS, TRAINING, SERVICE, BALANCE as B } from './config.js';
import { ROAD_DUTY } from './highway.js';
import { translator } from './i18n.js';
const icons={survey:'M3 4l6-2 6 2 6-2v17l-6 2-6-2-6 2zM9 2v17m6-15v17',crew:'M4 15h16m-15 0v-3a7 7 0 0 1 5-7m4 0a7 7 0 0 1 5 7v3m-9-7V3h4v5M3 16h18v3H3z',board:'M3 3h18v14H3zM8 21l2-4m4 0 2 4M7 12V7m-2 2 2-2 2 2m4 4v-2l4-3m-3 0h3v3',radio:'M6 9h12v12H6zM8 9V2m5 2q3 0 4 3m-5 5h3m-6 4h6',ledger:'M5 3h13a1 1 0 0 1 1 1v17H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2zM8 3v15m3-10h5m-5 4h5',dividend:'M3 6h18v13H3zM3 10h18m-12 6 3-3 2 1 3-3',play:'M8 5l11 7-11 7z',pause:'M8 5v14M16 5v14',back:'M14 5l-7 7 7 7',gear:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',car:'M5 9l2-5h10l2 5M4 9h16v9H4zM6 18v3M18 18v3M7 13h2M15 13h2',star:'M12 3l3 6 6 1-4.5 4.5 1 6-5.5-3-5.5 3 1-6L3 10l6-1z',flag:'M5 22V3l14 1v10L5 13',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v6l4 2',person:'M12 3v1M9 8h6M12 6v9M7 12l5-5 5 5M12 15l-4 6M12 15l4 6',camera:'M3 7h5l2-3h4l2 3h5v14H3zM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8',sound:'M3 9h4l5-4v14l-5-4H3zM16 8q5 4 0 8',lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4'};
export const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]??icons.star}"/></svg>`;
export class UI {
  constructor(app) {this.app=app;this.root=document.querySelector('#ui');this.toastElement=document.querySelector('#toast');this.hudRefs=null;this.lastAnnouncement='';this.root.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)app.action(b.dataset.action,b.dataset.value,b);});this.root.addEventListener('input',e=>{if(e.target.dataset.setting)app.setting(e.target.dataset.setting,e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?Number(e.target.value):e.target.value);if(e.target.dataset.photo)app.photoSetting(e.target.dataset.photo,Number(e.target.value));});}
  get t() {return translator(this.app.language);}
  objectives(level,stats) {return (level?.objectives??[]).map(o=>`${this.t(o.stat)}: ${stats?Math.min(stats[o.stat],o.target)+'/':''}${o.target}`).join(' · ');}
  button(text,action,value='',cls='',disabled=false,ic='') {return `<button class="${cls}" data-action="${action}" data-value="${value}" ${disabled?'disabled':''}>${ic?icon(ic):''}<span>${text}</span></button>`;}
  render() {
    const a=this.app,t=this.t,s=a.progress.data;document.documentElement.lang=a.language;document.title=a.language==='ru'?'Траффинини — Traffino':'Traffino';
    document.querySelector('#app').className=a.screen==='menu'?'at-menu':a.screen==='gameplay'?'in-game':['photo','postView','incident'].includes(a.screen)?'in-photo':'in-panel';
    this.hudRefs=null;
    if(a.screen==='menu')this.root.innerHTML=this.menu();
    else if(a.screen==='gameplay')this.root.innerHTML=this.hud();
    else if(a.screen==='paused')this.root.innerHTML=`<div class="scrim"><section class="pause-card"><span class="eyebrow">${t('pause')}</span><h1>${t('paused')}</h1><p>${t('pauseHint')}</p>${this.button(t('resume'),'resume','','primary wide',[...a.pause.reasons].some(r=>r!=='screen'),'play')}<div class="button-row">${this.button(t('photo'),'photo','','',false,'camera')}${this.button(t('settings'),'settings','','',false,'gear')}</div>${this.button(t('finish'),'finish','','text-button')}</section></div>`;
    else if(a.screen==='photo')this.root.innerHTML=`<div class="photo-controls"><span>${t('photo')}</span><label>${t('photoSubject')}<select data-photo="subject">${['district','officer',...(a.game.highway?[]:['street']),...(a.view.incidentPoint?['incident']:[])].map(k=>`<option value="${['district','officer','street','incident'].indexOf(k)}" ${k===(a.view.photoSubject??'district')?'selected':''}>${t(k)}</option>`).join('')}</select></label><label>${t('rotate')}<input type="range" min="-3.14" max="3.14" step=".01" value="${a.view.baseAngle}" data-photo="angle"></label><label>${t('zoom')}<input type="range" min=".7" max="10" step=".01" value="${a.view.zoom}" data-photo="zoom"></label><label>${t('filter')}<select data-photo="filter">${['natural','warm','cool'].map((k,i)=>`<option value="${i}" ${i===(a.photoFilter??0)?'selected':''}>${t(k)}</option>`).join('')}</select></label>${this.button(t('hideUI'),'hidePhoto')}${this.button(t('photoExit'),'exitPhoto')}</div><button class="photo-reveal" data-action="hidePhoto" aria-label="${t('showUI')}">◉</button>`;
    else if(a.screen==='postView')this.root.innerHTML=`<div class="post-label"><div><small>${t('tourHint')}</small><strong>${t(a.progress.data.map)}</strong></div>${this.button(t('returnDesk'),'back','','',false,'back')}</div>`;
    else if(a.screen==='brief')this.root.innerHTML=this.brief();
    else if(a.screen==='dispatch')this.root.innerHTML=this.dispatch();
    else if(a.screen==='incident')this.root.innerHTML=`<section class="post-label incident-report"><div><small>${t('incident')}</small><strong>${t(a.game.reason)}</strong></div>${this.button(t('report'),'report','','primary',false,'ledger')}</section>`;
    else if(a.screen==='results')this.root.innerHTML=this.results();
    else {
      const content={story:()=>this.story(),collection:()=>this.collection(),challenges:()=>this.challenges(),progress:()=>this.progress(),settings:()=>this.settings()}[a.screen]?.()??'';
      this.root.innerHTML=`<div class="panel-wrap"><section class="panel panel-${a.screen}"><header>${this.button(t('back'),'back','','icon-text',false,'back')}<div class="wallet"><span>${t('coins')}</span> ◈ ${Math.floor(s.coins)}</div></header>${content}</section></div>`;
    }
    if(a.screen==='gameplay')this.cacheHUD();
    this.root.querySelector('h1')?.setAttribute('tabindex','-1');
    if(!['gameplay','photo','menu'].includes(a.screen))this.root.querySelector('h1')?.focus({preventScroll:true});
  }
  menu() {
    const t=this.t,s=this.app.progress.data,p=this.app.progress;
    const models=this.app.view.vehiclePreviews(['taxi','bus','police']);
    const modes=[['endless',p.endlessUnlocked,'taxi'],['rush',s.story[3],'bus'],['hardcore',s.story[7],'police']];
    return `<header class="main-header toy-header"><span class="town-badge"><i class="live-dot"></i>${t('serviceDesk')}</span>${this.button(t('settings'),'settings','','round settings-button',false,'gear')}</header><section class="hero toy-menu"><h1 class="street-sign" aria-label="Traffino"><span aria-hidden="true">Traffino</span></h1><p class="toy-invitation">${t('menuInvite')}</p>${this.button(t(s.story.some(Boolean)?'continue':'start'),'continue','','primary start',false,'play')}<div class="mode-grid">${modes.map(([id,unlocked,kind])=>`<button class="mode-button" data-action="play" data-value="${id}" ${unlocked?'':'disabled'}><img class="mode-model" src="${models[kind]}" alt="" width="240" height="180"><span>${t(id)}</span>${unlocked?'':`<b class="mode-lock">${icon('lock')}</b>`}</button>`).join('')}</div><p class="unlock-note">${!p.endlessUnlocked?t('unlockEndless'):!s.story[3]?t('unlockRush'):!s.story[7]?t('unlockHardcore'):t('endlessDesc')}</p></section><div class="city-caption"><span class="live-dot"></span>${t(s.map)}<span>06:00</span></div><nav class="menu-bottom toy-nav">${this.button(t('story'),'story','','',false,'flag')}${this.button(t('highway'),'dispatch','','',false,'survey')}${this.button(t('collection'),'collection','','',false,'car')}${this.button(t('challenges'),'challenges','','',false,'star')}${this.button(t('progress'),'progress','','',false,'person')}</nav><span class="toy-save">${t('localSave')}</span>`;
  }
  story() {const t=this.t,s=this.app.progress.data;return `<span class="eyebrow">${t('mentor')}</span><h1>${t('story')}</h1><p class="panel-intro">${t('storyDesc')}</p><div class="shift-grid">${STORY.map((l,i)=>`<button class="shift-card ${s.story[i]?'completed':''}" data-action="brief" data-value="${i}" ${i>0&&!s.story[i-1]?'disabled':''}><span class="shift-number">${String(i+1).padStart(2,'0')}</span><span><small>${t('shift')} ${i+1} · ${l.duration}${t('seconds')}</small><strong>${t('shift'+i)}</strong><span class="medal-stars">${s.story[i]?'★'.repeat(s.story[i])+'☆'.repeat(3-s.story[i]):i>0&&!s.story[i-1]?t('locked'):'○ ○ ○'}</span></span></button>`).join('')}</div><p class="muted">${t('medalHint')}</p>`;}
  brief() {
    const a=this.app,t=this.t,i=a.shift,level=STORY[i],topic=a.dialogueTopic;
    const first=i===0, question=key=>t(key==='traffic'?(first?'askNorth':'askHazard'):'askDuty');
    const quota=[t('assignmentCars').replace('{n}',level.goal),t('assignmentTime').replace('{n}',level.duration),this.objectives(level)].filter(Boolean).join(' ');
    const speech=topic==='traffic'?(first?t('northAnswer'):t('brief'+i)):topic==='duty'?quota+' '+t('wageAnswer').replace('{n}',a.progress.payRate):first?t('firstWelcome'):t('greet'+i);
    return `<div class="brief-stage"><div class="dialogue-bar">${this.button(t('back'),'back','','',false,'back')}<span>${t('shift')} ${i+1} / ${STORY.length}</span></div>
      <article class="brief conversation panel" aria-labelledby="dialogue-title">
      <div class="conversation-scene"><figure class="mentor-print"><img src="./assets/miro-portrait.jpg" height="640" width="640" alt=""><figcaption><strong>${t('miroName')}</strong><span>${t('miroRole')}</span></figcaption></figure>
      <div class="dialogue-lines"><h1 id="dialogue-title">${t('shift'+i)}</h1>${topic?`<p class="your-line"><b>${t('you')}</b> ${question(topic)}</p>`:''}
      <p class="speech-balloon" tabindex="-1">${speech}</p></div></div>
      <div class="reply-strip"><small>${t('yourReply')}</small><div>${['traffic','duty'].filter(k=>k!==topic).map(k=>this.button(question(k),'reply',k,'reply-choice')).join('')}${topic||a.progress.data.story[i]?this.button(t(first?'readyNorth':'readyDuty'),'startStory',String(i),'reply-choice ready',false,'play'):''}</div></div>
      </article></div>`;
  }
  dispatch(){
    const t=this.t, discount=this.app.progress.hasSkill('crew')?SERVICE.crewSeconds:0;
    const range=kind=>ROAD_DUTY[kind].map(seconds=>seconds-discount).join('–')+t('seconds');
    return `<div class="brief-stage"><div class="dialogue-bar">${this.button(t('back'),'back','','',false,'back')}<span>M 17</span></div>
      <article class="brief conversation panel"><div class="conversation-scene"><figure class="mentor-print"><img src="./assets/miro-portrait.jpg" width="640" height="640" alt=""><figcaption><strong>${t('miroName')}</strong><span>${t('miroRole')}</span></figcaption></figure>
      <div class="dialogue-lines"><h1>${t('bridgeDuty')}</h1><p class="speech-balloon">${t('bridgeBrief')}</p><p>${t('bridgeQuota')}</p></div></div>
      <div class="reply-strip"><small>${t('chooseDispatch')}</small><div>${this.button(t('roadRepair')+' · '+range('repair'),'takeDispatch','repair','reply-choice ready')}${this.button(t('roadCrash')+' · '+range('crash'),'takeDispatch','crash','reply-choice')}</div></div></article></div>`;
  }
  hud() {const t=this.t,g=this.app.game;return `<header class="hud"><div class="hud-brand">traffino${g.mode==='hardcore'?`<small class="hardcore-label">${t('hardcore')}</small>`:''}<span>${t(g.mode==='story'?'shift':'day')} <b id="hud-day">1</b></span></div><div class="score-box"><span>${t('score')}</span><strong id="hud-score">0</strong><small id="hud-pay" title="${t('wageTerms')}">◈ 0</small></div><div class="flow-box"><span>${t('flow')}</span><strong id="hud-flow">×1.0</strong><div class="flow-track"><i id="flow-fill"></i></div></div><div class="time-box"><span id="hud-phase">${t('morning')}</span><strong id="hud-time">06:00</strong></div><div class="hud-actions">${this.button(t('routes'),'routes','','round',false,'car')}${this.button(t('pause'),'pause','','round',false,'pause')}</div></header><div id="event-banner" role="status"></div><div id="emergency-banner" role="status"></div><div class="road-controls">${DIRS.map((d,i)=>`<button class="road-control" id="road-${i}" data-action="toggle" data-value="${i}" aria-label="${t(d)}"><span class="road-name">${t(d)} <kbd>${['W','D','S','A'][i]}</kbd></span><strong class="signal-state">${t('stopped')}</strong><span class="road-info"><b class="turn-arrow">↑</b> <span class="queue-count">0</span> ${icon('car')}</span><span class="jam-count"></span></button><button id="ped-${i}" class="ped-control" data-action="pedestrian" data-value="${i}" aria-label="${t('pedButton')} ${t(d)}" hidden>${icon('person')}<span>0</span></button>`).join('')}</div><footer class="game-footer"><div class="game-help"><span>${t('controls')}</span><span id="hud-goal"></span><span id="hud-objectives"></span></div><button id="detour" data-action="detour" hidden></button>${this.button(t('allStop'),'stopAll','','stop-all')}</footer><aside id="mentor" class="mentor-note"><img class="mentor-thumb" src="./assets/miro-portrait.jpg" width="56" height="62" alt=""><div class="radio-copy"><small>${t('miroName')} <b></b></small><div role="status" aria-live="polite" aria-atomic="true"><strong></strong><p></p></div></div></aside><div class="orientation-note">${t('orientation')}</div>`;}
  cacheHUD() {
    this.hudRefs={};for(const id of ['hud-day','hud-score','hud-pay','hud-flow','flow-fill','hud-time','hud-phase','event-banner','emergency-banner','hud-goal','mentor','detour'])this.hudRefs[id]=this.root.querySelector('#'+id);
    this.roadRefs=DIRS.map((_,i)=>{const button=this.root.querySelector('#road-'+i);return {button,state:button.querySelector('.signal-state'),queue:button.querySelector('.queue-count'),turn:button.querySelector('.turn-arrow'),jam:button.querySelector('.jam-count'),ped:this.root.querySelector('#ped-'+i)};});
  }
  updateHUD() {
    if(!this.hudRefs)return;const t=this.t,g=this.app.game,r=this.hudRefs,v=this.app.view;
    r['hud-day'].textContent=g.mode==='story'?g.shift+1:g.day;const score=Math.floor(g.stats.score),old=Number(r['hud-score'].dataset.score??0);if(score!==old){r['hud-score'].dataset.score=score;r['hud-score'].classList.remove('hud-pop');void r['hud-score'].offsetWidth;r['hud-score'].classList.add('hud-pop');}r['hud-score'].textContent=score.toLocaleString(this.app.language);r['hud-flow'].textContent='×'+g.flow.toFixed(1);r['flow-fill'].style.width=((g.flow-1)/4*100)+'%';
    const duty=g.dutyRecord(), finite=Number.isFinite(g.duration);
    r['hud-pay'].textContent=t('estimate')+' ◈ '+this.app.progress.wages(duty);
    const remaining=Math.max(0,Math.ceil((finite?g.duration:g.duty.number*SERVICE.dutySeconds)-g.elapsed));
    r['hud-time'].textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
    r['hud-phase'].textContent=!finite?t('shift')+' '+duty.number:t(g.timeOfDay<.2||g.timeOfDay>.86?'night':g.timeOfDay<.48?'morning':g.timeOfDay<.72?'afternoon':'evening');
    r['hud-goal'].textContent=`${t('goalLabel')}: ${duty.passed}/${g.level?.goal??(finite?SERVICE.rushGoal:SERVICE.dutyGoal)} · `+`${t('lives')}: ${g.stats.collisions}/${g.mode==='hardcore'?1:3}`;
    const objectiveNode=this.root.querySelector('#hud-objectives');if(objectiveNode)objectiveNode.textContent=this.objectives(g.level,g.stats);
    if (g.circuit && objectiveNode) {
      const missing = g.directions.filter(d => !g.circuit.has(d)).map(d => t(DIRS[d]));
      objectiveNode.textContent = g.circuit.size
        ? t('circuitNext')+' · '+missing.join(', ')
        : t('circuitHint')+' · +'+B.circuitBonus;
    }
    const event=g.event?.phase==='scheduled'?null:g.event, runner=g.vehicles.find(car=>car.active&&car.runnerAt!==null&&car.s<car.route.exitS),
      wreck=g.vehicles.find(car=>car.active&&car.crashLeft>0);
    const banner=r['event-banner'];
    if(runner) banner.textContent=t(DIRS[runner.direction])+' · '+(runner.committed?t('runnerCrossing'):t('runnerStop')+' · '+Math.max(0,Math.ceil(runner.runnerAt-g.time))+t('seconds'));
    else if(wreck) banner.textContent=t('wreckClearing')+' · '+t(DIRS[wreck.direction])+' · '+Math.ceil(wreck.crashLeft)+t('seconds');
    else if(event) banner.textContent=t(event.phase==='warning'?'eventSoon':'eventActive')+' · '+t(event.kind)+' · '+t(DIRS[event.direction])+' · '+(event.phase==='clearing'?t('siteClearing'):Math.ceil(event.remaining)+t('seconds'));
    else if(g.highway){
      const h=g.highway,green=g.directions.find(d=>g.signals[d]);
      const status=h.phase==='open'?t('twoWay'):h.phase==='draining'?t('bridgeDrain'):h.requested!==null&&green===undefined?t('nextConvoy')+' · '+t(DIRS[h.requested]):green===undefined?t('pickConvoy'):t('convoyFrom')+' · '+t(DIRS[green]);
      banner.textContent=(h.phase==='closed'?t(h.kind==='crash'?'roadCrash':'roadRepair')+' · '+Math.ceil(h.remaining)+t('seconds')+' · ':'')+status;
    }
    banner.hidden=!runner&&!wreck&&!event&&!g.highway;
    const detour=g.detourOption(),button=r.detour;
    button.hidden=!detour;
    if(detour){
      button.dataset.value=String(detour.car.serial);
      button.textContent=t('detour')+' · '+t(DIRS[detour.car.direction])+' → '+t(DIRS[detour.route.exit])+' [R]';
    }
    let emergency=null;for(const car of g.vehicles)if(car.active&&VEHICLES[car.kind].emergencyPriority&&!car.emergencyFailed&&(!emergency||car.emergencyLeft<emergency.emergencyLeft))emergency=car;
    r['emergency-banner'].textContent=emergency?`✚ ${t(emergency.kind)} · ${t(DIRS[emergency.direction])} · ${Math.ceil(emergency.emergencyLeft)}${t('seconds')}`:'';r['emergency-banner'].hidden=!emergency;
    const hudBottom=this.root.querySelector('.hud').getBoundingClientRect().bottom-this.root.getBoundingClientRect().top;
    for(let d=0;d<4;d++) {
      const el=this.roadRefs[d],point=v.roadPoint(d),q=g.queues[d],danger=g.dangerStates[d];
      point.y=Math.max(point.y,hudBottom+el.button.offsetHeight/2+6);
      el.button.hidden=!g.directions.includes(d);
      el.button.classList.toggle('circuit-served', g.circuit?.has(d) ?? false);
      el.button.style.left=point.x+'px';el.button.style.top=point.y+'px';el.button.classList.toggle('is-go',g.signals[d]);el.button.classList.toggle('is-danger',danger);el.button.classList.toggle('tutorial-pulse',g.tutorial===0||g.tutorial===1&&g.stats.passed>0?d===0:g.tutorial===2?d===1:false);
      el.button.setAttribute('aria-pressed',String(g.signals[d]));el.button.setAttribute('aria-label',`${t(DIRS[d])}: ${t(g.signals[d]?'go':'stopped')}, ${t('queue')} ${q.count}${danger?', '+t('danger'):''}`);
      el.state.textContent=t(g.highway?.requested===d&&!g.signals[d]?'queuedGreen':g.signals[d]?'go':'stopped');el.queue.textContent=q.count;
      const lane=g.lanes[d], first=lane.findIndex(car=>car.active&&!car.committed);
      const lead=lane[first], next=first>=0 && this.app.progress.hasSkill('board') && lane.find((car,index)=>index>first&&car.active&&!car.committed);
      const arrows=['↑','↰','↱'];
      el.turn.textContent=(lead?arrows[lead.turn]:'·')+(next?' › '+arrows[next.turn]:'');
      if(next)el.button.setAttribute('aria-label',el.button.getAttribute('aria-label')+', '+t('secondTurn')+' '+t(['turnStraight','turnLeft','turnRight'][next.turn]));
      el.jam.textContent=q.jam>0?`${t('jamWarning')} ${Math.max(0,Math.ceil((g.mode==='hardcore'?B.hardJamGrace:B.jamGrace)-q.jam))}`:danger?'!':'';
      const crossing=v.crossingPoint(d),active=g.people.some(p=>p.active&&p.direction===d);el.ped.hidden=!g.waitingPeople[d]&&!active;el.ped.style.left=crossing.x+'px';el.ped.style.top=crossing.y+'px';el.ped.querySelector('span').textContent=active?'•••':g.waitingPeople[d];el.ped.disabled=active;el.ped.classList.toggle('walking',active);
    }
    const teaching=g.mode==='story'&&(g.tutorial<4||g.elapsed<9);
    r.mentor.hidden=!teaching;
    if (teaching) {
      const step=Math.min(3,g.tutorial), paid=step===1 && g.stats.passed>0;
      const title=g.shift>0?t('shift'+g.shift):t(paid?'instructionPaid':'instruction'+step);
      if (r.mentor.querySelector('strong').textContent!==title) {
        r.mentor.querySelector('small b').textContent=g.shift===0?` · ${t('lessonStep')} ${step+1}/4`:'';
        r.mentor.querySelector('strong').textContent=title;
        r.mentor.querySelector('p').textContent=g.shift>0?t('brief'+g.shift):t(paid?'earnedFirst':['keyNorth','waitExit','keyEast','teachFlow'][step]);
      }
    }
  }
  results() {
    const a=this.app,g=a.game,t=this.t,s=g.stats,r=a.reward,ready=MISSIONS.filter(m=>!a.progress.data.session.claimed.includes(m.id)&&(a.progress.data.session.progress[m.stat]??0)>=a.progress.challengeTarget(m,'session')).length;
    return `<div class="panel-wrap"><section class="panel results"><span class="eyebrow">${t('results')} · ${t('day')} ${s.day}</span><h1>${t(g.reason)}</h1>${r.medal?`<div class="result-medal medal-${r.medal}">★ <span>${t(['','bronze','silver','gold'][r.medal])}</span> ★</div>`:''}<div class="result-best">${t('best')}: ${a.progress.data.best[g.mode]}</div><div class="result-score">${Math.floor(s.score).toLocaleString(a.language)}<span>${t(a.isBest?'newBest':'score')}</span></div><div class="result-grid">${[['vehicles',s.passed],['maxFlow','×'+s.maxFlow.toFixed(1)],['averageWait',s.averageWait.toFixed(1)+t('seconds')],['time',Math.floor(s.playTime)+t('seconds')],['reputation','+'+r.reputation],['coins','+'+r.coins]].map(([label,val])=>`<div><span>${t(label)}</span><strong>${val}</strong></div>`).join('')}</div><div class="unlock-list">${(a.unlocks??[]).map(text=>`<p>★ ${text}</p>`).join('')}</div>${ready?this.button(t('readyChallenges')+': '+ready,'challenges','','ready-reward',false,'star'):''}<details><summary>${t('lifetime')} · ${t('results')}</summary><div class="stats-list">${['buses','emergencyPassed','emergencyFailed','pedestrians','collisions','jams','longestWait','longestQueue','rushHours','eventsCompleted',...(g.circuit?['circuits']:[]),...(g.highway?['northConvoy','southConvoy']:[])].map(k=>`<span>${t(k==='emergencyFailed'?'emergencyFailedStat':k)}<b>${Math.round(s[k])}</b></span>`).join('')}</div></details><p class="settlement-note">${t(r.periods?'dutyPaid':'unpaid')}${r.periods?' · '+r.periods:''}</p><div class="pay-slip"><div><small>${t('earnedPay')}</small><b>◈ ${r.wages}</b>${r.premium?`<small>${t('premiumIncluded')} · ◈ ${r.premium}</small>`:''}</div><div><small>${t('shiftBonus')}</small><b>◈ ${r.bonus}</b></div>${this.button(t('readyToEquip'),'progress','','',false,'ledger')}</div>
    ${a.progress.data.runs===1&&r.periods?`<p class="first-purchase"><img src="./assets/miro-portrait.jpg" width="40" height="40" alt=""><span><b>${t('miroName')}</b> ${t('firstPurchase')}</span></p>`:`<p class="muted">${t('resultTip')}</p>`}<div class="button-row">${g.mode==='story'&&r.medal&&g.shift<7?this.button(t('nextShift'),'brief',String(g.shift+1),'primary',false,'play'):this.button(t('retry'),'retry','','primary',false,'play')}${this.button(t('menu'),'menu')}</div>${r.periods&&a.platform.rewardedAvailable?this.button(t(a.progress.data.adRewardRun===a.progress.data.runs?'claimed':'watchAd')+(a.progress.data.adRewardRun===a.progress.data.runs?'':' · +'+AD_COINS+' ◈'),'rewarded','','reward-ad',a.transitioning||a.progress.data.adRewardRun===a.progress.data.runs):''}${r.periods&&a.platform.rewardedAvailable?`<small class="ad-explanation">${t('adCosmetic')}</small>`:''}</section></div>`;
  }
  collection() {
    const t=this.t,s=this.app.progress.data,previews=this.app.view.vehiclePreviews();return `<span class="eyebrow">${t('discovered')} ${Object.keys(s.collection).length}/${Object.keys(VEHICLES).length}</span><h1>${t('collection')}</h1><div class="collection-grid">${Object.entries(VEHICLES).map(([id,v])=>{const c=s.collection[id];return `<article class="collection-card ${!c?'undiscovered':''}"><img class="vehicle-preview" src="${previews[id]}" alt="${t(id)}" width="240" height="180"><small>${t(v.rarity)}</small><h3>${t(id)}</h3><p>${c?`${t('seen')}: ${c.seen} · ${t('passed')}: ${c.passed}`:t('unknown')}</p></article>`;}).join('')}</div>`;
  }
  challenges() {
    const a=this.app,t=this.t,s=a.progress.data,scope=a.challengeTab??'all';a.progress.rollDaily();
    const source=scope==='all'?s.totals:s[scope].progress;
    return `<span class="eyebrow">${scope==='daily'?s.daily.date:t(scope==='session'?'session':'lifetime')}</span><h1>${t('challenges')}</h1><div class="tabs">${['all','daily','session'].map(k=>this.button(t(k==='all'?'lifetime':k),'challengeTab',k,scope===k?'active':'')).join('')}</div>${scope==='session'?`<p class="muted">${t('sessionHint')}</p>`:''}<div class="mission-list">${MISSIONS.map(m=>{const target=a.progress.challengeTarget(m,scope),reward=a.progress.challengeReward(m,scope),value=Math.min(target,source[m.stat]??0),claimed=scope==='all'?s.missions[m.id]:s[scope].claimed.includes(m.id);return `<article><div class="mission-icon">${icon('star')}</div><div class="mission-main"><h3>${t('mission_'+m.id)}</h3><div class="mission-track"><i style="width:${value/target*100}%"></i></div><small>${Math.floor(value*10)/10} / ${target} · ${reward.rep} XP</small></div>${this.button(t(claimed?'claimed':'claim'),'claim',`${m.id}:${scope}`,'',claimed||value<target)}</article>`;}).join('')}</div>`;
  }
  station() {
    const p=this.app.progress, t=this.t, term=p.data.career, target=SERVICE.promotionTargets[p.grade];
    const branches=TRAINING.filter(skill=>!skill.requires).map(root=>{
      const nodes=TRAINING.filter(skill=>skill.id===root.id || skill.requires===root.id).map(skill=>{
        const owned=p.hasSkill(skill.id), permanent=term.certified.includes(skill.id);
        const locked=skill.requires && !p.hasSkill(skill.requires);
        const text=permanent?t('permanent'):owned?t('installed'):locked?t('needSkill')+' · '+t('skill_'+skill.requires):t('equip')+' · ◈ '+skill.cost;
        const shortfall=locked?'◈ '+skill.cost:!owned&&p.data.coins<skill.cost?t('needCoins')+' ◈ '+(skill.cost-p.data.coins):'';
        const effect=t('effect_'+skill.id).replace('{seconds}',SERVICE.radioSeconds).replace('{coins}',SERVICE.premium).replace('{wait}',B.timelyWait).replace('{flow}',SERVICE.premiumFlow).replace('{lead}',SERVICE.warningLead).replace('{cut}',SERVICE.crewSeconds);
        return `<li class="skill-node ${owned?'owned':''}"><span class="equipment-icon">${icon(skill.id)}</span><div><h3 tabindex="-1" id="skill-${skill.id}">${t('skill_'+skill.id)}</h3><p>${effect}</p>
          ${this.button(text,'learn',skill.id,'skill-buy',!p.canLearn(skill))}${shortfall?`<small>${shortfall}</small>`:''}</div></li>`;
      }).join('');
      return `<article class="skill-branch branch-${root.id}"><h2>${t({board:'branchBoard',ledger:'branchLedger',survey:'branchSurvey'}[root.id])}</h2><ol>${nodes}</ol></article>`;
    }).join('');
    return `<div class="service-banner"><div><span class="dispatch-kicker">${t('serviceDesk')}</span><h1>${t('grade'+p.grade)}</h1>
      <div class="service-facts"><div><b>◈ ${p.payRate}</b><small>${t('payEach')}</small></div><div><b>${term.served}${target?` <em>/ ${target}</em>`:''}</b><small>${t('serviceCount')}</small></div></div></div>
      ${this.button(t('postTour'),'postView','','post-tour',false,'camera')}</div>
      <div class="skill-tree">${branches}</div><section class="review-card"><span class="dispatch-kicker">${t('gradeReview')}</span><h2>${t('grade'+(target?p.grade+1:p.grade))}</h2>
      <p>${t(target?'gradeInstruction':'finalGrade')}</p>${target?`<progress value="${term.served}" max="${target}" aria-label="${t('serviceCount')}"></progress>
      <div class="cert-options">${TRAINING.filter(skill=>!skill.requires&&!term.certified.includes(skill.id)).map(skill=>this.button(t('certify')+' · '+t('skill_'+skill.id),'review',skill.id,'',!p.canPromote(skill.id))).join('')}</div>`:''}</section>`;
  }
  refreshStation(focusId) {
    const top=this.root.querySelector('.panel').scrollTop;
    this.render();
    this.root.querySelector('.panel').scrollTop=top;
    this.root.querySelector('#skill-'+focusId)?.focus({preventScroll:true});
  }
  review(root) {
    const t=this.t, p=this.app.progress;
    const lines=[[t('keptSkill'),t('skill_'+root)],[t('newPay'),'◈ '+p.rateAfterPromotion(root)],[t('resetBalance'),'◈ '+p.data.coins+' → 0']];
    const detail=`<dl class="promotion-terms">${lines.map(([title,value])=>`<div><dt>${title}</dt><dd>${value}</dd></div>`).join('')}</dl><p>${t('termReset')}</p>`;
    this.confirm(t('grade'+(p.grade+1)),'confirmPromotion',t('signReview'),root,detail);
  }
  progress() {
    const a=this.app,s=a.progress.data,t=this.t,rank=a.progress.rank;
    return `${this.station()}<span class="dispatch-kicker">${t('careerArchive')}</span><h2>${t('rank'+rank)}</h2><p class="panel-intro">${s.reputation} XP ${rank<5?'/ '+RANKS[rank+1]+' XP':''} · ${t('best')}: ${Math.max(...Object.values(s.best))}</p><h2>${t('district')}</h2><div class="choice-grid">${INTERSECTIONS.map(m=>`<article><div class="district-patch shop-art" style="--shop:${m.id==='garden'?0:4}"></div><h3>${t(m.id)}</h3>${this.button(t(s.map===m.id?'selected':s.reputation<m.unlock?'locked':'select')+(s.reputation<m.unlock?' · '+m.unlock+' XP':''),'map',m.id,'',s.map===m.id||s.reputation<m.unlock)}</article>`).join('')}</div><h2>${t('shop')}</h2><p class="muted">${t('cosmeticHint')}</p><div class="choice-grid cosmetics">${COSMETICS.map(c=>`<article><div class="swatch" style="background:#${c.color.toString(16)}"></div><h3>${t(c.id)}</h3>${this.button(t(s.selectedCosmetic===c.id?'selected':s.cosmetics.includes(c.id)?'select':'buy')+(!s.cosmetics.includes(c.id)?' · ◈ '+c.cost:''),'buy',c.id,'',s.selectedCosmetic===c.id||(!s.cosmetics.includes(c.id)&&s.coins<c.cost))}</article>`).join('')}</div><h2>${t('lifetime')}</h2><div class="stats-list">${['passed','buses','pedestrians','collisions','jams','nights'].map(k=>`<span>${t(k)}<b>${Math.floor(s.totals[k]??0)}</b></span>`).join('')}</div>`;
  }
  settings() {
    const t=this.t,s=this.app.progress.data.settings;return `<span class="eyebrow">traffino</span><h1>${t('settings')}</h1><div class="settings-list">${['master','music','sfx'].map(k=>`<label><span>${t(k)}</span><input type="range" min="0" max="1" step=".05" value="${s[k]}" data-setting="${k}"></label>`).join('')}<label><span>${t('language')}</span><select data-setting="language"><option value="ru" ${this.app.language==='ru'?'selected':''}>Русский</option><option value="en" ${this.app.language==='en'?'selected':''}>English</option></select></label><label><span>${t('quality')}</span><select data-setting="quality">${['low','medium','high'].map(q=>`<option value="${q}" ${s.quality===q?'selected':''}>${t(q)}</option>`).join('')}</select></label>${['shake','haptics'].map(k=>`<label><span>${t(k)}</span><input type="checkbox" data-setting="${k}" ${s[k]?'checked':''}></label>`).join('')}</div>${this.app.platform.fullscreenAvailable?this.button(t('fullscreen'),'fullscreen'):''} ${this.button(t('reset'),'reset','','danger-button')}<p class="muted">Traffino · ${VERSION}</p>`;
  }
  confirm(text,action,label,value='',detail='') {const t=this.t;this.confirmTrigger=document.activeElement;const overlay=document.createElement('div');overlay.className='confirm-overlay';overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-label="${text}"><h2>${text}</h2>${detail}<div class="button-row">${this.button(label,action,value,action==='confirmPromotion'?'primary':'danger-button')}${this.button(t('cancel'),'cancelConfirm')}</div></section>`;this.root.append(overlay);overlay.querySelector('[data-action="cancelConfirm"]').focus();}
  dismissConfirm() {
    this.root.querySelector('.confirm-overlay')?.remove();
    if(this.confirmTrigger?.isConnected)this.confirmTrigger.focus({preventScroll:true});
    this.confirmTrigger=null;
  }
  toast(key) {this.toastText(this.t(key));}
  toastText(text) {this.toastElement.textContent=text;this.toastElement.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toastElement.classList.remove('show'),4200);}
}





