// Réglages, séances enregistrées et historique (localStorage), avec migration des anciennes versions.
import { EXOS, GUIDED, planFor, buildPlan, guidedSteps, stepsDur, isG, levelIdx } from "./data.js";

const CKEY = "pompesCfg", HKEY = "muscuHistory";
const DEF = {
  v: 2, onboarded: false, profile: null,
  // pendant la séance
  voice: true, trigger: "timer", delay: 10, facing: "user", eco: false,
  // séances (plan + perso), derniers réglages par exercice, charges, réglages des séances guidées
  seances: [], memo: {}, loads: {}, guidedP: {}
};

function load() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(CKEY) || "{}"); } catch {}
  const c = { ...DEF, ...raw };
  if ((raw.v || 1) < 2) migrateV1(c, raw);
  return c;
}
// v1 : programmes dans « saved », poids en double, réglages de l'exercice courant à la racine
function migrateV1(c, raw) {
  if (c.profile && !c.profile.weight && raw.weight) c.profile.weight = raw.weight;
  let n = 0;
  c.seances = (raw.saved || []).filter(p => p && Array.isArray(p.blocks) && p.blocks.length)
    .map(p => ({ id: "s" + Date.now().toString(36) + (n++), name: p.name || "Ma séance", rest: p.rest || raw.rest || 90, blocks: p.blocks.map(b => { const { rest, ...x } = b; return x; }), plan: !!p.plan && !!c.profile }));
  if (Array.isArray(raw.prog) && raw.prog.length) c.seances.push({ id: "s-prog", name: "Mon programme", rest: raw.rest || 90, blocks: raw.prog });
  c.memo = {};
  for (const [e, m] of Object.entries(raw.perExo || {})) if (EXOS[e]) c.memo[e] = { sets: m.sets, reps: m.reps, arms: "both", load: m.load || 0 };
  if (c.profile) c.seances = [...buildPlan(c.profile, c.loads || {}), ...c.seances.filter(s => !s.plan)];
  for (const k of ["saved", "prog", "perExo", "goal", "goalSessions", "weight", "exo", "reps", "sets", "rest", "arms"]) delete c[k];
  c.v = 2;
}

export const cfg = load();
export function save() { try { localStorage.setItem(CKEY, JSON.stringify(cfg)); } catch {} }
// profil sans séances du plan (ancienne sauvegarde, plan supprimé) : on le reconstruit
if (cfg.profile && !cfg.seances.some(s => s.plan)) cfg.seances = [...buildPlan(cfg.profile, cfg.loads), ...cfg.seances];
save();

/* ---------- Profil ---------- */
export const weight = () => cfg.profile?.weight || 0;
export const lv = () => levelIdx(cfg.profile);
export function applyProfile(p) {
  cfg.profile = p; cfg.onboarded = true;
  cfg.seances = [...buildPlan(p, cfg.loads), ...cfg.seances.filter(s => !s.plan)];
  save();
}

/* ---------- Séances ---------- */
export const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const planSeances = () => cfg.seances.filter(s => s.plan);
export const mySeances = () => cfg.seances.filter(s => !s.plan);
// Réglages d'un exercice : les derniers utilisés, sinon ceux du plan
export function blockFor(exo) {
  const m = cfg.memo[exo], pl = planFor(exo, cfg.profile);
  return { exo, sets: m?.sets ?? Math.min(pl.sets, 4), reps: m?.reps ?? pl.reps, arms: m?.arms || "both", load: m?.load ?? (cfg.loads[exo] || 0) };
}
export function remember(b) {
  if (isG(b) || !EXOS[b.exo]) return;
  cfg.memo[b.exo] = { sets: b.sets, reps: b.reps, arms: b.arms || "both", load: b.load || 0 };
  if (b.load) cfg.loads[b.exo] = b.load;
}
export const guidedParams = (key, over) => ({ ...GUIDED[key].params(lv()), ...(cfg.guidedP[key] || {}), ...(over || {}) });
export const guidedSec = b => stepsDur(guidedSteps(b.exo.slice(2), guidedParams(b.exo.slice(2), b.p), lv()));
// Durée estimée : 2,5 s par répétition, temps de repos, séances guidées, délai de départ
export function seanceMinutes(s) {
  const cam = s.blocks.filter(b => !isG(b)), sets = cam.reduce((a, b) => a + b.sets, 0);
  const work = cam.reduce((a, b) => a + b.sets * (EXOS[b.exo]?.timed ? (b.reps || 45) : (b.reps || 15) * 2.5 * (b.exo === "curls" && b.arms === "sep" ? 2 : 1)), 0);
  const g = s.blocks.filter(isG).reduce((a, b) => a + guidedSec(b), 0);
  return Math.max(1, Math.round((work + Math.max(0, sets - 1) * (s.rest || 60) + g + (cam.length ? cfg.delay : 0)) / 60));
}
export const usesCamera = s => s.blocks.some(b => !isG(b));
export const usesGuided = s => s.blocks.some(isG);

/* ---------- Historique ---------- */
export function loadSessions() { try { return JSON.parse(localStorage.getItem(HKEY) || "[]"); } catch { return []; } }
export function saveSessions(a) { try { localStorage.setItem(HKEY, JSON.stringify(a.slice(-300))); } catch {} }
export function computeRecords(S) {
  const r = {};
  for (const s of S) for (const x of s.sets) r[x.exo] = Math.max(r[x.exo] || 0, x.best || 0);
  return r;
}
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
export const sessReps = s => s.sets.filter(x => !EXOS[x.exo]?.timed).reduce((u, x) => u + x.n, 0);
export function weekStart() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
// une séance = un enchaînement (plusieurs étapes d'un même enchaînement ne comptent qu'une fois)
export function weekSessions(S) { const w = weekStart(); return new Set(S.filter(s => s.t >= w).map(s => s.run || s.t)).size; }
export function weekDays(S) { const w = weekStart(); return new Set(S.filter(s => s.t >= w).map(s => (new Date(s.t).getDay() + 6) % 7)); }
export function streakOf(S) {
  const days = new Set(S.map(s => dayKey(s.t)));
  const d = new Date(); d.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);    // la série tient encore si on s'est entraîné hier
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const weekGoal = () => cfg.profile?.perWeek || 0;
// Séance du jour : la séance du plan qui suit la dernière faite (A, B, … en alternance)
export function todaySeance(S = loadSessions()) {
  const P = planSeances(); if (!P.length) return null;
  for (let i = S.length - 1; i >= 0; i--) {
    const k = P.findIndex(p => p.id === S[i].sid);
    if (k >= 0) return P[(k + 1) % P.length];
  }
  return P[0];
}
