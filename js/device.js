// Son, voix, écran toujours allumé et petits utilitaires d'interface.
import { cfg } from "./store.js";

export const $ = id => document.getElementById(id);

/* ---------- Écrans ---------- */
const TABS = ["home", "seances", "progres", "profil"];
export function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  const nav = $("tabbar");
  nav.hidden = !TABS.includes(id);
  nav.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === id));
}
export const openSheet = id => $(id).classList.add("on");
export const closeSheet = id => $(id).classList.remove("on");
// appui maintenu (évite les arrêts par erreur)
export function holdBtn(b, ms, fn) {
  let t = null;
  b.addEventListener("pointerdown", e => { e.preventDefault(); b.classList.add("pressing"); t = setTimeout(() => { b.classList.remove("pressing"); fn(); }, ms); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, () => { clearTimeout(t); b.classList.remove("pressing"); }));
  b.addEventListener("contextmenu", e => e.preventDefault());
}
// bouton à confirmer par un second appui
export function confirmBtn(b, label, fn) {
  const txt = b.querySelector("span") || b, orig = txt.textContent;
  b.onclick = () => {
    if (!b.dataset.armed) { b.dataset.armed = 1; txt.textContent = label; setTimeout(() => { delete b.dataset.armed; txt.textContent = orig; }, 4000); return; }
    delete b.dataset.armed; txt.textContent = orig; fn();
  };
}

/* ---------- Bips ---------- */
let actx;
export function beep(freq = 880, dur = 0.15, vol = 0.3) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.start(); o.stop(actx.currentTime + dur);
  } catch {}
}
// compte à rebours : 3 bips courts identiques, puis un bip aigu plus long au départ
export const tick = () => beep(880, 0.12, 0.3);
export const goBeep = () => beep(1320, 0.4, 0.35);
export const vibrate = p => { try { navigator.vibrate?.(p); } catch {} };

/* ---------- Voix ---------- */
let frVoice = null;
function pickVoice() {
  const v = speechSynthesis.getVoices();
  frVoice = v.find(x => x.lang?.startsWith("fr") && /google|amélie|thomas|audrey/i.test(x.name)) || v.find(x => x.lang?.startsWith("fr")) || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
export function say(txt, interrupt = true) {
  window.__said?.push(txt);                       // journal pour les tests
  if (!cfg.voice || !("speechSynthesis" in window)) return;
  if (interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = "fr-FR"; if (frVoice) u.voice = frVoice; u.rate = 1.15;
  speechSynthesis.speak(u);
}
// à appeler pendant un appui : débloque le son et la voix (iOS)
export function unlockAudio() { beep(1, 0.01, 0.001); say(" "); }

/* ---------- Écran toujours allumé, du départ à la fin de la séance ---------- */
let wakeLock = null, wakeWanted = false;
export async function keepAwake() {
  wakeWanted = true;
  try {
    if (wakeLock && !wakeLock.released) return;
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {}
}
export function releaseWake() { wakeWanted = false; try { wakeLock?.release(); } catch {} wakeLock = null; }
// le système libère le verrou quand l'appli passe en arrière-plan : on le reprend au retour
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && wakeWanted) keepAwake(); });
