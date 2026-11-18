// Treaty status on incident cards. Data: treaty_status.json (UN Treaty Collection and ICRC records).
// Exact perpetrator wordings are matched to a state; a wording not in the list gets no alleged-state entry.
window.VWTreaty = (() => {
  let D = null;
  const NAMES = {gc: 'Geneva Conventions', ap1: 'Additional Protocol I', ap2: 'Additional Protocol II', rome: 'Rome Statute', genocide: 'Genocide Convention',
    iccpr: 'ICCPR', cat: 'Convention against Torture', crc: 'Convention on the Rights of the Child', opac: 'Optional Protocol on children in armed conflict', ced: 'Enforced Disappearance Convention'};
  const ORDER = ['gc', 'ap1', 'ap2', 'rome', 'genocide', 'iccpr', 'cat', 'crc', 'opac', 'ced'];
  const NOTES = {coalition: 'Named as lead of the coalition. The status of other coalition members is not shown.', claimed: 'This attribution comes from a claim, as noted in the perpetrator field.',
    defacto: 'Status shown is that of the state of Afghanistan.', inferred: 'State taken from the incident report.', mixed: 'Applies to the state forces named.'};
  const node = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const label = (state, k) => { const n = k === 'rome' && D.rome_notes[state]; return NAMES[k] + (n ? ' (' + n + ')' : ''); };
  const line = (head, items) => { if (!items.length) return null; const p = node('div'); p.append(node('b', null, head + ': '), items.join(', ') + '.'); return p; };
  const romeText = (state) => { const v = D.states[state].rome, n = D.rome_notes[state];
    return (v === 'party' ? 'party' : v === 'signed' ? 'signed, not ratified' : v === 'withdrawn' ? 'withdrew' : 'not a party') + (n ? ' (' + n + ')' : ''); };
  const load = () => fetch('/treaty_status.json').then((r) => r.ok ? r.json() : null).then((j) => { D = j; }).catch(() => { D = null; });
  const section = (r) => {
    if (!D) return null;
    let hit = D.perpetrators[(r.perpetrator || '') + '|' + (r.actor_type || '')];
    if (!hit && r.actor_type === 'state' && r.perpetrator) { const p = (D.state_patterns || []).find(([x]) => new RegExp(x, 'i').test(r.perpetrator)); hit = p ? {m: 'named', s: p[1]} : null; }
    hit = hit || {};
    const alleged = hit.s && D.states[hit.s] ? hit.s : null, place = D.locations[r.location] || null;
    if (!alleged && !place) return null;
    const g = node('div', 'legal treaty'); g.append(node('div', 'sub', 'Treaty status (not a legal finding)'));
    if (alleged) {
      const s = D.states[alleged], by = (v) => ORDER.filter((k) => s[k] === v).map((k) => label(alleged, k));
      g.append(node('b', null, (alleged === place ? 'Alleged state and location: ' : 'Alleged state: ') + alleged));
      if (NOTES[hit.m]) g.append(node('div', null, NOTES[hit.m]));
      [['Party', by('party')], ['Signed, not ratified', by('signed')], ['Withdrew', by('withdrawn')], ['Not a party', by('none')]].forEach(([h, a]) => { const l = line(h, a); if (l) g.append(l); });
    }
    if (place && place !== alleged) { const p = node('div'); p.append(node('b', null, 'Location: ' + place + '. '), 'Rome Statute: ' + romeText(place) + '.'); g.append(p); }
    if (hit.m === 'nonstate') g.append(node('div', null, 'Armed groups do not join these treaties. In an armed conflict, Common Article 3 of the Geneva Conventions and customary law can still bind them.'));
    g.append(node('div', 'sub treaty-note', 'From UN and ICRC treaty records, checked ' + D.checked + '. Reservations are not shown. Treaty status does not by itself establish jurisdiction or responsibility: ICC jurisdiction can also depend on nationality, a Security Council referral or a declaration, and customary law can apply regardless.'));
    return g;
  };
  return {load, section};
})();
