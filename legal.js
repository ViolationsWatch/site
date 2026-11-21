// Civic-space cases (speech, protest, association, the press) are human rights cases even where the country is at war,
// unless the reports tie them to the fighting. Returns 'hr' (human rights law only), 'hr-first' (a killing in a contested
// or unclassified context with no sign of a link to hostilities) or null (use the country's conflict context as usual).
window.VWCivicMode = (types, killed, actorType, ctx) => {
    const SPEECH = ['Persecution & repression', 'Attacks on journalists'], CIVIC = [...SPEECH, 'Arbitrary detention & disappearance'];
    if (!types.some((t) => SPEECH.includes(t))) return null;
    if (types.includes('Air / drone / artillery strike') || actorType === 'non-state') return null; // signs of a link to the fighting
    const war = ctx === 'iac' || ctx === 'niac' || ctx === 'mixed';
    // detention by a party to an armed conflict can engage IHL (e.g. civilians held in occupied territory), so it keeps the war framing there
    if (!killed && types.every((t) => CIVIC.includes(t))) return war && types.includes('Arbitrary detention & disappearance') ? null : 'hr';
    if (killed && !war && types.every((t) => CIVIC.includes(t) || t === 'Killing of civilians')) return 'hr-first';
    return null;
};

// Indicative legal frameworks: the same lookup the project's private dashboard uses (week_legal).
// Input: incidents (types '; '-joined, category 'violation'), legal_types rows, legal_contexts rows.
window.VWLegal = (incidents, legalTypes, legalContexts) => {
    const T = new Map(legalTypes.map((r) => [r.type, r]));
    const C = new Map(legalContexts.map((r) => [r.location, r]));
    const CHILD = /child|children|school|student|minor|infant|baby|babies|girls|boys|newborn|kids/i;
    const uniq = (arr) => [...new Set(arr.flatMap((s) => String(s || '').split(';').map((x) => x.trim()).filter(Boolean)))];
    // name each instrument in full, then its rule or article numbers: "CIHL R1" -> "ICRC Customary IHL Study, Rule 1"
    const FULL = {CIHL: 'ICRC Customary IHL Study', 'GC I': 'Geneva Convention I (wounded and sick in the field, 1949)', 'GC II': 'Geneva Convention II (wounded, sick and shipwrecked at sea, 1949)',
      'GC III': 'Geneva Convention III (prisoners of war, 1949)', 'GC IV': 'Geneva Convention IV (civilians, 1949)', CA3: 'Common Article 3 of the four Geneva Conventions (1949)',
      'AP I': 'Additional Protocol I to the Geneva Conventions (international armed conflicts, 1977)', 'AP II': 'Additional Protocol II to the Geneva Conventions (non-international armed conflicts, 1977)',
      'Hague Regs': 'Hague Regulations (1907)', RS: 'Rome Statute of the International Criminal Court (1998)', ICCPR: 'International Covenant on Civil and Political Rights (ICCPR)',
      ICESCR: 'International Covenant on Economic, Social and Cultural Rights (ICESCR)', CAT: 'UN Convention against Torture (CAT)', CRC: 'UN Convention on the Rights of the Child (CRC)',
      'Refugee Convention': 'Refugee Convention (1951)', ACHPR: "African Charter on Human and Peoples' Rights", ACRWC: 'African Charter on the Rights and Welfare of the Child',
      'Maputo Protocol': 'Maputo Protocol (rights of women in Africa)', ECHR: 'European Convention on Human Rights (ECHR)', ACHR: 'American Convention on Human Rights',
      'San Salvador Protocol': 'Protocol of San Salvador (economic, social and cultural rights)', 'Arab Charter': 'Arab Charter on Human Rights (2004)'};
    const WHOLE = {CA3: FULL.CA3, 'CEDAW (GR 19, 30)': 'UN Convention on the Elimination of Discrimination against Women (CEDAW), General Recommendations 19 and 30',
      'ICCPR-OP2 (where ratified)': 'Second Optional Protocol to the ICCPR (abolition of the death penalty), where ratified', 'Istanbul Convention (where ratified)': 'Council of Europe Istanbul Convention, where ratified',
      'UNSC Res 2222 (2015)': 'UN Security Council Resolution 2222 (2015)', 'Genocide Convention II-III': 'Genocide Convention (1948), Arts II-III', 'ECHR P4-2': 'Protocol No. 4 to the European Convention on Human Rights, Art. 2',
      'ECHR P1-1': 'Protocol No. 1 to the European Convention on Human Rights, Art. 1', 'ECHR Protocols 6 and 13': 'Protocols No. 6 and 13 to the European Convention on Human Rights (death penalty)',
      'Hostages Convention': 'International Convention against the Taking of Hostages (1979)', ICPPED: 'International Convention for the Protection of All Persons from Enforced Disappearance',
      ICERD: 'International Convention on the Elimination of All Forms of Racial Discrimination (ICERD)', OPAC: 'Optional Protocol to the CRC on children in armed conflict',
      'Guiding Principles on Internal Displacement': 'UN Guiding Principles on Internal Displacement (1998)', 'Kampala Convention': 'African Union Kampala Convention on internally displaced persons (2009)',
      'Belém do Pará Convention': 'Inter-American Convention on violence against women (Belém do Pará)', 'Inter-American Convention against Torture': 'Inter-American Convention to Prevent and Punish Torture',
      'Inter-American Convention on Forced Disappearance': 'Inter-American Convention on Forced Disappearance of Persons'};
    const roman = {i:1,ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8,ix:9,x:10,xi:11,xii:12,xiii:13,xiv:14,xv:15,xvi:16,xvii:17,xviii:18,xix:19,xx:20,xxi:21,xxii:22,xxiii:23,xxiv:24,xxv:25,xxvi:26};
    const key = (a) => a.replace(/\(([ivx]+)\)/g, (m0, r) => '(' + String(roman[r] || 0).padStart(2, '0') + ')');
    // group by instrument ("Arab Charter 5" + "Arab Charter 5, 39" -> one entry); max limits the numbers shown
    const group = (refs, max) => { const m = new Map();
      for (const raw of refs) { if (WHOLE[raw]) { if (!m.has(raw)) m.set(raw, []); continue; }
        const ref = raw.replace(/^CA3\(/, 'CA3 ('); const tk = ref.split(' '); const i = tk.findIndex((t) => /^(\d|\(|R\d)/.test(t));
        const inst = i > 0 ? tk.slice(0, i).join(' ') : ref; const arts = i > 0 ? tk.slice(i).join(' ').split(/,\s*/) : [];
        if (!m.has(inst)) m.set(inst, []); const a = m.get(inst); arts.forEach((x) => { if (!a.includes(x)) a.push(x); }); }
      const ORD = ['CIHL', 'GC I', 'GC II', 'GC III', 'GC IV', 'CA3', 'AP I', 'AP II', 'Hague Regs'], rank = (k) => { const i = ORD.indexOf(k); return i < 0 ? 99 : i; };
      return [...m].sort((a, b) => rank(a[0]) - rank(b[0])).map(([inst, arts]) => {
        if (!arts.length) return WHOLE[inst] || FULL[inst] || inst;
        arts.sort((x, y) => key(x).localeCompare(key(y), 'en', {numeric: true}));
        const shown = max && arts.length > max ? arts.slice(0, max) : arts, many = arts.length > 1 || /-/.test(arts[0]);
        const unit = inst === 'CIHL' ? (many ? 'Rules ' : 'Rule ') : inst === 'CA3' ? (many ? 'paras ' : 'para. ') : (many ? 'Arts ' : 'Art. ');
        return (FULL[inst] || inst) + ', ' + unit + shown.map((x) => inst === 'CIHL' ? x.replace(/^R/, '') : x).join(', ') + (shown.length < arts.length ? ' …' : '');
      }); };
    // plain-language reasons for the frameworks, from the conflict context, the reported facts and each violation type
    const CTX = {iac: 'International armed conflict or occupation, so IHL applies through the four Geneva Conventions, Additional Protocol I (where ratified) and customary rules.',
      niac: 'Non-international armed conflict, so IHL applies through Common Article 3 of the Geneva Conventions, Additional Protocol II (where ratified and its threshold is met) and customary rules; the grave-breaches regime and Additional Protocol I do not apply.',
      mixed: 'Both international and non-international armed conflicts, so both sets of treaty rules are listed; which applies depends on the parties to this incident.',
      contested: 'Whether there is an armed conflict here is contested, so IHL and war-crimes provisions apply only if an armed conflict exists; human rights law applies either way.',
      unknown: 'Conflict classification not in the lookup, so IHL is listed only in case there is an armed conflict; human rights law applies either way.',
      none: 'No known armed conflict, so IHL and war crimes do not apply and human rights law governs.'};
    const HR = 'This is a case about speech, protest, association or the press, and nothing in the reports links it to the hostilities, so human rights law governs and the laws of war are not engaged.';
    const HR_FIRST = 'Nothing in the reports links this killing to the hostilities, so human rights law comes first: the state must protect people and investigate. IHL would apply only if the act is linked to an armed conflict.';
    // human-rights-only reasons for the civic types, used instead of the IHL-oriented ones when mode is 'hr'
    const HR_WHY = {'Persecution & repression': 'Repression of speech, protest, association or a group was reported. This engages freedom of expression, assembly and association and non-discrimination (ICCPR, Arts 2, 19, 21, 22 and 26) and, where widespread or systematic, the crime against humanity of persecution (Rome Statute, Art. 7(1)(h)).',
      'Attacks on journalists': 'A journalist was reportedly targeted for their work. Human rights law protects freedom of expression and of the press (ICCPR, Art. 19) and, where a journalist is harmed, the right to life and security; the state must protect journalists and investigate (UN Security Council Resolution 2222 (2015)).',
      'Arbitrary detention & disappearance': 'Detention without due process or an enforced disappearance was reported, engaging the right to liberty and to a fair trial (ICCPR, Arts 9 and 14) and the Convention on Enforced Disappearance.'};
    const pick = (t, ctx) => String(t || '').replace(/\[iac: ([^|\]]*)\|niac: ([^\]]*)\]/g, (m0, a, b) => ctx === 'iac' ? a : (ctx === 'niac' || ctx === 'contested') ? b : a + '; or in a non-international conflict ' + b.replace(/^; /, ''));
    const why = (r, rows, c, mode) => {
      const s = [];
      const cx = CTX[c.context] || CTX.unknown;
      if (mode === 'hr') s.push(r.location + ': ' + (c.note ? c.note.replace(/\.$/, '') + '. ' : '') + HR);
      else s.push(r.location + ': ' + (c.note ? c.note.replace(/\.$/, '') + '. ' + cx.replace(/^[^,]*, so /, 'So ') : cx) + (mode === 'hr-first' ? ' ' + HR_FIRST : ''));
      const k = r.killed_min != null ? (r.killed_max != null && r.killed_max !== r.killed_min ? r.killed_min + '-' + r.killed_max : String(r.killed_min)) : null;
      const vic = Array.isArray(r.victims) ? r.victims.join(', ') : r.victims;
      const fact = [r.perpetrator && 'alleged perpetrator ' + r.perpetrator, vic && 'victims ' + vic, k && k + ' killed'].filter(Boolean);
      if (fact.length) s.push('Reported: ' + fact.join('; ') + '.');
      rows.forEach((x) => { const w = mode === 'hr' && HR_WHY[x.type] ? HR_WHY[x.type] : x.why; if (w) s.push(pick(w, c.context)); });
      const p = r.perpetrator ? 'The alleged perpetrator, ' + String(r.perpetrator).replace(/\.$/, '') + ',' : null;
      if (r.actor_type === 'state') s.push((p || 'The alleged perpetrator') + ' is a state actor, so that state’s human rights treaty obligations apply directly' + (mode === 'hr' ? '.' : ', alongside IHL where there is an armed conflict.'));
      else if (r.actor_type === 'non-state') s.push((p || 'The alleged perpetrator') + ' is a non-state actor: armed groups are bound by ' + (c.context === 'niac' || c.context === 'contested' ? 'Common Article 3 and customary IHL' : 'customary IHL') + ', while human rights treaties bind the state, which must protect people and investigate.');
      else if (r.category === 'violation' && 'actor_type' in r) s.push('The perpetrator is not identified, which matters for attribution and for whether IHL governs the act.');
      if (c.context !== 'none' && mode !== 'hr') s.push('The Rome Statute provisions indicate which international crimes the facts could amount to; ICC jurisdiction depends on the state concerned.');
      const cav = r.counterclaim || r.contested;
      if (cav) s.push('Caveat recorded: ' + String(cav).replace(/\.$/, '') + '. The reasoning depends on the reported facts being accurate.');
      if (r.cumulative) s.push('This is an aggregate or period report, so the frameworks describe the pattern rather than a single act.');
      return s.join(' ');
    };
    const SYS = {africa: 'africa', europe: 'europe', americas: 'americas', arab: 'arab'};
    return incidents.filter((r) => r.category === 'violation').map((r) => {
      const ts = String(r.types || '').split('; ').filter(Boolean);
      if (CHILD.test(r.headline)) ts.push('Children involved');
      const rows = ts.map((t) => T.get(t)).filter(Boolean);
      const c = C.get(r.location) || {context: 'unknown', system: 'none', note: 'Location not in the lookup: check context'};
      const mode = window.VWCivicMode(ts.filter((t) => t !== 'Children involved'), r.killed_min > 0 || r.killed_max > 0, r.actor_type, c.context);
      const cihl = group(uniq(rows.map((x) => x.cihl))), iac = uniq(rows.map((x) => x.iac)), niac = uniq(rows.map((x) => x.niac));
      const tRefs = c.context === 'iac' ? iac : (c.context === 'niac' || c.context === 'contested') ? niac : c.context === 'none' ? [] : [...iac, ...niac]; // contested = whether a NIAC exists
      const treaty = group(tRefs);
      const ihlOn = c.context !== 'none' && mode !== 'hr';
      const cond = mode === 'hr-first' ? ' (only if the act is linked to an armed conflict)' : c.context === 'contested' || c.context === 'unknown' ? ' (if armed conflict)' : '';
      const ihrl = group(uniq(rows.map((x) => x.ihrl)));
      const icl = group(uniq(rows.map((x) => x.icl)).filter((x) => ihlOn || !/^RS 8/.test(x))); // no war crimes without an armed conflict
      let regional = SYS[c.system] ? group(uniq(rows.map((x) => x[SYS[c.system]]))) : [];
      if (c.system === 'americas-decl') regional = ['American Declaration of the Rights and Duties of Man (via IACHR)'];
      if (c.system === 'asean') regional = ['ASEAN Human Rights Declaration (non-binding)'];
      if (c.system === 'europe-lapsed') regional = ['European Convention on Human Rights (ECHR), only for acts before 16 Sep 2022'];
      const short = (a, n) => a.slice(0, n).join('; ') + (a.length > n ? ' …' : '');
      return {
        id: r.id, context: c.context, context_note: c.note || '', why: why(r, rows, c, mode), civic_mode: mode,
        ihl_short: ihlOn ? [group(uniq(rows.map((x) => x.cihl)), 4)[0], group(tRefs, 4)[0]].filter(Boolean).join('; ') + cond : mode === 'hr' ? 'Not engaged (not linked to the hostilities)' : 'Not applicable (no armed conflict known)',
        ihrl_short: short(ihrl, 2) || '—',
        regional_short: regional.length ? short(regional, 2) : 'No binding regional treaty',
        ihl: ihlOn ? [...cihl, ...treaty].join('; ') + cond : '', icl: icl.join('; '), ihrl: ihrl.join('; '), regional: regional.join('; ') || 'No binding regional treaty'
      };
    });
  };

// Plain-language view of the legal panel: a one-line summary and the rules involved up front,
// with the full analysis folded away. Built only from the incident's types and its conflict context.
window.VWLegalView = (() => {
  const RULES = {
    distinction: ['Distinction', 'Forces must tell civilians apart from fighters, and may only attack fighters and military targets.'],
    proportionality: ['Proportionality', 'An attack is unlawful if the expected harm to civilians is excessive compared with the military advantage expected.'],
    precautions: ['Precautions in attack', 'Forces must take all feasible steps to avoid or minimise harm to civilians, such as checking targets and giving warnings.'],
    life: ['Right to life', 'No one may be arbitrarily killed, and states must investigate unlawful killings.'],
    medical: ['Protection of medical and aid work', 'Hospitals, medical staff, patients and aid workers must be respected and protected.'],
    torture: ['Ban on torture', 'Torture and cruel or degrading treatment are forbidden in all circumstances, with no exceptions.'],
    sexual: ['Ban on sexual violence', 'Rape and other sexual violence are forbidden in all circumstances, and can be war crimes or crimes against humanity.'],
    trial: ['Fair trial', 'No one may be punished or executed without a fair trial by an independent court.'],
    liberty: ['Right to liberty', 'No one may be detained arbitrarily; detainees must be able to challenge their detention before a judge.'],
    hostages: ['Ban on hostage-taking', 'Taking hostages and abducting civilians are forbidden.'],
    starvation: ['Ban on starving civilians', 'Starving civilians is forbidden, and aid for civilians in need must be allowed through.'],
    journalists: ['Protection of journalists', 'Journalists are civilians, and states must protect them and their freedom to report.'],
    expression: ['Free expression and assembly', 'People have the right to speak, report, protest and organise peacefully.'],
    displacement: ['Ban on forced displacement', 'Civilians must not be forcibly moved from their homes except, temporarily, for their own safety.'],
    property: ['Protection of civilian property', 'Homes and other civilian property must not be attacked or destroyed without military necessity.'],
    atrocity: ['Genocide and crimes against humanity', 'Mass killings aimed at a group, or widespread attacks on civilians, are among the gravest international crimes.'],
    children: ['Special protection of children', 'Children are entitled to special protection, including from recruitment and attacks on schools.']
  };
  // per type: rules for an armed conflict, rules otherwise, and the plain clause for each
  const TYPE = {
    'Air / drone / artillery strike': [['distinction', 'proportionality', 'precautions'], ['life'], 'civilians must not be targeted, and attacks must not cause excessive harm to them', 'force must not be used against people unless strictly necessary to protect life'],
    'Killing of civilians': [['distinction', 'life'], ['life'], 'civilians must not be targeted or deliberately killed', 'no one may be arbitrarily killed, and killings must be investigated'],
    'Attacks on healthcare & aid': [['medical', 'distinction'], ['medical', 'life'], 'hospitals, medical staff and aid workers must be protected', 'health workers and patients must be protected'],
    'Mass atrocity / genocide': [['atrocity', 'distinction'], ['atrocity', 'life'], 'the gravest crimes against civilians are forbidden absolutely', 'the gravest crimes against civilians are forbidden absolutely'],
    'Sexual & gender-based violence': [['sexual'], ['sexual'], 'sexual violence is forbidden in all circumstances', 'sexual violence is forbidden in all circumstances'],
    'Torture & ill-treatment': [['torture'], ['torture'], 'no one may be tortured or ill-treated', 'no one may be tortured or ill-treated'],
    'Executions': [['trial', 'life'], ['trial', 'life'], 'no one may be executed without a fair trial', 'no one may be executed without a fair trial'],
    'Abduction & hostage-taking': [['hostages', 'liberty'], ['liberty'], 'taking hostages and abducting civilians are forbidden', 'no one may be abducted or detained arbitrarily'],
    'Starvation & siege': [['starvation'], ['starvation'], 'starving civilians is forbidden and aid must be let through', 'people must not be deprived of food and aid'],
    'Attacks on journalists': [['journalists', 'distinction'], ['journalists', 'expression'], 'journalists are civilians and must be protected', 'journalists must be protected and free to report'],
    'Arbitrary detention & disappearance': [['liberty'], ['liberty'], 'people must not be detained arbitrarily or made to disappear', 'people must not be detained arbitrarily or made to disappear'],
    'Forced displacement': [['displacement'], ['displacement'], 'civilians must not be forced from their homes', 'people must not be forced from their homes'],
    'Destruction of property': [['property'], ['property'], 'civilian homes and property must be protected', 'homes and property must not be destroyed arbitrarily'],
    'Persecution & repression': [['expression'], ['expression'], 'people may not be persecuted for who they are or what they say', 'people have the right to speak, protest and organise peacefully']
  };
  const node = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  return (r, L) => {
    const types = (r.types || []).filter((t) => TYPE[t]), ctx = L.code || 'unknown';
    const k0 = r.killed || [], mode = window.VWCivicMode ? window.VWCivicMode(types, k0[0] > 0 || k0[1] > 0, r.actor_type, ctx) : null;
    // a civic-space case not linked to the fighting is read as a human rights case, whatever the country's conflict context
    const war = !mode && (ctx === 'iac' || ctx === 'niac' || ctx === 'mixed'), maybe = !mode && (ctx === 'contested' || ctx === 'unknown');
    const keys = [], clauses = [];
    const ORDER = ['Mass atrocity / genocide', 'Sexual & gender-based violence', 'Executions', 'Torture & ill-treatment', 'Air / drone / artillery strike', 'Killing of civilians', 'Attacks on healthcare & aid', 'Attacks on journalists', 'Abduction & hostage-taking', 'Arbitrary detention & disappearance', 'Starvation & siege', 'Persecution & repression', 'Forced displacement', 'Destruction of property'];
    const strike = types.includes('Air / drone / artillery strike');
    ORDER.filter((t) => types.includes(t)).forEach((t) => { const [w, p, cw, cp] = TYPE[t]; (war || maybe ? w : p).forEach((k) => { if (!keys.includes(k)) keys.push(k); });
      if (strike && t === 'Killing of civilians') return; // the strike clause already covers it
      const c = war ? cw : cp; if (!clauses.includes(c)) clauses.push(c); });
    if ((r.grave_violations || []).length || r.children) keys.push('children');
    if (war && !keys.includes('life') && keys.length < 4) keys.push('life');
    const civic = types.length && types.every((t) => ['Arbitrary detention & disappearance', 'Persecution & repression', 'Attacks on journalists'].includes(t)) && !((r.killed || [])[1] > 0 || (r.killed || [])[0] > 0);
    const law = mode === 'hr-first' ? 'human rights law and, only if the act is linked to an armed conflict, the laws of war' : civic && !war ? 'human rights law' : war ? 'the laws of war and human rights law' : maybe ? 'human rights law and, if there is an armed conflict, the laws of war' : 'human rights law';
    const g = node('div', 'legal');
    g.append(node('div', 'sub', 'What the law says (not a legal finding)'));
    g.append(node('p', 'plain', 'If the reports are accurate, this could breach ' + law + (clauses.length ? ': ' + clauses.slice(0, 2).join('; ') + '.' : '.')));
    if (keys.length) {
      const row = node('div', 'rules'), tip = node('p', 'rule-tip'); tip.hidden = true; let on = null;
      keys.slice(0, 5).forEach((k) => { const [name, text] = RULES[k]; const b = node('button', 'rule', name); b.type = 'button'; b.setAttribute('aria-expanded', 'false');
        b.onclick = () => { const open = on !== b; if (on) on.setAttribute('aria-expanded', 'false'); on = open ? b : null; tip.hidden = !open; tip.textContent = open ? name + ': ' + text : ''; b.setAttribute('aria-expanded', String(open)); };
        row.append(b); });
      g.append(row, tip);
    }
    const d = node('details', 'legal-more'); d.append(node('summary', null, 'Full legal analysis'));
    [['International humanitarian law (IHL)', L.ihl || (mode === 'hr' ? 'Not engaged: nothing in the reports links this to the hostilities, so human rights law governs' : 'Not applicable (no armed conflict known)')], ['International criminal law', L.icl], ['International human rights law', L.ihrl], ['Regional human rights law', L.regional]].forEach(([a, v]) => {
      if (!v) return; const x = node('div'); x.append(node('b', null, a)); const u = node('ul', 'refs'); String(v).split('; ').forEach((s) => u.append(node('li', null, s))); x.append(u); d.append(x); });
    if (L.why) { const x = node('div', 'why'); x.append(node('b', null, 'Why these frameworks')); x.append(node('p', null, L.why)); d.append(x); } else if (L.context) d.append(node('div', 'sub', L.context));
    g.append(d);
    return g;
  };
})();
