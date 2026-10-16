import { CARS } from './cars.js';
import { LEVELS } from './race.js';
import { peakHp } from './physics.js';
import { drawCar, carLength } from './carart.js';
import { PARTS, PAINTS, RIMS, EVENTS, PRICES, buildCar, buyCar, buyPart, partPrice, equipRim, normalizeCareer } from './career.js';

const money = n => '$' + n.toLocaleString('en-US');
const button = (action, label, extra = '') => `<button data-action="${action}" ${extra}>${label}</button>`;
export function createGarage({ career, prefs, save, start }) {
  const root = document.getElementById('hub');
  let mode = 'career', tab = 'race', quickCar = Math.max(0, Math.min(CARS.length - 1, prefs.car || 0));
  let event = career.unlocked, timer, preview;
  const selected = () => mode === 'career' ? buildCar(career) : CARS[quickCar];
  function toast(message) {
    const el = document.getElementById('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(timer); timer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  function commit(message) { const saved = save(); render(); if (message && saved) toast(message); }
  function partsPanel() {
    const s = career.owned[career.selected];
    return `<h3>Performance parts</h3><p class="muted">Three stages each. Changes apply to this car.</p>` + PARTS.map(p => {
      const n = s.parts[p.id] || 0, price = partPrice(career, p.id);
      const before = buildCar(career), upgraded = structuredClone(career);
      upgraded.owned[career.selected].parts[p.id] = Math.min(3, n + 1);
      const after = buildCar(upgraded);
      const changes = { engine: `${peakHp(before)} → ${peakHp(after)} hp`, tires: `${before.mu.toFixed(2)} → ${after.mu.toFixed(2)} grip`, gearbox: `${Math.round(before.shiftTime * 1000)} → ${Math.round(after.shiftTime * 1000)} ms shifts`, weight: `${before.mass} → ${after.mass} kg`, nitrous: `${Math.round(before.nitroTq)} → ${Math.round(after.nitroTq)} Nm boost` };
      return `<article class="part"><div><strong>${p.name}</strong> <span class="stages">${n}/3</span><p>${n === 3 ? 'Fully upgraded' : changes[p.id]}</p><details class="part-info"><summary>Details</summary><p>${p.detail}</p></details></div>${button('part:' + p.id, n === 3 ? 'MAXED' : money(price) + ' +', n === 3 || price > career.cash ? 'disabled' : '')}</article>`;
    }).join('');
  }
  function stylePanel() {
    const s = career.owned[career.selected];
    return `<h3>Paint & wheels</h3><p class="muted">Free paint. Purchased wheels can be swapped anytime.</p><span class="eyebrow">Body paint</span><div class="swatches">${PAINTS.map((p, i) => button('paint:' + i, '', `style="background:${p}" aria-label="Paint ${['amber','red','blue','green','white','graphite','purple','pink'][i]}" aria-pressed="${s.color === p}" class="${s.color === p ? 'active' : ''}"`)).join('')}</div><span class="eyebrow">Wheel collection</span><div class="wheels">${RIMS.map(r => button('rim:' + r.id, `${r.name}<small>${s.rims.includes(r.id) ? (s.rim === r.id ? 'Equipped' : 'Owned · equip') : '$350 · buy & equip'}</small>`, `class="${s.rim === r.id ? 'active' : ''}" ${!s.rims.includes(r.id) && career.cash < 350 ? 'disabled' : ''}`)).join('')}</div>`;
  }
  function tunePanel() {
    const c = selected(), s = career.owned[career.selected];
    return `<h3>Tune setup</h3><p class="muted">Test your built car on an empty strip. Adjust one setting at a time and compare time slips.</p><label class="tune-label" for="launch">Launch RPM <strong id="rpm-value">${c.launchRpm.toLocaleString()}</strong></label><input id="launch" type="range" min="2000" max="${c.redline - 500}" step="50" value="${c.launchRpm}"><p class="muted">Too low can bog the engine. Too high can overwhelm the tires.</p><label class="tune-label" for="gearing">Final drive</label><select id="gearing"><option value="0.9" ${s.final === 0.9 ? 'selected' : ''}>Long · fewer shifts, slower acceleration</option><option value="1" ${s.final === 1 ? 'selected' : ''}>Balanced · factory ratio</option><option value="1.1" ${s.final === 1.1 ? 'selected' : ''}>Short · stronger pull, earlier shifts</option></select><p class="muted" style="margin-top:16px">Watch the shift light. Use nitrous from second gear once the tires hook up.</p>`;
  }
  function dealerPanel() {
    return `<h3>Car shop</h3><p class="muted">Each car keeps its own parts, paint, wheels, and tune.</p>` + [...CARS].sort((a,b) => PRICES[a.id] - PRICES[b.id]).map(c => {
      const owned = Object.hasOwn(career.owned, c.id), spec = buildCar(career, c.id);
      return `<article class="dealer"><h3>${c.name}</h3><p>${peakHp(spec)} hp / ${spec.mass} kg / ${c.gears.length}-speed<br>${c.blurb}</p>${button('car:' + c.id, owned ? (career.selected === c.id ? 'In your garage · selected' : 'Owned · select') : `Buy for ${money(PRICES[c.id])}`, !owned && career.cash < PRICES[c.id] ? 'disabled' : '')}</article>`;
    }).join('');
  }
  function racePanel() {
    const c = selected();
    if (mode === 'quick') return `<h3>Quick race</h3><p class="muted">${c.blurb}</p><label class="tune-label" for="difficulty">Opponent</label><select id="difficulty">${LEVELS.map(l => `<option value="${l.id}" ${prefs.difficulty === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}</select><p class="race-note">Stock cars, no entry fee. Your career stays separate.</p>`;
    const e = EVENTS[event];
    const best = Math.min(career.best[c.id] ?? Infinity, prefs.testBest?.[c.id] ?? Infinity);
    const pace = `${e.rival}: about ${e.pace.toFixed(1)}s ET · Your car’s best: ${Number.isFinite(best) ? best.toFixed(2) + 's' : 'no time yet'}`;
    const guidance = !Number.isFinite(best) ? 'Set a baseline in Tune → Solo test pass.' : best > e.pace + .25 ? 'Your best is off the pace. Try a solo tune test, upgrades, or another car.' : 'A quick reaction and clean shifts can decide this one.';
    return `<h3>Ready to race</h3><p class="muted">${c.blurb}</p><label class="tune-label" for="event-select">Event <span>${career.cleared.length} / ${EVENTS.length} beaten</span></label><select id="event-select">${EVENTS.map((e,i) => `<option value="${i}" ${i === event ? 'selected' : ''} ${i > career.unlocked ? 'disabled' : ''}>${e.name}${career.cleared.includes(i) ? ' ✓' : i > career.unlocked ? ' · locked' : ''}</option>`).join('')}</select><div class="opponent"><strong>vs. ${e.rival}</strong><span>${money(e.purse)} to win</span></div><p class="muted">${e.description}</p><p class="rival-pace">${pace}</p><details class="part-info"><summary>Matchup tips</summary><p>${guidance} ET excludes reaction time; your best includes previous tunes and solo tests.</p></details><p class="race-note">${career.cleared.includes(event) ? 'Race again to earn cash and improve your time.' : `First win: +${money(e.bonus)} bonus and the next event.`}</p>`;
  }
  function render() {
    const focusAction = document.activeElement?.dataset?.action;
    const c = selected(), isCareer = mode === 'career';
    const cars = isCareer ? CARS.filter(x => Object.hasOwn(career.owned, x.id)) : CARS;
    const index = cars.findIndex(x => x.id === c.id);
    root.innerHTML = `<header class="topbar"><div class="brand">DRAG <em>RACER</em></div><nav class="mode-switch" aria-label="Game mode">${button('mode:career','Career', `class="${isCareer ? 'active' : ''}" aria-pressed="${isCareer}"`)}${button('mode:quick','Quick race', `class="${!isCareer ? 'active' : ''}" aria-pressed="${!isCareer}"`)}</nav><div class="wallet">${isCareer ? money(career.cash) : 'FREE PLAY'}</div></header>
      <main class="workspace"><div class="garage-grid"><section class="showroom" aria-label="Selected car"><div class="car-heading"><h1>${c.name}</h1><span>${c.cyl === 8 ? 'V8' : 'Inline-four'} · ${c.gears.length}-speed</span></div><canvas class="preview" width="1400" height="680" aria-label="${c.name} preview"></canvas><div class="car-picker">${button('cycle:-1','◀', `aria-label="Previous car" ${cars.length < 2 ? 'disabled' : ''}`)}<span>${index + 1} / ${cars.length} ${isCareer ? 'owned' : 'cars'}</span>${button('cycle:1','▶', `aria-label="Next car" ${cars.length < 2 ? 'disabled' : ''}`)}</div><div class="specs"><div><strong>${peakHp(c)} <small>hp</small></strong><span>POWER</span></div><div><strong>${c.mass} <small>kg</small></strong><span>WEIGHT</span></div><div><strong>${(isCareer ? career.best[c.id] : prefs.best[c.id])?.toFixed(2) ?? '—'} <small>s</small></strong><span>BEST TIME</span></div></div></section>
      <section class="panel ${!isCareer || tab === 'race' ? 'race-panel' : ''}" aria-label="Garage controls">${isCareer ? `<nav class="tabs" aria-label="Workshop">${[['race','Race'],['upgrades','Parts'],['style','Paint'],['tune','Tune'],['dealer','Cars']].map(([id,label]) => button('tab:' + id,label,`class="${tab === id ? 'active' : ''}" aria-pressed="${tab === id}"`)).join('')}</nav>` : ''}<div class="panel-body">${!isCareer ? racePanel() : ({race:racePanel,upgrades:partsPanel,style:stylePanel,tune:tunePanel,dealer:dealerPanel})[tab]()}</div><div class="race-action">${button('race', isCareer && tab === 'tune' ? 'Solo test pass →' : 'Race →', 'class="primary"')}${isCareer && tab === 'tune' ? '<span>Free test · No rival, wins or losses</span>' : isCareer && tab !== 'race' ? `<span>${EVENTS[event].name} · vs. ${EVENTS[event].rival}</span>` : '<span>Hold gas. Launch on green. Shift on the light.</span>'}</div></section></div>
      <footer class="footer"><details><summary>Controls & saves</summary><p>SPACE: gas · ↑: launch / shift · N: nitrous · ESC: pause · R: retry. On touch screens, use the driving buttons. Only wins earn cash. Losses and red lights pay nothing. Progress saves in this browser; export a backup to move devices. Career best times include upgrades.</p><div class="footer-actions">${button('export','Export save')}${button('import','Import save')}<input type="file" id="save-file" accept=".json,application/json" hidden></div></details><button data-sound-toggle aria-controls="sound-panel" aria-expanded="false">Sound</button><span>${isCareer ? `${career.wins} wins · ${career.cleared.length} rivals beaten` : 'Quarter mile · Stock cars'}</span></footer></main>`;
    preview = root.querySelector('.preview');
    if (focusAction) [...root.querySelectorAll('[data-action]')].find(el => el.dataset.action === focusAction && !el.disabled)?.focus({ preventScroll: true });
  }
  function launch() { start({ mode: mode === 'career' && tab === 'tune' ? 'test' : mode, car: selected(), event }); }
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-action]'); if (!el || el.disabled) return;
    const [action, arg] = el.dataset.action.split(':');
    if (action === 'race') { launch(); return; }
    if (action === 'mode') { mode = arg; render(); return; }
    if (action === 'tab') { tab = arg; render(); return; }
    if (action === 'cycle') {
      const cars = mode === 'career' ? CARS.filter(c => Object.hasOwn(career.owned, c.id)) : CARS;
      const i = cars.findIndex(c => c.id === selected().id);
      const next = cars[(i + +arg + cars.length) % cars.length];
      if (mode === 'career') career.selected = next.id; else { quickCar = CARS.indexOf(next); prefs.car = quickCar; }
      commit(); return;
    }
    if (action === 'select') { if (mode === 'career') career.selected = arg; else { quickCar = CARS.findIndex(c => c.id === arg); prefs.car = quickCar; } commit(); }
    if (action === 'part' && buyPart(career, arg)) commit('Upgrade installed. Take it to the strip.');
    if (action === 'paint') { career.owned[career.selected].color = PAINTS[+arg]; commit('Fresh paint. Looking good.'); }
    if (action === 'rim' && equipRim(career, arg)) commit('Wheels fitted.');
    if (action === 'car') { if (Object.hasOwn(career.owned, arg)) career.selected = arg; else if (!buyCar(career, arg)) return; commit('Your ride is ready.'); }
    if (action === 'export') {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ game: 'drag-racer', career }, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'drag-racer-career.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Career backup exported.');
    }
    if (action === 'import') root.querySelector('#save-file').click();
  });
  root.addEventListener('input', e => { if (e.target.id === 'launch') root.querySelector('#rpm-value').textContent = (+e.target.value).toLocaleString(); });
  root.addEventListener('change', async e => {
    if (e.target.id === 'event-select') { event = +e.target.value; render(); root.querySelector('#event-select')?.focus(); }
    if (e.target.id === 'launch') { career.owned[career.selected].launch = +e.target.value; save(); }
    if (e.target.id === 'gearing') { career.owned[career.selected].final = +e.target.value; save(); }
    if (e.target.id === 'difficulty') { prefs.difficulty = e.target.value; save(); }
    if (e.target.id === 'save-file') {
      const file = e.target.files[0]; if (!file) return;
      try {
        if (file.size > 100000) throw Error('File too large');
        const data = JSON.parse(await file.text());
        if (data.game !== 'drag-racer' || data.career?.version !== 1 || !data.career.owned) throw Error('Invalid save');
        if (!confirm('Replace your current career with this backup?')) return;
        Object.assign(career, normalizeCareer(data.career)); event = career.unlocked; commit('Career restored.');
      } catch { toast('That file is not a supported Drag Racer save.'); }
    }
  });
  function draw(time) {
    if (!preview) return;
    const g = preview.getContext('2d'), c = selected();
    g.setTransform(2,0,0,2,0,0); g.clearRect(0,0,700,340);
    // Simple illustrated garage, with the car as the focal point.
    const wall = g.createLinearGradient(0,0,0,235);
    wall.addColorStop(0,'#8d9198'); wall.addColorStop(1,'#c2c5ca');
    g.fillStyle=wall; g.fillRect(0,0,700,235);
    g.fillStyle='#5c402c'; g.fillRect(0,0,700,15); g.fillStyle='#392b23';g.fillRect(0,15,700,4);
    g.fillStyle='#51565e'; g.fillRect(300,38,230,119);
    const sky=g.createLinearGradient(0,44,0,150);sky.addColorStop(0,'#111e3c');sky.addColorStop(1,'#354e72');
    g.fillStyle=sky;g.fillRect(306,44,218,107);g.fillStyle='#c6d2e4';
    for(let i=0;i<12;i++)g.fillRect(317+(i*47)%198,54+(i*19)%78,1.5,1.5);
    g.fillStyle='#51565e';g.fillRect(412,44,5,107);
    g.fillStyle='#8e2027';g.fillRect(37,98,114,137);g.fillStyle='#55171d';
    for(let y=119;y<230;y+=22)g.fillRect(43,y,102,2);
    g.fillStyle='#c3c5c8';for(let y=109;y<230;y+=22)g.fillRect(76,y,35,3);
    const floor=g.createLinearGradient(0,235,0,340);floor.addColorStop(0,'#8a8f95');floor.addColorStop(1,'#5a6169');
    g.fillStyle=floor;g.fillRect(0,235,700,105);g.fillStyle='#454b52';g.fillRect(0,234,700,3);
    const ppm=Math.min(127,610/carLength(c)), x=(700-carLength(c)*ppm)/2;
    drawCar(g,c,x,306,{ppm});

  }
  render();
  return { render, draw, launch, toast, setEvent(index) { if (Number.isInteger(index) && index >= 0 && index <= career.unlocked) event = index; }, show() { root.hidden = false; render(); }, hide() { root.hidden = true; } };
}
