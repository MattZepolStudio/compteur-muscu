// Données et règles pures : exercices, séances guidées, plan d'entraînement.
// Aucun accès au DOM ni au stockage ici.

/* ---------- Exercices avec caméra ---------- */
export const EXOS = {
  pompes: { met: 8, name: "Pompes", muscle: "Pecs · Triceps", icon: "arrow-down-up", unit: "pompes", joints: [[11,13,15],[12,14,16]], top: [11,12], bottom: [15,16], angUp: 160, angDown: 95, drop: 0.4, minRep: 300, minGap: 500,
    joint: "Coude", ready: "Bras tendus, ne bouge plus…", hidden: "Bras et épaules non visibles", push: "Pousse ⬆", deeper: "Descends plus bas",
    tip: "Pose le téléphone au sol à 1,5–2 m, <b>de profil</b> (idéal) ou <b>face à toi</b>. Épaules, coudes et mains doivent être visibles." },
  squats: { met: 5, load: "total", name: "Squats", muscle: "Quadris · Fessiers", icon: "person-standing", unit: "squats", joints: [[23,25,27],[24,26,28]], top: [23,24], bottom: [27,28], angUp: 160, angDown: 105, drop: 0.3, minRep: 500, minGap: 900,
    joint: "Genou", ready: "Debout, ne bouge plus…", hidden: "Jambes non visibles : recule un peu", push: "Remonte ⬆", deeper: "Descends plus bas",
    tip: "Pose le téléphone à 2–3 m, <b>de profil</b> (idéal) ou <b>face à toi</b>, à hauteur de taille si possible (sur une chaise, contre un mur). Tout ton corps, des épaules aux pieds, doit être visible." },
  curls: { short: "Plus haut", met: 3.5, load: "dumbbell", name: "Curls", muscle: "Biceps", icon: "dumbbell", unit: "curls", joints: [[11,13,15],[12,14,16]], top: [11,12], bottom: [15,16], angUp: 145, angDown: 65, drop: 0.6, minRep: 300, minGap: 600, perSide: true,
    joint: "Coude", ready: "Bras le long du corps, ne bouge plus…", hidden: "Bras non visibles : recule un peu", go: "Monte ⬆", push: "Redescends ⬇", deeper: "Monte plus haut",
    tip: "Pose le téléphone à 1,5–2 m, <b>face à toi</b> ou <b>de profil</b>, à hauteur de poitrine si possible. Le haut du corps, des épaules aux mains, doit être visible. Les curls alternés comptent un curl par bras." },
  militaire: { short: "Plus haut", met: 3.5, load: "total", name: "Militaire", muscle: "Épaules · Triceps", icon: "arrow-up-from-line", unit: "développés", joints: [[11,13,15],[12,14,16]], top: [11,12], bottom: [15,16], hips: [23,24], angUp: 90, angDown: 160, hMode: "rise", rise0: 0.15, rise1: 0.9, minRep: 400, minGap: 700, perSide: true,
    joint: "Coude", ready: "Mains aux épaules, ne bouge plus…", hidden: "Bras et hanches non visibles : recule un peu", go: "Pousse ⬆", push: "Redescends ⬇", deeper: "Tends complètement les bras",
    tip: "Développé militaire (haltères ou barre). Téléphone à 2 m, <b>face à toi</b>, à hauteur de poitrine. Le haut du corps jusqu'aux hanches et les mains bras tendus au-dessus de la tête doivent être visibles." },
  elevations: { short: "Plus haut", met: 3.5, load: "dumbbell", name: "Élévations", muscle: "Épaules", icon: "move-horizontal", unit: "élévations", joints: [[23,11,15],[24,12,16]], top: [11,12], bottom: [15,16], hips: [23,24], angUp: 25, angDown: 80, hMode: "rise", rise0: -0.85, rise1: -0.1, minRep: 400, minGap: 700, perSide: true,
    joint: "Épaule", ready: "Bras le long du corps, ne bouge plus…", hidden: "Bras et hanches non visibles : recule un peu", go: "Monte ⬆", push: "Redescends ⬇", deeper: "Monte jusqu'aux épaules",
    tip: "Élévations latérales. Téléphone à 2 m, <b>face à toi</b>, à hauteur de poitrine. Le haut du corps et les mains bras écartés doivent être visibles." },
  fentes: { met: 5, load: "total", name: "Fentes", muscle: "Quadris · Fessiers", icon: "footprints", unit: "fentes", joints: [[23,25,27],[24,26,28]], top: [23,24], bottom: [27,28], angUp: 160, angDown: 110, drop: 0.25, minRep: 500, minGap: 900, perSide: true,
    joint: "Genou", ready: "Debout, ne bouge plus…", hidden: "Jambes non visibles : recule un peu", push: "Remonte ⬆", deeper: "Descends plus bas",
    tip: "Téléphone à 2–3 m, <b>de profil</b>, à hauteur de taille. Tout le corps doit être visible. Chaque fente compte, jambe gauche ou droite." },
  dips: { met: 8, name: "Dips", muscle: "Triceps · Pecs", icon: "chevrons-down", unit: "dips", joints: [[11,13,15],[12,14,16]], top: [11,12], bottom: [15,16], angUp: 160, angDown: 95, drop: 0.35, minRep: 300, minGap: 600,
    joint: "Coude", ready: "Bras tendus, ne bouge plus…", hidden: "Bras et épaules non visibles", push: "Pousse ⬆", deeper: "Descends plus bas",
    tip: "Dips aux barres ou sur un banc. Téléphone à 2 m, <b>de profil</b>, à hauteur des barres ou du banc. Épaules, coudes et mains doivent être visibles." },
  planche: { met: 3.8, name: "Planche", muscle: "Abdos · Gainage", icon: "timer", unit: "secondes", timed: true,
    hidden: "Corps non visible : recule un peu",
    tip: "Gainage chronométré. Téléphone au sol à 2 m, <b>de profil</b>. Tout le corps, des épaules aux pieds, doit être visible. Le chrono n'avance que si ton corps est droit et à l'horizontale." }
};

/* ---------- Icônes (Lucide) ---------- */
export const ICONS = {"list":'<path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',"arrow-down-up": "<path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/>", "person-standing": "<circle cx=\"12\" cy=\"5\" r=\"1\"/><path d=\"m9 20 3-6 3 6\"/><path d=\"m6 8 6 2 6-2\"/><path d=\"M12 10v4\"/>", "dumbbell": "<path d=\"m6.5 6.5 11 11\"/><path d=\"m21 21-1-1\"/><path d=\"m3 3 1 1\"/><path d=\"m18 22 4-4\"/><path d=\"m2 6 4-4\"/><path d=\"m3 10 7-7\"/><path d=\"m14 21 7-7\"/>", "arrow-up-from-line": "<path d=\"m18 9-6-6-6 6\"/><path d=\"M12 3v14\"/><path d=\"M5 21h14\"/>", "move-horizontal": "<path d=\"m18 8 4 4-4 4\"/><path d=\"M2 12h20\"/><path d=\"m6 8-4 4 4 4\"/>", "footprints": "<path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\"/><path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\"/><path d=\"M16 17h4\"/><path d=\"M4 13h4\"/>", "chevrons-down": "<path d=\"m7 6 5 5 5-5\"/><path d=\"m7 13 5 5 5-5\"/>", "timer": "<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\"/><line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\"/><circle cx=\"12\" cy=\"14\" r=\"8\"/>"};
export const svgIc = (n, c = "ic") => `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || n}</svg>`;

/* ---------- Séances guidées (sans caméra) ---------- */
export const MOVES = {
  jj: ["Jumping jacks", "Écarte bras et jambes en rythme"], burpee: ["Burpees", "Accroupi, planche, saut, bras en l'air"],
  mc: ["Mountain climbers", "En planche, ramène les genoux vers la poitrine, vite"], ssaut: ["Squats sautés", "Descends, puis saute ; réception souple"],
  genoux: ["Montées de genoux", "Cours sur place, genoux à hauteur des hanches"], sq: ["Squats", "Pieds largeur d'épaules, dos droit"],
  pompes: ["Pompes", "Sur les genoux si besoin, corps gainé"], fentesA: ["Fentes alternées", "Grand pas, genou arrière vers le sol"],
  skater: ["Pas du patineur", "Bonds latéraux, comme un patineur"], talons: ["Talons-fesses", "Cours sur place, talons vers les fesses"],
  planche: ["Planche", "Sur les avant-bras, corps bien droit, abdos serrés"], plG: ["Planche latérale gauche", "Hanches hautes, corps aligné"],
  plD: ["Planche latérale droite", "Hanches hautes, corps aligné"], superman: ["Superman", "Allongé sur le ventre, lève bras et jambes"],
  hollow: ["Hollow hold", "Sur le dos, bas du dos plaqué au sol, jambes tendues"], crunch: ["Crunchs", "Enroule le haut du dos, sans tirer sur la nuque"],
  pont: ["Pont fessier", "Sur le dos, pousse les hanches vers le haut"], bird: ["Bird dog", "À quatre pattes, bras et jambe opposés tendus"],
  corde: ["Corde à sauter", "Petits sauts, poignets souples, sur l'avant du pied"],
  vite: ["Allure rapide", "Accélère : tu peux encore dire quelques mots"], lent: ["Récupération", "Trottine ou marche, respire calmement"],
  echauf: ["Échauffement", "Trottine tranquillement, augmente peu à peu"], retour: ["Retour au calme", "Ralentis progressivement"],
  ischios: ["Ischio-jambiers", "Jambe tendue, penche-toi doucement vers l'avant"], quadG: ["Quadriceps gauche", "Talon vers la fesse, genoux serrés"],
  quadD: ["Quadriceps droit", "Talon vers la fesse, genoux serrés"], fessG: ["Fessier gauche", "Sur le dos, cheville sur le genou opposé"],
  fessD: ["Fessier droit", "Sur le dos, cheville sur le genou opposé"], mollets: ["Mollets", "Mains au mur, talon arrière au sol"],
  pecs: ["Pectoraux", "Mains jointes dans le dos, ouvre la poitrine"], epG: ["Épaule gauche", "Bras tendu contre la poitrine"],
  epD: ["Épaule droite", "Bras tendu contre la poitrine"], chat: ["Chat-vache", "À quatre pattes, arrondis puis creuse le dos"],
  enfant: ["Posture de l'enfant", "Assis sur les talons, bras devant, relâche le dos"], cou: ["Nuque", "Penche doucement la tête de chaque côté"],
};
// params(lv) et build(p, lv) : lv = niveau 0 (débutant), 1, 2
export const GUIDED = {
  hiit: { name: "HIIT circuit", color: "#4ade80", met: 8, icon: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    desc: "Cardio intense : 5 exercices enchaînés, plusieurs tours.", params: lv => ({ rounds: [2, 3, 4][lv], work: [30, 40, 45][lv], rest: [30, 20, 15][lv] }),
    labels: { rounds: "Tours", work: "Effort (s)", rest: "Repos (s)" },
    build: (p, lv) => circuit(lv ? ["jj", "burpee", "mc", "ssaut", "genoux"] : ["jj", "sq", "genoux", "pompes", "talons"], p, 60) },
  tabata: { name: "Tabata", color: "#f97316", met: 8.5, icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    desc: "Le classique : 20 s à fond, 10 s de repos, 8 fois. 4 minutes qui comptent.", params: lv => ({ rounds: 8, work: 20, rest: 10 }),
    labels: { rounds: "Répétitions", work: "Effort (s)", rest: "Repos (s)" },
    build: (p, lv) => circuit(lv ? ["burpee", "mc"] : ["jj", "sq"], { ...p, rounds: 1, perMove: p.rounds }, 0) },
  gainage: { name: "Gainage", color: "#a78bfa", met: 3.8, icon: '<rect x="3" y="10" width="18" height="4" rx="2"/><path d="M7 14v4"/><path d="M17 14v4"/>',
    desc: "Abdos et dos : planches, superman, hollow. Idéal en fin de séance.", params: lv => ({ rounds: [2, 3, 3][lv], work: [20, 30, 45][lv], rest: [20, 15, 10][lv] }),
    labels: { rounds: "Tours", work: "Maintien (s)", rest: "Repos (s)" },
    build: (p, lv) => circuit(["planche", "plG", "plD", "superman", lv ? "hollow" : "pont", "bird"], p, 45) },
  etirements: { name: "Étirements", color: "#22d3ee", met: 2.3, icon: '<path d="M12 22c4-4 8-7.5 8-12a8 8 0 1 0-16 0c0 4.5 4 8 8 12z"/>',
    desc: "10 minutes de récupération, tout le corps. Respire, ne force jamais.", params: lv => ({ work: 30 }),
    labels: { work: "Maintien (s)" },
    build: (p, lv) => ["chat", "ischios", "quadG", "quadD", "fessG", "fessD", "mollets", "pecs", "epG", "epD", "cou", "enfant"].map((m, i, a) => ({ kind: "work", m, sec: p.work, i: i + 1, n: a.length })) },
  corde: { name: "Corde à sauter", color: "#fbbf24", met: 11, icon: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><circle cx="6" cy="3" r="1"/><circle cx="18" cy="3" r="1"/>',
    desc: "Intervalles de corde : excellent pour le cardio et la coordination.", params: lv => ({ rounds: [6, 8, 10][lv], work: [30, 60, 90][lv], rest: [30, 30, 30][lv] }),
    labels: { rounds: "Intervalles", work: "Sauts (s)", rest: "Repos (s)" },
    build: (p, lv) => circuit(["corde"], { ...p, perMove: p.rounds, rounds: 1 }, 0) },
  course: { name: "Course fractionnée", color: "#60a5fa", met: 9, icon: '<circle cx="13" cy="4" r="2"/><path d="m7 21 3-6 3 2 2 5"/><path d="M5 12l3-3 4 1 3 3 3 1"/>',
    desc: "Échauffement, alternance rapide / lent, retour au calme. Le coach te guide à la voix.", params: lv => ({ rounds: [5, 6, 8][lv], work: [60, 60, 90][lv], rest: [120, 90, 90][lv], warm: 300 }),
    labels: { rounds: "Fractions", work: "Rapide (s)", rest: "Lent (s)", warm: "Échauffement (s)" },
    build: (p, lv) => [{ kind: "work", m: "echauf", sec: p.warm, soft: 1 },
      ...Array.from({ length: p.rounds }, (_, i) => [{ kind: "work", m: "vite", sec: p.work, i: i + 1, n: p.rounds }, { kind: "rest", m: "lent", sec: p.rest, i: i + 1, n: p.rounds, active: 1 }]).flat(),
      { kind: "work", m: "retour", sec: p.warm, soft: 1 }] },
};
// circuit : chaque tour enchaîne les mouvements ; repos entre exercices et pause plus longue entre les tours
function circuit(moves, p, roundRest) {
  const out = [], per = p.perMove || 1;
  for (let r = 1; r <= p.rounds; r++) {
    moves.forEach((m, mi) => {
      for (let k = 1; k <= per; k++) {
        out.push({ kind: "work", m, sec: p.work, i: per > 1 ? k : mi + 1, n: per > 1 ? per : moves.length, r, rn: p.rounds });
        const last = r === p.rounds && mi === moves.length - 1 && k === per;
        if (!last) out.push({ kind: "rest", m: null, sec: (mi === moves.length - 1 && k === per && roundRest) ? Math.max(p.rest, roundRest) : p.rest, r, rn: p.rounds });
      }
    });
  }
  return out.filter(x => x.sec > 0);
}
export function guidedSteps(key, p, lv) { return [{ kind: "prep", m: null, sec: 10 }, ...GUIDED[key].build(p, lv)]; }
export const stepsDur = st => st.reduce((a, x) => a + x.sec, 0);

/* ---------- Profil et plan (repères ACSM) ---------- */
export const BASE = { pompes: [8, 15, 25], squats: [12, 20, 30], curls: [10, 12, 12], militaire: [8, 10, 12], elevations: [10, 12, 15], fentes: [8, 12, 16], dips: [6, 12, 20], planche: [20, 45, 75] };
export const LEVELS = [{ k: 1, n: "Débutant", d: "Je commence, ou je reprends après une longue pause" }, { k: 2, n: "Intermédiaire", d: "Je m'entraîne régulièrement depuis quelques mois" }, { k: 3, n: "Avancé", d: "Je m'entraîne intensément depuis plus d'un an" }];
export const GOALS = [{ k: "forme", n: "Garder la forme", d: "Bouger régulièrement et se sentir bien", i: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { k: "force", n: "Gagner en force", d: "Moins de répétitions, plus d'intensité", i: '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>' },
  { k: "endurance", n: "Endurance", d: "Plus de répétitions, pauses courtes", i: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>' },
  { k: "perte", n: "Perdre du poids", d: "Séances dynamiques, pauses courtes", i: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>' }];
export const lvlIcon = k => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${[0, 1, 2].map(i => `<rect x="${4 + i * 6}" y="${16 - i * 5}" width="4" height="${5 + i * 5}" rx="1" fill="${i < k ? "#4ade80" : "#ffffff30"}"/>`).join("")}</svg>`;
// Séries × répétitions conseillées selon le niveau et l'objectif.
// Repères ACSM : débutant 1–3 séries, plus de séries avec l'expérience ; endurance > 15 reps et pauses < 90 s ;
// force : moins de répétitions, plus de séries, pauses plus longues. Valeurs générales, à ajuster au ressenti.
export function planFor(exo, p) {
  const lvl = p?.level || 2, goal = p?.goal || "forme", X = EXOS[exo];
  let reps = (BASE[exo] || [10, 12, 15])[lvl - 1], sets = [2, 3, 3][lvl - 1], rest = [90, 75, 60][lvl - 1];
  if (goal === "force") { reps = X?.timed ? Math.round(reps * 1.2) : Math.max(4, Math.round(reps * 0.6)); sets += 1; rest = 150; }
  if (goal === "endurance") { reps = X?.timed ? Math.round(reps * 1.3) : Math.max(16, Math.round(reps * 1.3)); rest = 45; }
  if (goal === "perte") { reps = Math.round(reps * 1.2); rest = 60; }
  if (X?.timed) reps = Math.max(10, Math.round(reps / 5) * 5);
  return { sets, reps, rest };
}
// Fréquence recommandée : 2–3 séances/semaine débutant, 3–4 intermédiaire, 4–5 avancé
export const weeklySessionsFor = p => [2, 3, 4][(p?.level || 2) - 1];
export const levelIdx = p => (p?.level || 2) - 1;

// Le plan : séance(s) avec caméra construites pour tenir dans le temps choisi (grands groupes musculaires d'abord,
// séances A / B dès 3 séances par semaine), puis une séance par activité sans caméra choisie.
const ORDER = ["squats", "fentes", "pompes", "dips", "militaire", "curls", "elevations", "planche"];
export function buildPlan(p, loads = {}) {
  const out = [], ex = ORDER.filter(e => (p.exos || []).includes(e));
  if (ex.length) {
    const budget = (p.minutes || 30) * 60, rest = planFor(ex[0], p).rest;
    const split = (p.perWeek || 0) >= 3 && ex.length >= 4;
    const groups = split ? [ex.filter((_, i) => i % 2 === 0), ex.filter((_, i) => i % 2 === 1)] : [ex];
    const cost = b => b.sets * ((EXOS[b.exo].timed ? (b.reps || 30) : (b.reps || 12) * 2.5) + rest);
    const maxSets = [3, 4, 5][(p.level || 2) - 1] + (p.goal === "force" ? 1 : 0);
    groups.forEach((g, gi) => {
      const blocks = []; let t = 0;
      for (const e of g) {
        const pl = planFor(e, p), b = { exo: e, sets: pl.sets, reps: pl.reps, arms: "both", load: loads[e] || 0 };
        if (blocks.length && t + cost(b) > budget) { b.sets = Math.max(1, Math.floor((budget - t) / cost({ ...b, sets: 1 }))); if (b.sets < 2) continue; }
        blocks.push(b); t += cost(b);
      }
      let grew = true;            // séries ajoutées s'il reste du temps, sans dépasser les repères du niveau
      while (grew) { grew = false; for (const b of blocks) { const one = cost({ ...b, sets: 1 }); if (b.sets < maxSets && t + one <= budget) { b.sets++; t += one; grew = true; } } }
      out.push({ id: "plan-" + "AB"[gi], name: split ? `Séance ${"AB"[gi]} · ${groupName(g)}` : "Ma séance", rest, blocks, plan: true });
    });
  }
  for (const k of p.guided || []) if (GUIDED[k]) out.push({ id: "plan-g-" + k, name: GUIDED[k].name, rest: 60, blocks: [{ exo: "g:" + k }], plan: true });
  return out;
}
function groupName(g) {
  const up = ["pompes", "dips", "militaire", "curls", "elevations"], low = ["squats", "fentes"];
  const nUp = g.filter(e => up.includes(e)).length, nLow = g.filter(e => low.includes(e)).length;
  return nUp && !nLow ? "Haut du corps" : nLow && !nUp ? "Bas du corps" : "Corps entier";
}

/* ---------- Mise en forme ---------- */
export const fmtRest = sec => { const m = Math.floor(sec / 60), r = sec % 60; return m ? `${m} min${r ? " " + String(r).padStart(2, "0") : ""}` : `${r} s`; };
export const fmtDur = sec => { const m = Math.round(sec / 60); return m < 1 ? `${sec} s` : `${m} min`; };
export const fmtClock = ms => { const t = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(t / 60); return `${m}:${String(t % 60).padStart(2, "0")}`; };
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const isG = b => !!b?.exo?.startsWith("g:");
export const exoName = e => e?.startsWith("g:") ? (GUIDED[e.slice(2)]?.name || e) : EXOS[e]?.name || e;
export const EXO_COL = { pompes: "#4ade80", squats: "#22d3ee", curls: "#a78bfa", militaire: "#fbbf24", elevations: "#fb923c", fentes: "#f472b6", dips: "#60a5fa", planche: "#fde047" };
