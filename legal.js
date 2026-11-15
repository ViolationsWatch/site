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
    const pick = (t, ctx) => String(t || '').replace(/\[iac: ([^|\]]*)\|niac: ([^\]]*)\]/g, (m0, a, b) => ctx === 'iac' ? a : (ctx === 'niac' || ctx === 'contested') ? b : a + '; or in a non-international conflict ' + b.replace(/^; /, ''));
    const why = (r, rows, c) => {
      const s = [];
      const cx = CTX[c.context] || CTX.unknown;
      s.push(r.location + ': ' + (c.note ? c.note.replace(/\.$/, '') + '. ' + cx.replace(/^[^,]*, so /, 'So ') : cx));
      const k = r.killed_min != null ? (r.killed_max != null && r.killed_max !== r.killed_min ? r.killed_min + '-' + r.killed_max : String(r.killed_min)) : null;
      const vic = Array.isArray(r.victims) ? r.victims.join(', ') : r.victims;
      const fact = [r.perpetrator && 'alleged perpetrator ' + r.perpetrator, vic && 'victims ' + vic, k && k + ' killed'].filter(Boolean);
      if (fact.length) s.push('Reported: ' + fact.join('; ') + '.');
      rows.forEach((x) => { if (x.why) s.push(pick(x.why, c.context)); });
      const p = r.perpetrator ? 'The alleged perpetrator (' + r.perpetrator + ')' : null;
      if (r.actor_type === 'state') s.push((p || 'The alleged perpetrator') + ' is a state actor, so that state’s human rights treaty obligations apply directly, alongside IHL where there is an armed conflict.');
      else if (r.actor_type === 'non-state') s.push((p || 'The alleged perpetrator') + ' is a non-state actor: armed groups are bound by ' + (c.context === 'niac' || c.context === 'contested' ? 'Common Article 3 and customary IHL' : 'customary IHL') + ', while human rights treaties bind the state, which must protect people and investigate.');
      else if (r.category === 'violation' && 'actor_type' in r) s.push('The perpetrator is not identified, which matters for attribution and for whether IHL governs the act.');
      if (c.context !== 'none') s.push('The Rome Statute provisions indicate which international crimes the facts could amount to; ICC jurisdiction depends on the state concerned.');
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
      const cihl = group(uniq(rows.map((x) => x.cihl))), iac = uniq(rows.map((x) => x.iac)), niac = uniq(rows.map((x) => x.niac));
      const tRefs = c.context === 'iac' ? iac : (c.context === 'niac' || c.context === 'contested') ? niac : c.context === 'none' ? [] : [...iac, ...niac]; // contested = whether a NIAC exists
      const treaty = group(tRefs);
      const ihlOn = c.context !== 'none';
      const cond = c.context === 'contested' || c.context === 'unknown' ? ' (if armed conflict)' : '';
      const ihrl = group(uniq(rows.map((x) => x.ihrl)));
      const icl = group(uniq(rows.map((x) => x.icl)).filter((x) => ihlOn || !/^RS 8/.test(x))); // no war crimes without an armed conflict
      let regional = SYS[c.system] ? group(uniq(rows.map((x) => x[SYS[c.system]]))) : [];
      if (c.system === 'americas-decl') regional = ['American Declaration of the Rights and Duties of Man (via IACHR)'];
      if (c.system === 'asean') regional = ['ASEAN Human Rights Declaration (non-binding)'];
      if (c.system === 'europe-lapsed') regional = ['European Convention on Human Rights (ECHR), only for acts before 16 Sep 2022'];
      const short = (a, n) => a.slice(0, n).join('; ') + (a.length > n ? ' …' : '');
      return {
        id: r.id, context: c.context, context_note: c.note || '', why: why(r, rows, c),
        ihl_short: ihlOn ? [group(uniq(rows.map((x) => x.cihl)), 4)[0], group(tRefs, 4)[0]].filter(Boolean).join('; ') + cond : 'Not applicable (no armed conflict known)',
        ihrl_short: short(ihrl, 2) || '—',
        regional_short: regional.length ? short(regional, 2) : 'No binding regional treaty',
        ihl: ihlOn ? [...cihl, ...treaty].join('; ') + cond : '', icl: icl.join('; '), ihrl: ihrl.join('; '), regional: regional.join('; ') || 'No binding regional treaty'
      };
    });
  };
