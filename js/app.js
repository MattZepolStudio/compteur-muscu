// Interface : 4 onglets (Accueil, Séances, Progrès, Profil), éditeur de séance, résumé, profil.
import { EXOS, GUIDED, LEVELS, GOALS, lvlIcon, svgIc, planFor, buildPlan, weeklySessionsFor, guidedSteps, stepsDur,
  fmtRest, fmtDur, fmtClock, esc, isG, exoName, EXO_COL } from "./data.js";
import { cfg, save, weight, lv, applyProfile, newId, planSeances, mySeances, blockFor, remember, guidedParams, guidedSec,
  seanceMinutes, usesCamera, usesGuided, loadSessions, saveSessions, computeRecords, sessReps, weekSessions, weekDays, streakOf,
  weekGoal, todaySeance } from "./store.js";
import { $, show, openSheet, closeSheet, confirmBtn, say, releaseWake } from "./device.js";
import { runCamera } from "./camera.js";
import { runGuided } from "./guided.js";

const VERSION = "Version 19.0 · 17 nov.";
const ic = d => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  play: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><polygon points="7 4 20 12 7 20" fill="currentColor"/></svg>',
  chev: ic('<path d="m9 18 6-6-6-6"/>'), list: ic('<path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'),
  cam: ic('<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/>'), voice: ic('<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>'),
  x: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'), up: ic('<path d="m18 15-6-6-6 6"/>'), down: ic('<path d="m6 9 6 6 6-6"/>'),
  minus: ic('<path d="M5 12h14"/>'), plus: ic('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  fire: ic('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
  trophy: ic('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
  kg: ic('<circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z"/>'),
  target: ic('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
};
const gIcon = (k, cls = "exo-ic") => `<span class="${cls}" style="background:${GUIDED[k].color};color:#052e16">${ic(GUIDED[k].icon)}</span>`;
const plural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

/* ===================== Navigation ===================== */
function goTo(id) {
  if (id === "home") renderHome();
  if (id === "seances") renderSeances();
  if (id === "progres") renderProgres();
  if (id === "profil") renderProfil();
  show(id); document.querySelector(`#${id} .page`)?.scrollTo(0, 0);
}
document.querySelectorAll("#tabbar [data-tab]").forEach(b => b.onclick = () => goTo(b.dataset.tab));

/* ===================== Lancer une séance ===================== */
// Une séance est une liste d'étapes : les exercices caméra consécutifs forment un seul passage,
// chaque séance guidée en est un autre. Le résumé final regroupe tout.
let RUN = null;
function startSeance(s) {
  if (!s?.blocks?.length) return;
  const segs = [];
  for (const b of s.blocks) {
    if (isG(b)) segs.push({ type: "g", key: b.exo.slice(2), p: guidedParams(b.exo.slice(2), b.p) });
    else {
      const blk = { ...b, rest: s.rest || 60 }, last = segs[segs.length - 1];
      remember(b);
      if (last?.type === "cam") last.blocks.push(blk); else segs.push({ type: "cam", blocks: [blk] });
    }
  }
  save();
  const S = loadSessions();
  RUN = { id: Date.now(), sid: s.id || null, name: s.name || exoName(s.blocks[0].exo), start: Date.now(), parts: [], queue: segs, recs0: computeRecords(S), recs: computeRecords(S) };
  closeSheet("edit");
  nextSegment();
}
function nextSegment() {
  const seg = RUN.queue.shift();
  if (seg.type === "cam") runCamera(seg.blocks, { recs: RUN.recs }, r => endPart(camPart(r), r.stopped));
  else runGuided(seg.key, seg.p, r => endPart(guidedPart(r), r.stopped));
}
$("loadBack").onclick = () => { RUN = null; releaseWake(); goTo("home"); };
function endPart(part, stopped) {
  if (part.session) { const S = loadSessions(); S.push(part.session); saveSessions(S); }
  RUN.parts.push(part);
  if (!stopped && RUN.queue.length) {
    const seg = RUN.queue[0];
    setTimeout(() => say(`Étape suivante : ${seg.type === "g" ? GUIDED[seg.key].name : exoName(seg.blocks[0].exo)}`), 1200);
    setTimeout(nextSegment, 2500);
    return;
  }
  renderDone();
}
// Calories ≈ MET × poids (kg) × heures d'effort, + récupération à 1,5 MET
function kcalOf(sets, durMs, w) {
  if (!w) return 0;
  const act = sets.reduce((a, x) => a + (x.sec || 0), 0), rest = Math.max(0, durMs / 1000 - act);
  return Math.round(sets.reduce((a, x) => a + (EXOS[x.exo]?.met || 4) * w * (x.sec || 0) / 3600, 0) + 1.5 * w * rest / 3600);
}
function camPart(r) {
  const H = r.history, kcal = kcalOf(H, r.dur, weight()), ton = H.reduce((a, h) => a + (h.ton || 0), 0);
  const cnt = {}, multi = new Set(H.map(h => h.exo)).size > 1;
  const html = H.map(h => {
    cnt[h.exo] = (cnt[h.exo] || 0) + 1;
    const pct = h.target ? Math.min(100, h.n / h.target * 100) : 100, over = h.target && h.n > h.target;
    return `<div class="setbar"><span>${multi ? exoName(h.exo) + " " : "Série "}${cnt[h.exo]}</span><div class="bar"><i class="${over ? "over" : ""}" style="width:${pct}%"></i></div><b>${h.n}${EXOS[h.exo]?.timed ? " s" : ""}${h.target ? `<small>/${h.target}</small>` : ""}</b></div>`;
  }).join("");
  const sets = H.map(h => ({ exo: h.exo, n: h.n, best: h.best, sec: h.sec, kg: h.kg, ton: h.ton, txt: h.txt }));
  return {
    kind: "cam", title: [...new Set(H.map(h => exoName(h.exo)))].join(" + ") || "Séance", html, kcal, ton, dur: r.activeMs, history: H,
    reps: H.filter(h => !EXOS[h.exo]?.timed).reduce((a, h) => a + h.n, 0), timed: H.filter(h => EXOS[h.exo]?.timed).reduce((a, h) => a + h.n, 0),
    session: H.some(h => h.n > 0) ? { run: RUN.id, sid: RUN.sid, name: RUN.name, t: r.start, dur: r.dur, kcal, ton, sets } : null
  };
}
function guidedPart(r) {
  const Gd = GUIDED[r.key], w = weight();
  const kcal = w ? Math.round(Gd.met * w * (r.workSec / 3600) + 1.5 * w * Math.max(0, r.dur / 1000 - r.workSec) / 3600) : 0;
  return {
    kind: "g", title: Gd.name, kcal, ton: 0, dur: r.dur, work: r.workSec, reps: 0, timed: 0, history: [],
    html: `<div class="setbar"><span>Exercices</span><div class="bar"><i style="width:${r.works ? r.doneWorks / r.works * 100 : 0}%"></i></div><b>${r.doneWorks}<small>/${r.works}</small></b></div>`,
    session: r.workSec > 5 ? { run: RUN.id, sid: RUN.sid, name: RUN.name, t: r.start, dur: r.dur, kcal, guided: { key: r.key, name: Gd.name, work: r.workSec }, sets: [] } : null
  };
}

/* ===================== Résumé ===================== */
let lastRun = null, lastShare = null;
function renderDone() {
  const R = RUN; RUN = null; lastRun = R;
  const P = R.parts, H = P.flatMap(p => p.history);
  const reps = P.reduce((a, p) => a + p.reps, 0), timed = P.reduce((a, p) => a + p.timed, 0), work = P.reduce((a, p) => a + (p.work || 0), 0);
  const kcal = P.reduce((a, p) => a + p.kcal, 0), ton = P.reduce((a, p) => a + p.ton, 0), dur = P.reduce((a, p) => a + p.dur, 0);
  const repExos = [...new Set(H.filter(h => !EXOS[h.exo]?.timed).map(h => h.exo))];
  let total, lab;
  if (reps) { total = reps; lab = repExos.length === 1 ? EXOS[repExos[0]].unit : "Répétitions"; }
  else if (timed) { total = timed; lab = "Secondes"; }
  else { total = fmtClock(work * 1000); lab = "Effort"; }
  const d = new Date(R.start), hh = d.getHours();
  $("doneDate").textContent = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + (hh < 12 ? " · matin" : hh < 18 ? " · après-midi" : " · soir");
  $("doneTitle").textContent = R.name;
  $("statTotal").textContent = total; $("statLab").textContent = lab;
  $("statTime").textContent = fmtClock(dur);
  $("statKcal").textContent = weight() ? "≈" + kcal : "—";
  $("kcalHint").textContent = weight() ? "" : "Indique ton poids dans Profil pour estimer les calories.";
  // records battus pendant la séance
  const best = {}; for (const h of H) best[h.exo] = Math.max(best[h.exo] || 0, h.best);
  $("doneRecs").innerHTML = Object.entries(best).filter(([e, b]) => b > 0 && b > (R.recs0[e] || 0)).map(([e, b]) => `<span>${IC.trophy}Record ${exoName(e)} : ${b}${EXOS[e]?.timed ? " s" : ""}</span>`).join("");
  const S = loadSessions(), st = streakOf(S), wk = weekSessions(S), g = weekGoal();
  $("doneBadges").innerHTML = (ton ? `<span class="acc">${IC.kg}Tonnage <b>${ton.toLocaleString("fr-FR")} kg</b></span>` : "") + (st ? `<span>${IC.fire}${plural(st, "jour")} d'affilée</span>` : "") +
    (g ? `<span>${IC.target}Semaine : ${wk} / ${g}${wk >= g ? " ✓" : ""}</span>` : "");
  $("summary").innerHTML = P.length > 1 ? P.map(p => `<div class="sum-k">${esc(p.title)}</div>${p.html}`).join("") : (P[0]?.html || "") || '<p class="mut">Aucune série enregistrée.</p>';
  document.querySelectorAll("#rpe button").forEach(b => b.classList.remove("on")); $("progTip").hidden = true;
  $("deleteBtn").hidden = !P.some(p => p.session);
  lastShare = { kcal: weight() ? kcal : 0, ton, date: d, total: reps || timed || Math.max(1, Math.round(work / 60)), unit: reps ? (repExos.length === 1 ? EXOS[repExos[0]].unit : "répétitions") : timed ? "secondes" : "minutes d'effort", mins: Math.max(1, Math.round(dur / 60000)), sets: H.length || P.length, history: H, streak: st };
  say(reps ? `Bravo ! ${reps} ${lab.toLowerCase()} au total` : "Bravo !", false);
  show("done"); document.querySelector("#done .page").scrollTo(0, 0);
}
const runSessions = (S, id) => S.filter(s => s.run === id);
document.querySelectorAll("#rpe button").forEach(b => b.onclick = () => {
  if (!lastRun) return;
  document.querySelectorAll("#rpe button").forEach(x => x.classList.toggle("on", x === b));
  const S = loadSessions(); runSessions(S, lastRun.id).forEach(s => s.rpe = +b.dataset.r); saveSessions(S);
  suggestProgression(+b.dataset.r);
});
// Progression : « Facile » deux séances de suite pour un exercice → on propose un peu plus.
// « À bloc » deux fois de suite → on conseille de garder le même objectif.
function nextStep(b) {
  const X = EXOS[b.exo];
  if (X.load && b.load) { const n = b.load + (b.load >= 20 ? 2 : 1); return { ...b, load: n, what: `${X.load === "dumbbell" ? "Haltère" : "Charge"} ${b.load} → ${n} kg` }; }
  if (X.timed) return { ...b, reps: (b.reps || 30) + 5, what: `${b.reps || 30} → ${(b.reps || 30) + 5} s` };
  if (!b.reps) return null;
  return { ...b, reps: b.reps + 2, what: `${b.sets} × ${b.reps} → ${b.sets} × ${b.reps + 2}` };
}
function suggestProgression(rpe) {
  const tip = $("progTip"), S = loadSessions(), mine = runSessions(S, lastRun.id);
  tip.hidden = true;
  const exos = [...new Set(mine.flatMap(s => s.sets.map(x => x.exo)))];
  const prevRpe = e => { for (let i = S.length - 1; i >= 0; i--) if (S[i].run !== lastRun.id && S[i].sets.some(x => x.exo === e)) return S[i].rpe; return null; };
  const seance = cfg.seances.find(s => s.id === lastRun.sid);
  if (rpe === 1) {
    const ups = exos.filter(e => prevRpe(e) === 1).map(e => nextStep(seance?.blocks.find(b => b.exo === e) || blockFor(e))).filter(Boolean);
    if (!ups.length) return;
    tip.innerHTML = `<div class="sec-k flat">Prêt pour la suite</div><p class="mut">Deux séances faciles de suite : tu peux augmenter un peu.</p>` +
      ups.map(u => `<div class="tip-row"><b>${exoName(u.exo)}</b><span>${u.what}</span></div>`).join("") +
      `<button class="gbtn wide acc" id="applyProg">Appliquer pour la prochaine fois</button>`;
    tip.hidden = false;
    $("applyProg").onclick = () => {
      for (const { what, ...u } of ups) {
        remember(u);
        if (seance) seance.blocks = seance.blocks.map(b => b.exo === u.exo ? { ...b, reps: u.reps, load: u.load } : b);
      }
      save();
      tip.innerHTML = `<div class="sec-k flat">C'est noté ✓</div><p class="mut">${seance ? `« ${esc(seance.name)} » est mise à jour.` : "Tes prochains objectifs sont mis à jour."}</p>`;
    };
  } else if (rpe === 4 && exos.some(e => prevRpe(e) === 4)) {
    tip.innerHTML = `<div class="sec-k flat">Écoute ton corps</div><p class="mut">Deux séances « à bloc » de suite : garde le même objectif la prochaine fois, ou réduis un peu les répétitions. La progression vient aussi de la récupération.</p>`;
    tip.hidden = false;
  }
}
confirmBtn($("deleteBtn"), "Confirmer ?", () => { if (lastRun) saveSessions(loadSessions().filter(s => s.run !== lastRun.id)); lastRun = null; goTo("home"); });
$("doneOk").onclick = () => goTo("home");
$("doneClose").onclick = () => goTo("home");

/* ===================== Accueil ===================== */
function renderHome() {
  const S = loadSessions(), now = new Date(), h = now.getHours(), name = cfg.profile?.name;
  const ds = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  $("helloDate").textContent = ds.charAt(0).toUpperCase() + ds.slice(1);
  $("helloTitle").textContent = name ? `Salut ${name}` : h < 18 ? "Bonjour" : "Bonsoir";
  $("homeAvatar").textContent = name ? name.charAt(0).toUpperCase() : "?";
  $("weekCard").innerHTML = weekHtml(S);
  const T = todaySeance(S);
  const doneToday = S.some(s => new Date(s.t).toDateString() === now.toDateString());
  if (!T) {
    $("todayCard").innerHTML = `<div class="card today empty-plan"><div class="sec-k flat acc">Ton plan</div><h2>${cfg.profile ? "Aucune activité choisie" : "Crée ton plan"}</h2>
      <p class="mut">${cfg.profile ? "Choisis tes activités : on prépare tes séances." : "Quelques questions, et tes séances sont prêtes, adaptées à ton niveau et à ton temps."}</p>
      <button class="go" id="mkPlan"><span>${cfg.profile ? "Choisir" : "Commencer"}</span></button><button class="linkbtn" id="otherSe">Choisir une séance</button></div>`;
    $("mkPlan").onclick = () => startOnb(!!cfg.profile, cfg.profile ? 4 : 0);
  } else {
    const P = planSeances(), idx = P.indexOf(T), cam = usesCamera(T);
    $("todayCard").innerHTML = `<div class="card today"><div class="today-k"><span class="sec-k flat acc">${doneToday ? "Prochaine séance" : "Séance du jour"}</span><span class="mut">Plan · ${idx + 1}/${P.length}</span></div>
      ${doneToday ? `<p class="done-today">✓ Séance faite aujourd'hui, bravo. Repos conseillé avant la suivante.</p>` : ""}
      <h2>${esc(T.name)}</h2><p class="mut">≈ ${seanceMinutes(T)} min · ${plural(T.blocks.length, "exercice")} · ${cam ? "avec caméra" : "coach vocal"}</p>
      <div class="blist">${T.blocks.map(b => `<div><span>${exoName(b.exo)}</span><b>${blockLabel(b)}</b></div>`).join("")}</div>
      <button class="go" id="todayGo">${IC.play}<span>Commencer</span></button><button class="linkbtn" id="otherSe">Autre séance</button></div>`;
    $("todayGo").onclick = () => startSeance(T);
  }
  $("otherSe").onclick = () => goTo("seances");
}
$("homeAvatar").onclick = () => goTo("profil");
$("weekCard").onclick = () => goTo("progres");
function weekHtml(S) {
  const done = weekSessions(S), g = weekGoal(), st = streakOf(S), days = weekDays(S), today = (new Date().getDay() + 6) % 7;
  const C = 2 * Math.PI * 27, pct = g ? Math.min(1, done / g) : 0;
  const msg = !g ? `${plural(done, "séance")} cette semaine` : done >= g ? "Objectif de la semaine atteint ✓" : `Encore ${plural(g - done, "séance")} cette semaine`;
  return `<div class="ring64"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" class="rb"/><circle cx="32" cy="32" r="27" class="rf" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - pct)}"/></svg><b class="num">${g ? `${done}/${g}` : done}</b></div>
    <div class="week-r"><span class="week-t">${msg}</span><div class="days">${DAYS.map((x, i) => `<i class="${days.has(i) ? "on" : ""}${i === today ? " now" : ""}">${x}</i>`).join("")}</div>
    ${st ? `<span class="streak">${IC.fire}${plural(st, "jour")} d'affilée</span>` : ""}</div>`;
}
const blockLabel = b => isG(b) ? `≈ ${fmtDur(guidedSec(b))}` : `${b.sets} × ${EXOS[b.exo]?.timed ? (b.reps ? b.reps + " s" : "max") : (b.reps || "max")}${b.exo === "curls" && b.arms === "sep" ? " /bras" : ""}${EXOS[b.exo]?.load && b.load ? ` · ${b.load} kg` : ""}`;

/* ===================== Séances ===================== */
let seTab = "mine";
document.querySelectorAll("#seTabs button").forEach(b => b.onclick = () => { seTab = b.dataset.t; renderSeances(); });
$("newSeance").onclick = () => openEditor({ name: "", rest: planFor("pompes", cfg.profile).rest, blocks: [] }, true);
function seIcon(s) {
  if (s.plan && s.id?.startsWith("plan-") && s.id.length === 6) return `<span class="exo-ic letter">${s.id.slice(5)}</span>`;
  if (s.blocks.length === 1 && isG(s.blocks[0])) return gIcon(s.blocks[0].exo.slice(2));
  if (s.blocks.length === 1 && EXOS[s.blocks[0].exo]) return `<span class="exo-ic">${svgIc(EXOS[s.blocks[0].exo].icon)}</span>`;
  return `<span class="exo-ic">${IC.list}</span>`;
}
function seRow(s, today) {
  const kind = usesCamera(s) && usesGuided(s) ? "caméra + coach vocal" : usesCamera(s) ? "caméra" : "coach vocal";
  return `<div class="row-item" data-id="${esc(s.id)}">${seIcon(s)}<button class="ri-t" data-ed="${esc(s.id)}"><b>${esc(s.name)}</b><small>${plural(s.blocks.length, "étape")} · ≈ ${seanceMinutes(s)} min · ${kind}</small></button>${today ? `<span class="tag">Aujourd'hui</span>` : ""}<button class="playbtn" data-go="${esc(s.id)}" aria-label="Lancer ${esc(s.name)}">${IC.play}</button></div>`;
}
function renderSeances() {
  document.querySelectorAll("#seTabs button").forEach(b => b.classList.toggle("on", b.dataset.t === seTab));
  $("seMine").hidden = seTab !== "mine"; $("seCat").hidden = seTab !== "cat";
  if (seTab === "mine") {
    const P = planSeances(), M = mySeances(), T = todaySeance();
    $("seMine").innerHTML = (P.length ? `<div class="sec-k">Mon plan${weekGoal() ? ` · ${weekGoal()} par semaine` : ""}</div><div class="list">${P.map(s => seRow(s, s === T)).join("")}</div>`
        : `<div class="card empty"><b>Pas encore de plan</b><p class="mut">Réponds à quelques questions : tes séances sont préparées selon ton niveau et ton temps.</p><button class="gbtn wide acc" id="sePlan">Créer mon plan</button></div>`) +
      `<div class="sec-k">Mes séances</div>` + (M.length ? `<div class="list">${M.map(s => seRow(s)).join("")}</div>` : `<p class="empty">Crée une séance avec « Créer », ou pars d'un exercice du catalogue et enregistre-le.</p>`);
    $("seMine").querySelectorAll("[data-go]").forEach(b => b.onclick = () => startSeance(cfg.seances.find(s => s.id === b.dataset.go)));
    $("seMine").querySelectorAll("[data-ed]").forEach(b => b.onclick = () => openEditor(cfg.seances.find(s => s.id === b.dataset.ed)));
    const sp = $("sePlan"); if (sp) sp.onclick = () => startOnb(!!cfg.profile, cfg.profile ? 4 : 0);
  } else {
    $("seCat").innerHTML = `<div class="sec-k">Avec la caméra · comptage automatique</div><div class="exo-grid">${Object.entries(EXOS).map(([k, x]) => `<button class="exo" data-ce="${k}"><span class="exo-ic">${svgIc(x.icon)}</span><b>${x.name}</b><small>${x.muscle}</small></button>`).join("")}</div>
      <div class="sec-k">Sans caméra · chrono et coach vocal</div><div class="list">${Object.entries(GUIDED).map(([k, g]) => `<button class="row-item" data-cg="${k}">${gIcon(k)}<span class="ri-t"><b>${g.name}</b><small>${g.desc}</small></span><span class="mut nowrap">≈ ${fmtDur(stepsDur(guidedSteps(k, guidedParams(k), lv())))}</span></button>`).join("")}</div>`;
    $("seCat").querySelectorAll("[data-ce]").forEach(b => b.onclick = () => { const e = b.dataset.ce; openEditor({ name: EXOS[e].name, rest: planFor(e, cfg.profile).rest, blocks: [blockFor(e)] }, true); });
    $("seCat").querySelectorAll("[data-cg]").forEach(b => b.onclick = () => openEditor({ name: GUIDED[b.dataset.cg].name, rest: 60, blocks: [{ exo: "g:" + b.dataset.cg }] }, true));
  }
}

/* ===================== Éditeur de séance ===================== */
let ed = null;   // { s: copie de travail, id: séance enregistrée ou null, dirty }
function openEditor(s, isNew) {
  if (!s) return;
  ed = { s: JSON.parse(JSON.stringify(s)), id: isNew ? null : s.id, dirty: !!isNew && !!s.blocks.length };
  renderEditor(); openSheet("edit");
}
const stepper = (attrs, val, label) => `<div class="tn"><em>${label}</em><div class="stepper xs"><button ${attrs} data-d="-1" aria-label="Moins">${IC.minus}</button><b>${val}</b><button ${attrs} data-d="1" aria-label="Plus">${IC.plus}</button></div></div>`;
function renderEditor() {
  const s = ed.s, saved = ed.id && cfg.seances.find(x => x.id === ed.id), cam = usesCamera(s);
  $("edName").value = s.name;
  $("edNote").textContent = saved?.plan ? "Séance de ton plan : elle est recalculée si tu modifies ton profil." : "";
  $("edRestRow").hidden = !cam; $("edRest").textContent = fmtRest(s.rest);
  $("edList").innerHTML = s.blocks.length ? s.blocks.map((b, i) => {
    const mv = `<div class="mv"><button data-up="${i}" ${i ? "" : "disabled"} aria-label="Monter">${IC.up}</button><button data-dn="${i}" ${i < s.blocks.length - 1 ? "" : "disabled"} aria-label="Descendre">${IC.down}</button><button class="rm" data-rm="${i}" aria-label="Retirer">${IC.x}</button></div>`;
    if (isG(b)) {
      const k = b.exo.slice(2), G = GUIDED[k], p = guidedParams(k, b.p);
      return `<div class="blk">${gIcon(k)}<div class="bt"><b>${G.name}</b><small>Sans caméra · ≈ ${fmtDur(guidedSec(b))}</small></div>${mv}
        <div class="tune">${Object.keys(G.labels).map(f => stepper(`data-gf="${f}" data-i="${i}"`, f === "warm" ? fmtRest(p[f]) : p[f], G.labels[f].replace(" (s)", " s"))).join("")}</div></div>`;
    }
    const X = EXOS[b.exo], t = X.timed;
    return `<div class="blk"><span class="exo-ic on">${svgIc(X.icon)}</span><div class="bt"><b>${X.name}</b><small>${X.muscle}</small></div>${mv}
      <div class="tune">${stepper(`data-f="sets" data-i="${i}"`, b.sets, "Séries")}${stepper(`data-f="reps" data-i="${i}"`, b.reps ? b.reps : "Max", t ? "Secondes" : b.exo === "curls" && b.arms === "sep" ? "Reps / bras" : "Reps")}
      ${X.load ? stepper(`data-f="load" data-i="${i}"`, (b.load || 0) + "<i>kg</i>", X.load === "dumbbell" ? "Haltère" : "Charge") : ""}
      ${b.exo === "curls" ? `<div class="tn"><em>Bras</em><div class="seg xs"><button data-arms="sep" data-i="${i}" class="${b.arms === "sep" ? "on" : ""}">G / D</button><button data-arms="both" data-i="${i}" class="${b.arms !== "sep" ? "on" : ""}">Ensemble</button></div></div>` : ""}</div></div>`;
  }).join("") : `<div class="pe-empty">Ajoute des exercices : ils s'enchaîneront dans cet ordre.</div>`;
  $("edSum").textContent = s.blocks.length ? `${plural(s.blocks.length, "étape")} · ≈ ${seanceMinutes(s)} min` : "";
  $("edStart").disabled = !s.blocks.length;
  $("edSave").disabled = !s.blocks.length || (!!saved && !ed.dirty);
  $("edSave").textContent = saved && !ed.dirty ? "Enregistrée ✓" : "Enregistrer";
  $("edDel").hidden = !saved || saved.plan;
  const L = $("edList"), chg = () => { ed.dirty = true; renderEditor(); };
  L.querySelectorAll("[data-up]").forEach(b => b.onclick = () => { const i = +b.dataset.up; [s.blocks[i - 1], s.blocks[i]] = [s.blocks[i], s.blocks[i - 1]]; chg(); });
  L.querySelectorAll("[data-dn]").forEach(b => b.onclick = () => { const i = +b.dataset.dn; [s.blocks[i + 1], s.blocks[i]] = [s.blocks[i], s.blocks[i + 1]]; chg(); });
  L.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { s.blocks.splice(+b.dataset.rm, 1); chg(); });
  L.querySelectorAll("[data-arms]").forEach(b => b.onclick = () => { s.blocks[+b.dataset.i].arms = b.dataset.arms; chg(); });
  L.querySelectorAll("[data-f]").forEach(b => b.onclick = () => {
    const B = s.blocks[+b.dataset.i], f = b.dataset.f, X = EXOS[B.exo], d = +b.dataset.d;
    if (f === "sets") B.sets = Math.min(10, Math.max(1, B.sets + d));
    if (f === "reps") B.reps = Math.min(X.timed ? 600 : 100, Math.max(0, (B.reps || 0) + d * (X.timed ? 5 : 1)));
    if (f === "load") B.load = Math.min(300, Math.max(0, (B.load || 0) + d * ((B.load || 0) >= 20 ? 2 : 1)));
    chg();
  });
  L.querySelectorAll("[data-gf]").forEach(b => b.onclick = () => {
    const B = s.blocks[+b.dataset.i], f = b.dataset.gf, k = B.exo.slice(2);
    const step = { rounds: 1, work: 5, rest: 5, warm: 60 }[f], lim = { rounds: [1, 20], work: [5, 600], rest: [0, 600], warm: [0, 900] }[f];
    B.p = guidedParams(k, B.p); B.p[f] = Math.min(lim[1], Math.max(lim[0], B.p[f] + +b.dataset.d * step));
    chg();
  });
}
$("edName").oninput = () => { ed.s.name = $("edName").value; ed.dirty = true; $("edSave").disabled = !ed.s.blocks.length; $("edSave").textContent = "Enregistrer"; };
document.querySelectorAll("[data-er]").forEach(b => b.onclick = () => { ed.s.rest = Math.min(600, Math.max(15, ed.s.rest + +b.dataset.er)); ed.dirty = true; renderEditor(); });
$("edClose").onclick = () => { closeSheet("edit"); refresh(); };
function edCommit() {
  const s = { ...ed.s, name: ed.s.name.trim() || (ed.s.blocks.length === 1 ? exoName(ed.s.blocks[0].exo) : `Séance ${mySeances().length + 1}`) };
  if (ed.id) { const i = cfg.seances.findIndex(x => x.id === ed.id); cfg.seances[i] = { ...cfg.seances[i], ...s, id: ed.id }; }
  else { ed.id = s.id = newId(); delete s.plan; cfg.seances.push(s); }
  ed.s = { ...s, id: ed.id }; ed.dirty = false; save();
  return cfg.seances.find(x => x.id === ed.id);
}
$("edSave").onclick = () => { edCommit(); renderEditor(); };
// lancer sans enregistrer : une séance du catalogue reste ponctuelle ; une séance enregistrée garde ses modifications
$("edStart").onclick = () => startSeance(ed.id ? edCommit() : { ...ed.s, name: ed.s.name.trim() || exoName(ed.s.blocks[0].exo) });
confirmBtn($("edDel"), "Confirmer la suppression", () => { cfg.seances = cfg.seances.filter(x => x.id !== ed.id); save(); closeSheet("edit"); refresh(); });
$("edAdd").onclick = () => {
  $("exoPickGrid").innerHTML = `<div class="sec-k">Avec la caméra</div><div class="exo-grid">${Object.entries(EXOS).map(([k, x]) => `<button class="exo" data-add="${k}"><span class="exo-ic">${svgIc(x.icon)}</span><b>${x.name}</b><small>${x.muscle}</small></button>`).join("")}</div>
    <div class="sec-k">Sans caméra · coach vocal</div><div class="exo-grid">${Object.entries(GUIDED).map(([k, g]) => `<button class="exo" data-add="g:${k}">${gIcon(k)}<b>${g.name}</b><small>≈ ${fmtDur(stepsDur(guidedSteps(k, guidedParams(k), lv())))}</small></button>`).join("")}</div>`;
  $("exoPickGrid").querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
    const a = b.dataset.add; ed.s.blocks.push(a.startsWith("g:") ? { exo: a } : blockFor(a)); ed.dirty = true;
    closeSheet("exoPick"); renderEditor(); setTimeout(() => $("edList").lastElementChild?.scrollIntoView({ block: "nearest" }), 50);
  });
  openSheet("exoPick");
};
$("exoPickClose").onclick = () => closeSheet("exoPick");
document.querySelectorAll(".sheet:not(.full)").forEach(sh => sh.addEventListener("click", e => { if (e.target === sh) closeSheet(sh.id); }));
function refresh() { const cur = document.querySelector(".screen.on")?.id; if (["home", "seances", "progres", "profil"].includes(cur)) goTo(cur); }

/* ===================== Progrès ===================== */
let histAll = false;
function renderProgres() {
  const S = loadSessions();
  $("prWeek").innerHTML = `<div class="card week">${weekHtml(S)}</div>`;
  const R = computeRecords(S), withRec = Object.keys(EXOS).filter(e => R[e]);
  $("prRecs").innerHTML = withRec.length ? withRec.map(e => `<div class="rec"><b class="num">${R[e]}${EXOS[e].timed ? "<small>s</small>" : ""}</b><span>${EXOS[e].name}</span></div>`).join("") : `<p class="empty">Tes meilleures séries apparaîtront ici.</p>`;
  // une ligne par séance (les étapes d'un même enchaînement sont regroupées)
  const runs = []; for (const s of S.slice().reverse()) { const k = s.run || s.t, r = runs.find(x => x.k === k); if (r) r.items.push(s); else runs.push({ k, items: [s] }); }
  const shown = histAll ? runs : runs.slice(0, 10);
  $("prHist").innerHTML = runs.length ? `<div class="list">${shown.map(r => {
    const it = r.items, s0 = it[it.length - 1], d = new Date(s0.t), reps = it.reduce((a, s) => a + sessReps(s), 0);
    const work = it.reduce((a, s) => a + (s.guided?.work || 0), 0), timed = it.reduce((a, s) => a + s.sets.filter(x => EXOS[x.exo]?.timed).reduce((u, x) => u + x.n, 0), 0);
    const kcal = it.reduce((a, s) => a + (s.kcal || 0), 0), dur = it.reduce((a, s) => a + (s.dur || 0), 0);
    const name = s0.name || [...new Set(it.flatMap(s => s.guided ? [s.guided.name] : s.sets.map(x => exoName(x.exo))))].join(", ");
    const what = [reps ? `${reps} reps` : "", timed ? `${timed} s de gainage` : "", work ? `${fmtClock(work * 1000)} d'effort` : ""].filter(Boolean).join(" · ");
    return `<div class="row-item hist"><div class="date"><small>${d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}</small><b class="num">${d.getDate()}</b></div><div class="ri-t"><b>${esc(name)}</b><small>${Math.max(1, Math.round(dur / 60000))} min${what ? " · " + what : ""}${kcal ? ` · ≈${kcal} kcal` : ""}${it.some(s => s.rpe) ? " · " + ["", "Facile", "Bien", "Dur", "À bloc"][it.find(s => s.rpe).rpe] : ""}</small></div></div>`;
  }).join("")}</div>${runs.length > 10 ? `<button class="linkbtn" id="histMore">${histAll ? "Afficher moins" : `Tout l'historique (${runs.length})`}</button>` : ""}` : `<p class="empty">Termine une séance pour la voir ici.</p>`;
  const m = $("histMore"); if (m) m.onclick = () => { histAll = !histAll; renderProgres(); };
}

/* ===================== Profil et réglages ===================== */
function renderProfil() {
  const p = cfg.profile;
  $("meHead").innerHTML = p ? `<span class="avatar big">${esc((p.name || "?").charAt(0).toUpperCase())}</span><div><h1>${esc(p.name || "Moi")}</h1><p class="mut">${LEVELS[(p.level || 2) - 1].n} · ${GOALS.find(g => g.k === p.goal)?.n || ""}</p></div>`
    : `<span class="avatar big">?</span><div><h1>Mon profil</h1><p class="mut">Pas encore créé</p></div>`;
  const row = (step, t, v) => `<button class="line" data-step="${step}"><span>${t}</span><span class="val">${v}${IC.chev}</span></button>`;
  $("meProfile").innerHTML = p
    ? row(0, "Prénom", esc(p.name || "—")) + row(1, "Poids · taille", `${p.weight || "—"} kg · ${p.height || "—"} cm`) + row(2, "Niveau", LEVELS[(p.level || 2) - 1].n) + row(3, "Objectif", GOALS.find(g => g.k === p.goal)?.n || "—")
      + row(4, "Activités", plural((p.exos || []).length + (p.guided || []).length, "activité")) + row(5, "Mon rythme", `${p.perWeek || weeklySessionsFor(p)} / semaine · ${p.minutes || 30} min`)
    : `<button class="line" data-step="0"><span>Créer mon profil et mon plan</span><span class="val">${IC.chev}</span></button>`;
  $("meProfile").querySelectorAll("[data-step]").forEach(b => b.onclick = () => startOnb(!!p, +b.dataset.step));
  $("voiceSw").classList.toggle("on", cfg.voice); $("voiceSw").setAttribute("aria-checked", cfg.voice);
  $("ecoSw").classList.toggle("on", cfg.eco); $("ecoSw").setAttribute("aria-checked", cfg.eco);
  document.querySelectorAll("#trigSeg button").forEach(b => b.classList.toggle("on", b.dataset.v === cfg.trigger));
  document.querySelectorAll("#camSeg button").forEach(b => b.classList.toggle("on", b.dataset.v === cfg.facing));
  $("delayV").textContent = cfg.delay;
  $("verLbl").textContent = VERSION;
}
const setCfg = (k, v) => { cfg[k] = v; save(); renderProfil(); };
$("voiceSw").onclick = () => setCfg("voice", !cfg.voice);
$("ecoSw").onclick = () => setCfg("eco", !cfg.eco);
document.querySelectorAll("#trigSeg button").forEach(b => b.onclick = () => setCfg("trigger", b.dataset.v));
document.querySelectorAll("#camSeg button").forEach(b => b.onclick = () => setCfg("facing", b.dataset.v));
document.querySelectorAll("[data-delay]").forEach(b => b.onclick = () => setCfg("delay", Math.min(30, Math.max(0, cfg.delay + +b.dataset.delay))));
$("tipsBtn").onclick = () => { $("verTxt").textContent = VERSION; openSheet("tipsSheet"); };
$("tipsClose").onclick = () => closeSheet("tipsSheet");

// Sauvegarde / restauration (historique, séances, profil)
async function giveFile(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }); return "partagé"; } } catch (e) { if (e?.name === "AbortError") return "annulé"; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return "téléchargé";
}
$("backupBtn").onclick = async () => {
  const data = { app: "compteur-muscu", version: 2, date: new Date().toISOString(), sessions: loadSessions(), seances: mySeances(), profile: cfg.profile };
  const d = new Date(), name = `compteur-muscu-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.json`;
  const r = await giveFile(new Blob([JSON.stringify(data)], { type: "application/json" }), name, "Sauvegarde Compteur muscu");
  $("bkMsg").textContent = r === "annulé" ? "" : `Sauvegarde ${r} : ${plural(data.sessions.length, "séance")} dans l'historique, ${plural(data.seances.length, "séance")} perso.`;
};
$("restoreBtn").onclick = () => $("restoreFile").click();
$("restoreFile").onchange = async e => {
  const f = e.target.files?.[0]; e.target.value = "";
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== "compteur-muscu" || !Array.isArray(data.sessions)) throw new Error();
    const cur = loadSessions(), seen = new Set(cur.map(x => x.t));
    const add = data.sessions.filter(x => x && x.t && Array.isArray(x.sets) && !seen.has(x.t));
    saveSessions(cur.concat(add).sort((a, b) => a.t - b.t));
    const names = new Set(cfg.seances.map(p => p.name));
    const addP = (data.seances || data.saved || []).filter(p => p && p.name && Array.isArray(p.blocks) && !p.plan && !names.has(p.name)).map(p => ({ id: newId(), name: p.name, rest: p.rest || 90, blocks: p.blocks }));
    cfg.seances.push(...addP);
    if (!cfg.profile && data.profile) applyProfile(data.profile); else save();
    $("bkMsg").textContent = `Restauré : ${plural(add.length, "séance")} dans l'historique et ${plural(addP.length, "séance")} perso ajoutées.`;
  } catch { $("bkMsg").textContent = "Ce fichier n'est pas une sauvegarde valide."; }
};
confirmBtn($("clearBtn"), "Appuie encore pour tout effacer", () => { saveSessions([]); $("bkMsg").textContent = "Historique effacé."; });

/* ===================== Carte de partage ===================== */
async function shareCard() {
  const L = lastShare; if (!L) return;
  try { await document.fonts?.ready; } catch {}
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"), F = '"Barlow Condensed", Inter, sans-serif', FI = 'Inter, system-ui, sans-serif';
  const bg = g.createRadialGradient(W / 2, -100, 50, W / 2, 200, 1100); bg.addColorStop(0, "#1c3b2a"); bg.addColorStop(.55, "#09090b"); bg.addColorStop(1, "#09090b");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  const lg = g.createLinearGradient(80, 90, 170, 180); lg.addColorStop(0, "#4ade80"); lg.addColorStop(1, "#16a34a");
  g.fillStyle = lg; rr(80, 90, 96, 96, 26); g.fill();
  g.strokeStyle = "#04130a"; g.lineWidth = 9; g.lineCap = g.lineJoin = "round";
  g.beginPath(); [[22, 12], [18, 12], [15, 21], [9, 3], [6, 12], [2, 12]].forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](80 + 12 + x * 3, 90 + 12 + y * 3)); g.stroke();
  g.fillStyle = "#fafafa"; g.font = `700 46px ${FI}`; g.fillText("Séance terminée", 206, 135);
  g.fillStyle = "#a1a1aa"; g.font = `500 30px ${FI}`;
  g.fillText(L.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }), 206, 178);
  g.textAlign = "center"; g.fillStyle = "#fafafa"; g.font = `800 330px ${F}`; g.fillText(String(L.total), W / 2, 590);
  g.fillStyle = "#4ade80"; g.font = `700 54px ${FI}`; g.fillText(L.unit.toUpperCase(), W / 2, 670);
  const stats = [["MINUTES", L.mins], L.kcal ? ["KCAL (ESTIM.)", "≈" + L.kcal] : ["SÉRIES", L.sets], ["JOURS D'AFFILÉE", L.streak || 1]];
  stats.forEach(([k, v], i) => {
    const x = 80 + i * 316, y = 740;
    g.fillStyle = "#ffffff0f"; rr(x, y, 288, 200, 32); g.fill(); g.strokeStyle = "#ffffff1f"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "#fafafa"; g.font = `800 110px ${F}`; g.fillText(String(v), x + 144, y + 125);
    g.fillStyle = "#71717a"; g.font = `700 24px ${FI}`; g.fillText(k, x + 144, y + 170);
  });
  const per = {}; for (const h of L.history) per[h.exo] = (per[h.exo] || 0) + h.n;
  g.textAlign = "left"; let y = 1030;
  for (const [e, n] of Object.entries(per).slice(0, L.ton ? 3 : 4)) {
    g.fillStyle = EXO_COL[e] || "#4ade80"; rr(80, y - 30, 14, 40, 7); g.fill();
    g.fillStyle = "#e4e4e7"; g.font = `600 38px ${FI}`; g.fillText(exoName(e), 116, y);
    g.textAlign = "right"; g.fillStyle = "#fafafa"; g.font = `800 52px ${F}`; g.fillText(n + (EXOS[e]?.timed ? " s" : ""), W - 80, y + 4); g.textAlign = "left";
    y += 64;
  }
  if (L.ton) { g.fillStyle = "#a1a1aa"; g.font = `600 34px ${FI}`; g.fillText("Tonnage", 116, y); g.textAlign = "right"; g.fillStyle = "#4ade80"; g.font = `800 52px ${F}`; g.fillText(L.ton.toLocaleString("fr-FR") + " kg", W - 80, y + 4); g.textAlign = "left"; }
  g.fillStyle = "#52525b"; g.font = `600 26px ${FI}`; g.textAlign = "center"; g.fillText("COMPTEUR DE MUSCU · comptage par caméra", W / 2, H - 50);
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  if (blob) await giveFile(blob, "ma-seance.png", "Ma séance");
}
$("shareBtn").onclick = () => shareCard();

/* ===================== Profil : premier lancement et modification ===================== */
// Étapes : 0 prénom, 1 gabarit, 2 niveau, 3 objectif, 4 activités, 5 rythme, 6 aperçu du plan (premier lancement)
let onbStep = 0, onbEdit = false, op = null;
const ONB_N = 7;
function startOnb(edit, step = 0) {
  onbEdit = edit; onbStep = step;
  op = JSON.parse(JSON.stringify(cfg.profile || { name: "", weight: 70, height: 170, level: 2, goal: "forme", exos: ["pompes", "squats"], guided: [] }));
  op.guided ||= []; op.perWeek ||= weeklySessionsFor(op); op.minutes ||= 30;
  $("onbSkip").textContent = edit ? "Annuler" : "Passer";
  renderOnb(); show("onb");
}
function onbStepper(key, unit) {
  return `<div class="stepper"><button data-ok="${key}" data-od="-1" aria-label="Moins">${IC.minus}</button><b><span class="num">${op[key]}</span><i>${unit}</i></b><button data-ok="${key}" data-od="1" aria-label="Plus">${IC.plus}</button></div>`;
}
function renderOnb() {
  $("onbDots").innerHTML = onbEdit ? "" : Array.from({ length: ONB_N }, (_, i) => `<i class="${i <= onbStep ? "on" : ""}"></i>`).join("");
  $("onbBack").style.visibility = onbStep || onbEdit ? "visible" : "hidden";
  const B = $("onbBody"); let html = "", next = onbEdit ? "Enregistrer" : "Continuer";
  if (onbStep === 0) {
    html = `<h1>${onbEdit ? "Ton prénom" : "Bienvenue !"}</h1><p class="lead">${onbEdit ? "Pour te saluer." : "Quelques questions pour préparer des séances adaptées à toi. Ça prend 30 secondes."}</p>
      <label class="sec-k" for="onbName">Ton prénom</label><input class="onb-input" id="onbName" maxlength="20" autocomplete="given-name" placeholder="Prénom" value="${esc(op.name)}">`;
  } else if (onbStep === 1) {
    html = `<h1>Ton gabarit</h1><p class="lead">Pour estimer les calories brûlées. Ces données restent sur ton téléphone.</p>
      <div class="card measure"><div class="ml"><b>Poids</b><small>en kilos</small></div>${onbStepper("weight", "kg")}</div>
      <div class="card measure"><div class="ml"><b>Taille</b><small>en centimètres</small></div>${onbStepper("height", "cm")}</div>`;
  } else if (onbStep === 2) {
    html = `<h1>Ton niveau</h1><p class="lead">On adapte le nombre de séries et de répétitions.</p>` +
      LEVELS.map(l => `<button class="opt${op.level === l.k ? " on" : ""}" data-lvl="${l.k}"><span class="oe">${lvlIcon(l.k)}</span><span><b>${l.n}</b><small>${l.d}</small></span></button>`).join("");
  } else if (onbStep === 3) {
    html = `<h1>Ton objectif</h1><p class="lead">Il change le rythme de tes séances et tes pauses.</p>` +
      GOALS.map(g => `<button class="opt${op.goal === g.k ? " on" : ""}" data-goal="${g.k}"><span class="oe acc">${ic(g.i)}</span><span><b>${g.n}</b><small>${g.d}</small></span></button>`).join("");
  } else if (onbStep === 4) {
    html = `<h1>Tes activités</h1><p class="lead">Ce que tu veux pratiquer. Tout le reste reste disponible dans le catalogue.</p>
      <div class="sec-k">Avec la caméra · comptage automatique</div>
      <div class="exo-grid">${Object.entries(EXOS).map(([k, x]) => `<button class="exo${op.exos.includes(k) ? " on" : ""}" data-ex="${k}"><span class="exo-ic">${svgIc(x.icon)}</span><b>${x.name}</b><small>${x.muscle}</small></button>`).join("")}</div>
      <div class="sec-k">Sans caméra · chrono et coach vocal</div>
      <div class="exo-grid">${Object.entries(GUIDED).map(([k, g]) => `<button class="exo${op.guided.includes(k) ? " on" : ""}" data-gg="${k}"><span class="exo-ic">${ic(g.icon)}</span><b>${g.name}</b><small>≈ ${fmtDur(stepsDur(guidedSteps(k, g.params((op.level || 2) - 1), (op.level || 2) - 1)))}</small></button>`).join("")}</div>`;
    const n = op.exos.length + op.guided.length;
    if (!onbEdit) next = n ? `Continuer (${n})` : "Choisis au moins une activité";
  } else if (onbStep === 5) {
    const advice = ["2 à 3", "3 à 4", "4 à 5"][op.level - 1];
    html = `<h1>Ton rythme</h1><p class="lead">Tes séances sont construites pour tenir dans ton emploi du temps.</p>
      <div class="sec-k">Séances par semaine</div>
      <div class="chips7">${[1, 2, 3, 4, 5, 6, 7].map(n => `<button class="chip${op.perWeek === n ? " on" : ""}" data-pw="${n}">${n}</button>`).join("")}</div>
      <p class="mut small">Conseillé pour ton niveau : ${advice} séances, avec au moins un jour de repos entre deux séances pour les mêmes muscles.</p>
      <div class="sec-k">Temps par séance</div>
      <div class="chips3">${[10, 15, 20, 30, 45, 60].map(n => `<button class="chip${op.minutes === n ? " on" : ""}" data-mn="${n}">${n} min</button>`).join("")}</div>`;
  } else {
    const plan = buildPlan(op, cfg.loads);
    html = `<h1>Ton plan${op.name ? ", " + esc(op.name) : ""}</h1><p class="lead">${LEVELS[op.level - 1].n} · ${GOALS.find(g => g.k === op.goal).n} · ${op.perWeek} séance${op.perWeek > 1 ? "s" : ""} par semaine</p>
      ${plan.map(s => `<div class="card"><div class="row sb"><b>${esc(s.name)}</b><span class="mut">≈ ${seanceMinutes(s)} min</span></div>${s.blocks.map(b => `<div class="plan-row">${isG(b) ? gIcon(b.exo.slice(2)) : `<span class="exo-ic">${svgIc(EXOS[b.exo].icon)}</span>`}<span>${exoName(b.exo)}</span><b>${isG(b) ? "coach vocal" : blockLabel(b)}</b></div>`).join("")}</div>`).join("")}
      ${plan.length > 1 ? `<p class="mut small center">La séance du jour alterne entre ces séances.</p>` : ""}
      ${(() => { const used = new Set(plan.flatMap(s => s.blocks.map(b => b.exo))), left = op.exos.filter(e => !used.has(e)); return left.length ? `<p class="mut small center">Pas assez de temps pour ${left.map(e => EXOS[e].name).join(", ")} : augmente la durée, ou fais-les à part depuis le catalogue.</p>` : ""; })()}
      <p class="mut center">Modifiable à tout moment dans Profil.</p>
      <p class="disclaimer">Repères généraux inspirés des recommandations de l'ACSM (American College of Sports Medicine). Ils ne remplacent ni un coach ni un avis médical : arrête-toi en cas de douleur, et demande conseil à un professionnel de santé si tu as un problème de santé ou une blessure.</p>`;
    next = "C'est parti";
  }
  B.innerHTML = html; B.scrollTop = 0;
  $("onbNext").querySelector("span").textContent = next;
  $("onbNext").disabled = onbStep === 4 && !op.exos.length && !op.guided.length;
  const nm = $("onbName"); if (nm) { nm.oninput = () => op.name = nm.value.trim(); if (!onbEdit) setTimeout(() => nm.focus(), 250); nm.onkeydown = e => { if (e.key === "Enter") $("onbNext").click(); }; }
  B.querySelectorAll("[data-ok]").forEach(b => b.onclick = () => { const k = b.dataset.ok, lim = k === "weight" ? [30, 250] : [120, 230]; op[k] = Math.min(lim[1], Math.max(lim[0], (op[k] || 0) + +b.dataset.od)); renderOnb(); });
  B.querySelectorAll("[data-lvl]").forEach(b => b.onclick = () => { op.level = +b.dataset.lvl; if (!op.rythmTouched) op.perWeek = weeklySessionsFor(op); renderOnb(); });
  B.querySelectorAll("[data-pw]").forEach(b => b.onclick = () => { op.perWeek = +b.dataset.pw; op.rythmTouched = true; renderOnb(); });
  B.querySelectorAll("[data-mn]").forEach(b => b.onclick = () => { op.minutes = +b.dataset.mn; renderOnb(); });
  B.querySelectorAll("[data-goal]").forEach(b => b.onclick = () => { op.goal = b.dataset.goal; renderOnb(); });
  B.querySelectorAll("[data-gg]").forEach(b => b.onclick = () => { const k = b.dataset.gg; op.guided = op.guided.includes(k) ? op.guided.filter(x => x !== k) : [...op.guided, k]; renderOnb(); });
  B.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => { const k = b.dataset.ex; op.exos = op.exos.includes(k) ? op.exos.filter(x => x !== k) : [...op.exos, k]; renderOnb(); });
}
function finishOnb() {
  op.name = (op.name || "").trim();
  const wasEdit = onbEdit;
  applyProfile(op);
  goTo(wasEdit ? "profil" : "home");
}
$("onbNext").onclick = () => {
  if (onbStep === 0) { op.name = ($("onbName")?.value || "").trim(); if (!op.name) { $("onbName").focus(); $("onbName").placeholder = "Ton prénom, pour te saluer"; return; } }
  if (onbEdit || onbStep >= ONB_N - 1) finishOnb(); else { onbStep++; renderOnb(); }
};
$("onbBack").onclick = () => { if (onbEdit) goTo("profil"); else if (onbStep > 0) { onbStep--; renderOnb(); } };
$("onbSkip").onclick = () => { if (onbEdit) return goTo("profil"); cfg.onboarded = true; save(); goTo("home"); };

/* ===================== Démarrage ===================== */
if (cfg.onboarded) goTo("home"); else startOnb(false);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
