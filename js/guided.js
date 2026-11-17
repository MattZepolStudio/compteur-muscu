// Séance guidée sans caméra : chrono, coach vocal, pause, verrouillage de l'écran.
// runGuided(clé, réglages, fin) ; fin(résultat) à la fin ou à l'arrêt.
import { GUIDED, MOVES, guidedSteps, stepsDur, fmtDur, fmtClock } from "./data.js";
import { lv } from "./store.js";
import { $, show, holdBtn, tick, goBeep, say, keepAwake, releaseWake, unlockAudio } from "./device.js";

const G = { key: null, steps: [], i: 0, endAt: 0, left: 0, paused: false, start: 0, pausedMs: 0, pauseAt: 0, timer: null, said: {}, workSec: 0, onEnd: null };
const RING = 339.29;
const IC_PLAY = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><polygon points="7 4 20 12 7 20" fill="currentColor"/></svg>';
const IC_PAUSE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>';

const stepTitle = st => st.kind === "prep" ? "Prépare-toi" : st.kind === "rest" && !st.m ? "Repos" : MOVES[st.m]?.[0] || "";
function nextWork(i) { for (let j = i + 1; j < G.steps.length; j++) if (G.steps[j].kind === "work" || G.steps[j].m) return G.steps[j]; return null; }

export function runGuided(key, p, done) {
  unlockAudio(); keepAwake();
  Object.assign(G, { key, steps: guidedSteps(key, p, lv()), i: -1, paused: false, start: Date.now(), pausedMs: 0, said: {}, workSec: 0, onEnd: done });
  $("gpName").textContent = GUIDED[key].name;
  $("gpPlay").innerHTML = IC_PAUSE;
  $("gpPause").classList.remove("on"); $("gpLockOv").classList.remove("on");
  show("guided");
  say(`${GUIDED[key].name}. ${fmtDur(stepsDur(G.steps))}. C'est parti dans 10 secondes`);
  gotoStep(0, true);
  clearInterval(G.timer); G.timer = setInterval(gdTick, 200);
}
function gotoStep(i, silent) {
  if (i >= G.steps.length) return finish(false);
  G.i = Math.max(0, i); const st = G.steps[G.i];
  G.endAt = performance.now() + st.sec * 1000; G.left = st.sec * 1000; G.said = {};
  const ph = st.kind === "prep" ? "prep" : st.kind === "rest" ? "rest" : "work";
  $("guided").className = "screen on ph-" + ph;
  $("gpPhase").textContent = ph === "prep" ? "Préparation" : ph === "rest" ? (st.active ? "Récupération" : "Repos") : "Effort";
  $("gpMove").textContent = stepTitle(st);
  $("gpCue").textContent = st.m ? MOVES[st.m][1] : ph === "prep" ? "Mets-toi en place" : "Respire, récupère";
  const tag = st.rn && st.rn > 1 ? `Tour ${st.r}/${st.rn}` : "", sub = st.n ? `${st.i}/${st.n}` : "";
  $("gpRound").textContent = [tag, sub].filter(Boolean).join(" · ");
  const nx = nextWork(G.i);
  $("gpNext").innerHTML = nx ? `<span><small>Ensuite</small>${stepTitle(nx)}</span><b class="num">${nx.sec} s</b>` : `<span><small>Ensuite</small>Fin de la séance</span>`;
  if (!silent) {
    if (st.kind === "work") { goBeep(); say(`${stepTitle(st)}. ${st.sec} secondes${st.soft ? "" : ". Allez !"}`); }
    else if (st.kind === "rest") say(st.active ? `${stepTitle(st)}, ${st.sec} secondes` : `Repos${nx ? ". Ensuite : " + stepTitle(nx) : ""}`);
  }
  gdTick();
}
function gdTick() {
  if (G.paused || !G.steps.length || G.i < 0) return;
  const st = G.steps[G.i], left = Math.max(0, G.endAt - performance.now()), sec = Math.ceil(left / 1000);
  $("gpSec").textContent = sec >= 60 ? fmtClock(left + 999) : sec;
  $("gpRing").style.strokeDashoffset = RING * (1 - left / (st.sec * 1000));
  const rest = left / 1000 + G.steps.slice(G.i + 1).reduce((a, x) => a + x.sec, 0);
  $("gpLeft").textContent = "−" + fmtClock(rest * 1000);
  const once = (k, f) => { if (!G.said[k]) { G.said[k] = 1; f(); } };
  if (st.sec >= 30 && sec === Math.ceil(st.sec / 2) && st.kind === "work") once("half", () => say(st.soft ? "La moitié" : "La moitié, tiens bon", false));
  if (st.sec >= 20 && sec === 10) once("ten", () => say("10 secondes", false));
  if (sec <= 3 && sec >= 1) once("c" + sec, tick);
  if (left <= 0) { if (st.kind === "work") G.workSec += st.sec; gotoStep(G.i + 1); }
}
function pause() {
  if (G.paused) return; G.paused = true; G.pauseAt = performance.now(); G.left = G.endAt - G.pauseAt;
  $("gpPauseTime").textContent = $("gpLeft").textContent.replace("−", ""); $("gpPause").classList.add("on"); say("Pause");
  $("gpPlay").innerHTML = IC_PLAY;
}
function resume() {
  if (!G.paused) return; G.paused = false; G.pausedMs += performance.now() - G.pauseAt; G.endAt = performance.now() + G.left;
  $("gpPause").classList.remove("on"); say("C'est reparti");
  $("gpPlay").innerHTML = IC_PAUSE;
}
$("gpPlay").onclick = () => G.paused ? resume() : pause();
$("gpResume").onclick = resume;
$("gpNextBtn").onclick = () => { if (!G.paused) gotoStep(G.i + 1); };
$("gpPrev").onclick = () => { if (!G.paused) gotoStep(performance.now() - (G.endAt - G.steps[G.i].sec * 1000) > 3000 ? G.i : G.i - 1); };
holdBtn($("gpStop"), 900, () => finish(true));
$("gpLock").onclick = () => $("gpLockOv").classList.add("on");
holdBtn($("gpUnlock"), 900, () => $("gpLockOv").classList.remove("on"));

function finish(stopped) {
  if (!G.timer) return;
  clearInterval(G.timer); G.timer = null;
  const st = G.steps[G.i];
  if (stopped && st?.kind === "work") G.workSec += Math.round((st.sec * 1000 - Math.max(0, G.paused ? G.left : G.endAt - performance.now())) / 1000);
  if (G.paused) G.pausedMs += performance.now() - G.pauseAt;
  G.paused = false; releaseWake();
  const works = G.steps.filter(x => x.kind === "work").length;
  const doneWorks = Math.min(works, G.steps.slice(0, G.i + (stopped ? 0 : 1)).filter(x => x.kind === "work").length);
  say(stopped ? "Séance arrêtée. Bien joué quand même" : `Bravo ! ${GUIDED[G.key].name} terminé`);
  G.onEnd?.({ key: G.key, start: G.start, dur: Date.now() - G.start - G.pausedMs, workSec: G.workSec, works, doneWorks, stopped });
}
