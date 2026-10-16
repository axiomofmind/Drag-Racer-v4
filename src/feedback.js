// Coaching uses observations from this pass, never an estimated time penalty.
export function raceFeedback(race, previous = null) {
  const { p, a } = race, t = p.telemetry;
  let summary, tip;
  if (race.result === 'foul') {
    summary = `False start${p.rt < 0 ? `: ${Math.abs(p.rt).toFixed(3)}s early` : ''}.`;
    tip = 'Wait for green. Press R or Retry for another attempt.';
  } else if (p.et == null) {
    summary = 'No completed quarter-mile pass.';
    tip = 'Hold gas, launch on green, then shift when the light comes on.';
  } else {
    const margin = p.fin != null && a.fin != null ? Math.abs(p.fin - a.fin).toFixed(3) : null;
    summary = race.solo ? `Test pass: ${p.et.toFixed(3)}s quarter mile.` : race.result === 'win' && a.red ? 'Win: your opponent false-started.'
      : `${race.result === 'win' ? 'Won' : 'Lost'}${margin ? ` by ${margin}s` : ''}. Quarter mile: ${p.et.toFixed(3)}s.`;
    if (race.result === 'lose' && a.et != null && p.et < a.et && p.rt > a.rt) {
      tip = `Your pass was ${(a.et - p.et).toFixed(3)}s quicker, but your reaction was ${(p.rt - a.rt).toFixed(3)}s slower. Focus on the launch light.`;
    } else if (t?.wheelspin > 0.2) {
      tip = `${t.wheelspin.toFixed(2)}s of wheelspin in the first 60 feet. Try a lower launch RPM or better tires.`;
    } else if (t?.bog > 0.2) {
      tip = 'Revs dropped low during the launch. Try raising launch RPM by 250 and compare your next run.';
    } else if (t?.limiter > 0.2) {
      tip = `${t.limiter.toFixed(2)}s on the rev limiter. Shift when the light comes on to keep accelerating.`;
    } else if (t?.shifts.some(s => s.rpm < s.target - 700)) {
      tip = 'You shifted early. Let the engine reach the shift light before changing up.';
    } else if (p.rt > 0.5) {
      tip = `Reaction: ${p.rt.toFixed(3)}s. Be ready to launch as the tree turns green.`;
    } else if (p.car.nitro - p.s.nitroLeft < 0.2) {
      tip = 'Nitrous went unused. Try holding NOS from second gear once the tires grip.';
    } else {
      tip = 'Clean launch and shifts. Keep this rhythm and experiment with your tune.';
    }
  }
  let comparison = '';
  if (!p.red && race.result !== 'foul' && p.et != null && previous?.et > 0) {
    const delta = previous.et - p.et;
    comparison = Math.abs(delta) < 0.0005 ? 'Matched your previous clean run in this car.'
      : `${Math.abs(delta).toFixed(3)}s ${delta > 0 ? 'quicker' : 'slower'} than your previous clean run in this car.`;
  }
  return { summary, tip, comparison };
}

export function nextRivalIndex(race, config, career, count) {
  if (config?.mode !== 'career' || race?.result !== 'win') return null;
  const next = config.event + 1;
  return next < count && next <= career.unlocked ? next : null;
}
