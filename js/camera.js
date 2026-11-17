// Séance avec caméra : détection des mouvements, comptage, séries et pauses.
// runCamera(blocs, options, fin) lance l'enchaînement ; fin(résultat) est appelée à la fin ou à l'arrêt.
// Les réglages de la séance en cours vivent dans W (jamais dans les réglages de l'appli).
import { PoseLandmarker, HandLandmarker, FilesetResolver } from "./vision.js";
import { EXOS, exoName, fmtClock } from "./data.js";
import { cfg } from "./store.js";
import { $, show, holdBtn, beep, tick, goBeep, say, vibrate, keepAwake, releaseWake, unlockAudio } from "./device.js";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const video = $("video"), canvas = $("canvas"), ctx = canvas.getContext("2d");

/* ---------- État de la séance ---------- */
let W = null;                         // bloc en cours : { exo, sets, reps, arms, load, rest }
let runList = [], blockIdx = 0, opts = {}, onEnd = null;
let reps = 0, setIdx = 1, phase = "up", smooth = null, lastRepAt = 0, history = [];
let restTotal = 1, workoutStart = 0, restTimer = null, restLeft = 0, lastStatus = "";
let running = false, setStartAt = 0;

/* ---------- Caméra + modèles ---------- */
let landmarker = null, modelKind = null, handLm = null, stream = null;
async function loadModel() {
  const want = cfg.eco ? "lite" : "full";
  if (landmarker && modelKind === want) return;
  try { landmarker?.close(); } catch {}
  landmarker = null; modelKind = want;
  const files = await FilesetResolver.forVisionTasks(WASM);
  const opts = model => ({
    baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/${model}/float16/1/${model}.task` },
    runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5
  });
  const name = want === "lite" ? "pose_landmarker_lite" : "pose_landmarker_full";
  try {   // le GPU consomme moins que le calcul sur processeur
    landmarker = await PoseLandmarker.createFromOptions(files, { ...opts(name), baseOptions: { ...opts(name).baseOptions, delegate: "GPU" } });
  } catch {
    landmarker = await PoseLandmarker.createFromOptions(files, opts("pose_landmarker_lite")); modelKind = "lite";
  }
}
async function loadHandModel() {
  if (handLm) return;
  const files = await FilesetResolver.forVisionTasks(WASM);
  const base = { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" };
  const o = d => ({ baseOptions: { ...base, delegate: d }, runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5 });
  try { handLm = await HandLandmarker.createFromOptions(files, o("GPU")); }
  catch { handLm = await HandLandmarker.createFromOptions(files, o("CPU")); }
}
async function startCamera() {
  stopCamera();
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cfg.facing, width: { ideal: cfg.eco ? 480 : 640 }, height: { ideal: cfg.eco ? 360 : 480 }, frameRate: { ideal: cfg.eco ? 15 : 24, max: 30 } }, audio: false });
  video.srcObject = stream; await video.play();
  const m = cfg.facing === "user";
  video.classList.toggle("mirror", m); canvas.classList.toggle("mirror", m);
}
function stopCamera() { stream?.getTracks().forEach(t => t.stop()); stream = null; try { video.srcObject = null; } catch {} }
const useHand = () => !!handLm && cfg.trigger === "hand";
// appli en arrière-plan : vidéo en pause (plus d'analyse), reprise au retour
document.addEventListener("visibilitychange", () => {
  if (!running || !stream) return;
  if (document.visibilityState === "hidden") { try { video.pause(); } catch {} }
  else if (!restTimer || useHand()) video.play().catch(() => {});
});

/* ---------- Signal main : main ouverte face à l'écran, 5 doigts écartés, immobile ---------- */
const HAND_MIN = 0.045;     // taille minimale de la paume (poignet → base du majeur), en hauteur d'image
const HAND_HOLD = 1200;     // durée à tenir (ms)
function palmCheck(h, score = 1) {
  const ar = video.videoWidth / video.videoHeight || 1;
  const d = (a, b) => Math.hypot((h[a].x - h[b].x) * ar, h[a].y - h[b].y);
  const palm = d(0, 9);
  if (score < 0.75) return { ok: false, why: "unsure" };
  if (palm < HAND_MIN) return { ok: false, why: "small", palm };
  const fingers = [[8, 6], [12, 10], [16, 14], [20, 18]].every(([t, p]) => d(0, t) > d(0, p) * 1.2);
  const thumb = d(0, 4) > d(0, 3) && d(4, 5) > palm * 0.45;
  const facing = d(5, 17) > palm * 0.45;          // paume vue de face, pas de profil
  const spread = d(8, 20) > d(5, 17) * 1.1;       // doigts écartés
  const upright = h[12].y < h[0].y;               // doigts vers le haut
  if (!upright) return { ok: false, why: "upright", palm };
  if (!facing) return { ok: false, why: "facing", palm };
  if (!(fingers && thumb && spread)) return { ok: false, why: "fingers", palm };
  return { ok: true, palm };
}
let waitingHand = false, openSince = 0, handAnchor = null;
function handSignal(ts) {
  const hr = handLm.detectForVideo(video, ts);
  const hands = hr.landmarks || [];
  const checks = hands.map((h, i) => ({ h, c: palmCheck(h, hr.handedness?.[i]?.[0]?.score ?? 1) }));
  const best = checks.find(x => x.c.ok) || checks.sort((a, b) => (b.c.palm || 0) - (a.c.palm || 0))[0];
  let good = best?.c.ok ? best.h : null, why = best ? best.c.why : "none";
  if (good) {                                     // immobilité : le poignet ne doit pas bouger de plus d'une demi-paume
    const w = good[0], tol = (best.c.palm || 0.05) * 0.5;
    if (handAnchor && Math.hypot(w.x - handAnchor.x, w.y - handAnchor.y) > tol) { handAnchor = { x: w.x, y: w.y }; good = null; why = "moving"; }
    else if (!handAnchor) handAnchor = { x: w.x, y: w.y };
  } else handAnchor = null;
  return { hands, good, why };
}
const HAND_MSG = { none: "Montre ta main ouverte face à l'écran", unsure: "Montre ta main ouverte face à l'écran", small: "Approche ta main de la caméra",
  upright: "Doigts vers le haut", facing: "Paume face à la caméra", fingers: "Écarte bien les 5 doigts", moving: "Garde la main immobile" };
function restHandStep(ts) {
  const { good } = handSignal(ts);
  $("restHand").classList.toggle("ok", !!good);
  if (good) {
    openSince ||= ts;
    const prog = Math.min(1, (ts - openSince) / HAND_HOLD);
    $("restHandBar").style.width = (prog * 100) + "%";
    if (prog >= 1) { openSince = 0; $("restHandBar").style.width = "0%"; say("C'est reparti"); nextSet(); }
  } else { openSince = 0; $("restHandBar").style.width = "0%"; }
}
function handStep(ts) {
  const { hands, good, why } = handSignal(ts);
  drawPoints(hands.flat(), good ? "#3ddc84" : "#ffb020");
  $("count").innerHTML = "✋";
  setStatus(good ? "Parfait, ne bouge plus…" : HAND_MSG[why] || HAND_MSG.none);
  $("angle").textContent = "";
  if (good) {
    openSince ||= ts;
    const prog = Math.min(1, (ts - openSince) / HAND_HOLD);
    $("phaseFill").style.width = (prog * 100) + "%"; $("phaseFill").style.background = "var(--acc)";
    if (prog >= 1) {                             // signal validé : on lance le délai de départ
      waitingHand = false; openSince = 0; lastCd = -1;
      armDelayEnd = ts + cfg.delay * 1000; anchorY = null;
      beep(1200, 0.25); say(cfg.delay ? `Go ! Départ dans ${cfg.delay} secondes` : "Go !");
      $("phaseFill").style.width = "0%";
    }
  } else { openSince = 0; $("phaseFill").style.width = "0%"; }
}

/* ---------- Comptage ---------- */
// Repères MediaPipe : 11/12 épaules, 13/14 coudes, 15/16 poignets, 23/24 hanches, 25/26 genoux, 27/28 chevilles
function angle(a, b, c) {
  const ab = Math.atan2(a.y - b.y, a.x - b.x), cb = Math.atan2(c.y - b.y, c.x - b.x);
  const d = Math.abs((ab - cb) * 180 / Math.PI); return d > 180 ? 360 - d : d;
}
const vis = (...p) => Math.min(...p.map(x => x.visibility ?? 0));
const clamp = x => Math.max(0, Math.min(1, x));
function setStatus(t) { if (t !== lastStatus) { $("status").textContent = t; lastStatus = t; } }
const isSplit = () => W.exo === "curls" && W.arms === "sep";
let armReps = { L: 0, R: 0 }, lastArm = "L";
function updateCount() {
  const c = $("count");
  c.classList.toggle("split", isSplit());
  if (isSplit()) {
    const f = k => `<span class="${W.reps && armReps[k] >= W.reps ? "done" : ""}">${k === "L" ? "G" : "D"} ${armReps[k]}</span>`;
    c.innerHTML = `${f("L")} · ${f("R")}<small>${W.reps ? "/" + W.reps : " max"}</small>`;
  } else if (EXOS[W.exo].timed) c.innerHTML = `${reps}<small>${W.reps ? "/" + W.reps : ""} s</small>`;
  else c.innerHTML = `${reps}<small>${W.reps ? "/" + W.reps : " max"}</small>`;
}
function addArmRep(k, auto = true) {
  if (W.reps && armReps[k] >= W.reps) { if (!auto) beep(300, 0.1, 0.2); return; }
  armReps[k]++; reps = armReps.L + armReps.R; lastArm = k; updateCount();
  const name = k === "L" ? "gauche" : "droite", n = armReps[k];
  lastRepAt = performance.now();
  if (!W.reps) { say(`${n} ${name}`); if (!auto) beep(700, 0.08, 0.2); return; }
  if (armReps.L >= W.reps && armReps.R >= W.reps) { say(`${n} ${name}. Série terminée !`); beep(1200, 0.4); finishSet(); return; }
  if (n >= W.reps) { say(`${n}. Bras ${name} terminé, change de bras`); beep(1000, 0.25); return; }
  const left = W.reps - n;
  say(left <= 3 ? `${n} ${name}. Encore ${left}` : `${n} ${name}`);
  if (!auto) beep(700, 0.08, 0.2);
}
function updateSet() { $("setInfo").textContent = `${exoName(W.exo)} · Série ${setIdx}/${W.sets}${runList.length > 1 ? ` · Ex. ${blockIdx + 1}/${runList.length}` : ""}`; }
function addRep(auto = true) {
  if (isSplit()) return addArmRep(lastArm, auto);
  reps++; updateCount(); tempoCheck();
  if (!W.reps) { say(String(reps)); if (!auto) beep(700, 0.08, 0.2); return; }
  if (reps >= W.reps) { say(`${reps}. Série terminée !`); beep(1200, 0.4); finishSet(); return; }
  const left = W.reps - reps;
  say(left <= 3 && left > 0 ? `${reps}. Encore ${left}` : String(reps));
  if (!auto) beep(700, 0.08, 0.2);
}
// Une répétition = rester au-delà de 85 % au moins 0,2 s, puis revenir sous 25 %, avec une durée minimale
function stepDet(D, val, ok, now, minRep) {
  if (!ok) { D.hi = 0; return false; }
  if (D.phase === "up") {
    if (val >= 0.85) { D.hi ||= now; if (now - D.hi >= 200) { D.phase = "down"; D.downAt = D.hi; } }
    else D.hi = 0;
  } else if (val <= 0.25) { D.phase = "up"; D.hi = 0; return now - D.downAt >= minRep; }
  return false;
}
// Curls gauche / droite : un suivi complet par bras
const newArm = ids => ({ coach: { max: 0, on: false, last: 0 }, ids, sm: null, sH: null, dRef: null, A: { phase: "up", hi: 0, downAt: 0 }, H: { phase: "up", hi: 0, downAt: 0 }, last: 0 });
let armsT = { L: newArm([11, 13, 15]), R: newArm([12, 14, 16]) };
function armsStep(lm, now, X) {
  const ar = video.videoWidth / video.videoHeight || 1;
  let anyDown = false, seen = 0;
  for (const k of ["L", "R"]) {
    const T = armsT[k], [s, e, w] = T.ids.map(i => lm[i]);
    if (vis(s, e, w) < 0.6) { T.A.hi = T.H.hi = 0; continue; }
    seen++;
    const ang = angle({ x: s.x * ar, y: s.y }, { x: e.x * ar, y: e.y }, { x: w.x * ar, y: w.y });
    T.sm = T.sm == null ? ang : T.sm * 0.75 + ang * 0.25;
    const pA = clamp((X.angUp - T.sm) / (X.angUp - X.angDown));
    const d = w.y - s.y;
    T.sH = T.sH == null ? d : T.sH * 0.75 + d * 0.25;
    if (T.dRef == null) T.dRef = T.sH; else T.dRef += (T.sH - T.dRef) * (T.sH > T.dRef ? 0.03 : 0.002);
    const pH = T.dRef > 0.04 ? clamp((1 - T.sH / T.dRef) / X.drop) : 0;
    const dA = stepDet(T.A, pA, true, now, X.minRep), dH = stepDet(T.H, pH, true, now, X.minRep);
    coachStep(T.coach, Math.max(pA, pH), T.A.phase === "down" || T.H.phase === "down", now, X);
    if ((dA || dH) && now - T.last >= X.minGap) { T.last = now; T.A.phase = T.H.phase = "up"; T.A.hi = T.H.hi = 0; addArmRep(k); }
    if (T.A.phase === "down" || T.H.phase === "down") anyDown = true;
  }
  if (!seen) { setStatus(X.hidden); return; }
  const wasDown = phase === "down";
  phase = anyDown ? "down" : "up";
  if (!wasDown && phase === "down") beep(520, 0.05, 0.12);
  setStatus(phase === "up" ? X.go : X.push);
}

// Deux détecteurs indépendants : angle de l'articulation (vue de profil) et déplacement des mains
// par rapport aux épaules (marche aussi de face). Le premier qui valide une répétition la compte.
let dRef = null, sH = null, armStart = 0, prevLm = null;
const det = { A: { phase: "up", hi: 0, downAt: 0 }, H: { phase: "up", hi: 0, downAt: 0 } };
let armed = false, armDelayEnd = 0, stillSince = 0, anchorY = null, lastCd = -1;
function process(res) {
  const now = performance.now();
  if (!armed && now < armDelayEnd) {           // compte à rebours : le temps de poser le téléphone
    const sec = Math.ceil((armDelayEnd - now) / 1000);
    setStatus("Pose le téléphone et mets-toi en position");
    $("count").innerHTML = `${sec}<small>s</small>`;
    $("placeTip").classList.add("on");
    if (sec !== lastCd) { lastCd = sec; if (sec <= 3) tick(); }
    dRef = sH = smooth = null; anchorY = null; stillSince = now;
    $("phaseFill").style.width = "0%"; $("angle").textContent = "";
    return;
  }
  $("placeTip").classList.remove("on");
  const lm = res.landmarks?.[0];
  if (!lm) { setStatus("Je ne te vois pas : recule un peu"); $("angle").textContent = ""; return; }
  const ar = video.videoWidth / video.videoHeight || 1;
  const X = EXOS[W.exo];
  if (X.timed) { plankStep(lm, now, X); return; }
  const MINV = 0.6;                              // points peu fiables ignorés
  let sides = X.joints.map(ix => ({ ix, v: vis(...ix.map(i => lm[i])) })).sort((a, b) => b.v - a.v);
  if (X.perSide) {                               // le côté le plus avancé dans le mouvement parmi les côtés visibles
    const prog = a => clamp((X.angUp - a) / (X.angUp - X.angDown));
    const ok = sides.filter(sd => sd.v >= MINV).map(sd => ({ ...sd, a: angle(...sd.ix.map(i => ({ x: lm[i].x * ar, y: lm[i].y }))) }));
    if (ok.length) sides = ok.sort((a, b) => prog(b.a) - prog(a.a));
  }
  const goodY = ids => { const ok = ids.map(i => lm[i]).filter(q => (q.visibility ?? 0) >= MINV); return ok.length ? ok.reduce((t, q) => t + q.y, 0) / ok.length : null; };
  let shY = goodY(X.top), wrY = goodY(X.bottom);
  if (X.perSide) {                               // on suit le bras le plus haut (marche aussi en alterné)
    const ds = [[X.top[0], X.bottom[0]], [X.top[1], X.bottom[1]]]
      .filter(([t, b]) => (lm[t].visibility ?? 0) >= MINV && (lm[b].visibility ?? 0) >= MINV)
      .map(([t, b]) => ({ t: lm[t].y, b: lm[b].y })).sort((a, b) => (a.b - a.t) - (b.b - b.t));
    if (ds.length) { shY = ds[0].t; wrY = ds[0].b; } else shY = wrY = null;
  }
  let torso = null;
  if (X.hMode === "rise") {                      // échelle du corps : distance épaules–hanches
    const avg = ids => { const ok = ids.map(i => lm[i]).filter(q => (q.visibility ?? 0) >= MINV); return ok.length ? { x: ok.reduce((t, q) => t + q.x, 0) / ok.length, y: ok.reduce((t, q) => t + q.y, 0) / ok.length } : null; };
    const sh = avg(X.top), hp = avg(X.hips);
    if (sh && hp) torso = Math.hypot((sh.x - hp.x) * ar, sh.y - hp.y);
    if (!torso || torso < 0.05) torso = null;
  }
  const angOk = sides[0].v >= MINV, hOk = shY != null && wrY != null && (X.hMode !== "rise" || torso != null);
  if (!angOk && !hOk) { setStatus(X.hidden); $("angle").textContent = ""; return; }   // on garde l'état, on ne compte rien

  // Détecteur 1 : angle de l'articulation (corrigé du format de l'image)
  let pA = 0;
  if (angOk) {
    const [S, E, Wr] = sides[0].ix.map(i => ({ x: lm[i].x * ar, y: lm[i].y }));
    const ang = angle(S, E, Wr);
    smooth = smooth == null ? ang : smooth * 0.75 + ang * 0.25;
    pA = clamp((X.angUp - smooth) / (X.angUp - X.angDown));
  }
  // Détecteur 2 : position des mains par rapport aux épaules, comparée à la position de départ
  let pH = 0;
  if (hOk && X.hMode === "rise") {               // montée des mains, en longueurs de buste
    const r = (shY - wrY) / torso;
    sH = sH == null ? r : sH * 0.75 + r * 0.25;
    pH = clamp((sH - X.rise0) / (X.rise1 - X.rise0));
  } else if (hOk) {
    const d = wrY - shY;
    sH = sH == null ? d : sH * 0.75 + d * 0.25;
    if (dRef == null) dRef = sH;
    else dRef += (sH - dRef) * (sH > dRef ? 0.03 : 0.002);   // référence lente : un saut parasite ne la fausse pas
    if (dRef > 0.04) pH = clamp((1 - sH / dRef) / X.drop);
  }

  const p = Math.max(pA, pH);
  $("phaseFill").style.width = (p * 100) + "%";
  $("phaseFill").style.background = p >= 0.85 ? "var(--acc)" : "var(--warn)";
  $("angle").textContent = `${angOk && smooth != null ? X.joint + " " + Math.round(smooth) + "° · " : ""}Amplitude ${Math.round(p * 100)}%`;

  if (!armed) {                                  // attend une position stable
    det.A.phase = det.H.phase = phase = "up"; det.A.hi = det.H.hi = 0;
    if (lastCd !== 0) {                          // fin du compte à rebours
      if (armDelayEnd && lastCd > 0) goBeep();
      lastCd = 0; armStart = now; updateCount(); say(X.ready.replace("…", ""));
    }
    if (shY == null || anchorY == null || Math.abs(shY - anchorY) > 0.05) { anchorY = shY; stillSince = now; }
    if (p > 0.4) stillSince = now;
    setStatus(X.ready);
    if (now - stillSince > 700 || now - armStart > 4000) {
      armed = true; setStartAt = Date.now(); dRef = sH; updateCount(); beep(1200, 0.25); say("C'est parti"); coach = { max: 0, on: false, last: 0 };
      armsT = { L: newArm([11, 13, 15]), R: newArm([12, 14, 16]) };
    }
    return;
  }
  if (!W.reps && reps > 0 && now - lastRepAt > 8000) { say("Série terminée"); beep(1200, 0.4); finishSet(); return; }   // mode max : 8 s sans répétition
  if (isSplit()) { armsStep(lm, now, X); return; }
  coachStep(coach, p, phase === "down", now, X);
  const doneA = stepDet(det.A, pA, angOk, now, X.minRep), doneH = stepDet(det.H, pH, hOk, now, X.minRep);
  const wasDown = phase === "down";
  phase = (det.A.phase === "down" || det.H.phase === "down") ? "down" : "up";
  if (!wasDown && phase === "down") beep(520, 0.05, 0.12);
  setStatus(phase === "up" ? (X.go || "Descends ⬇") : X.push);
  if ((doneA || doneH) && now - lastRepAt >= X.minGap) {
    lastRepAt = now; det.A.phase = det.H.phase = phase = "up"; det.A.hi = det.H.hi = 0;
    addRep();
  }
}
// Coach d'amplitude : mouvement engagé à plus de 50 % puis abandonné avant le seuil de validation (85 %)
let flashUntil = 0, coach = { max: 0, on: false, last: 0 };
function coachStep(C, p, reached, now, X) {
  if (reached) { C.on = false; C.max = 0; return; }
  if (p > 0.5) { C.on = true; C.max = Math.max(C.max, p); }
  if (C.on && p < 0.2) {
    if (C.max < 0.85) {                            // répétition incomplète : rien n'est compté
      flashUntil = now + 700;                      // flash orange du squelette
      if (now - C.last > 2500) { say(X.short || "Plus bas", false); C.last = now; }
    }
    C.on = false; C.max = 0;
  }
}
// Tempo : alerte si les répétitions deviennent nettement plus rapides qu'en début de série
let setDurs = [], prevRepAt = 0, tempoWarned = false;
function tempoCheck() {
  const now = performance.now();
  if (prevRepAt) setDurs.push(now - prevRepAt);
  prevRepAt = now;
  if (setDurs.length >= 4 && !tempoWarned) {
    const base = setDurs.slice(0, 3).sort((a, b) => a - b)[1], last = setDurs[setDurs.length - 1];
    if (last < base * 0.55) { tempoWarned = true; setTimeout(() => say("Ralentis, contrôle le mouvement", false), 600); }
  }
}
// Planche : corps droit (épaule–hanche–cheville) et à l'horizontale ; le chrono n'avance qu'en position
let holdMs = 0, lastTick = 0, inSince = 0, outSince = 0, outWarned = false;
function plankPose(lm) {
  const ar = video.videoWidth / video.videoHeight || 1;
  const sides = [[11, 23, 27, 25], [12, 24, 28, 26]].map(ix => ({ ix, v: vis(lm[ix[0]], lm[ix[1]]) })).sort((a, b) => b.v - a.v);
  const [s, h, a, k] = sides[0].ix.map(i => lm[i]);
  if (sides[0].v < 0.5) return { vis: false };
  const end = (a.visibility ?? 0) >= 0.5 ? a : (k.visibility ?? 0) >= 0.5 ? k : null;
  if (!end) return { vis: false };
  const P = q => ({ x: q.x * ar, y: q.y });
  const straight = angle(P(s), P(h), P(end)) > 150;
  const tilt = Math.atan2(Math.abs(end.y - s.y), Math.abs(end.x - s.x) * ar) * 180 / Math.PI;
  return { vis: true, inPos: straight && tilt < 40 };
}
function plankStep(lm, now, X) {
  const pos = plankPose(lm);
  if (!armed) {
    if (lastCd !== 0) { if (armDelayEnd && lastCd > 0) goBeep(); lastCd = 0; inSince = 0; updateCount(); say("Mets-toi en planche"); }
    setStatus(pos.vis ? "Mets-toi en planche, corps droit" : X.hidden);
    if (pos.vis && pos.inPos) { inSince ||= now; if (now - inSince > 800) { armed = true; setStartAt = Date.now(); holdMs = 0; lastTick = now; outSince = 0; outWarned = false; beep(1200, 0.25); say("C'est parti, tiens bon"); } }
    else inSince = 0;
    return;
  }
  const dt = Math.min(now - lastTick, 200); lastTick = now;
  if (pos.vis && pos.inPos) { holdMs += dt; outSince = 0; outWarned = false; setStatus("Tiens la position"); }
  else {
    outSince ||= now;
    setStatus(pos.vis ? "Corps pas droit : remets-toi en position" : X.hidden);
    if (now - outSince > 1500 && !outWarned) { outWarned = true; say("Remets-toi en position"); }
    if (!W.reps && reps > 0 && now - outSince > 3000) { say(`Terminé, ${reps} secondes`); beep(1200, 0.4); finishSet(); return; }
  }
  const sec = Math.floor(holdMs / 1000);
  $("phaseFill").style.width = (W.reps ? Math.min(1, holdMs / (W.reps * 1000)) * 100 : 0) + "%";
  $("phaseFill").style.background = "var(--acc)";
  $("angle").textContent = pos.inPos ? "Position OK" : "Hors position";
  if (sec !== reps) {
    reps = sec; updateCount();
    const left = W.reps - sec;
    if (W.reps && sec >= W.reps) { say("Terminé !"); beep(1200, 0.4); finishSet(); return; }
    if (W.reps && left <= 5) say(String(left));
    else if (sec % 10 === 0) say(`${sec} secondes`);
  }
}

/* ---------- Dessin ---------- */
// Placement du squelette : identique à l'affichage de la vidéo
function videoBox(cw, ch, vw, vh) {
  if (matchMedia("(orientation: landscape)").matches) {
    const s = Math.min(cw / vw, ch / vh), w = vw * s;
    const mirrored = video.classList.contains("mirror");
    return { s, ox: mirrored ? cw - w : 0, oy: (ch - vh * s) / 2 };   // calée à gauche à l'écran (miroir compris)
  }
  const s = Math.max(cw / vw, ch / vh);
  return { s, ox: (cw - vw * s) / 2, oy: (ch - vh * s) / 2 };
}
function fitCanvas() {
  const dpr = Math.min(devicePixelRatio, 2);       // au-delà de 2×, le squelette n'est pas plus net à l'œil
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}
function drawPoints(pts, color) {
  fitCanvas(); ctx.clearRect(0, 0, canvas.width, canvas.height);
  const vw = video.videoWidth, vh = video.videoHeight, { s, ox, oy } = videoBox(canvas.width, canvas.height, vw, vh);
  ctx.fillStyle = color;
  for (const p of pts) { ctx.beginPath(); ctx.arc(p.x * vw * s + ox, p.y * vh * s + oy, 4 * devicePixelRatio, 0, 7); ctx.fill(); }
}
const SKEL = [[11,13],[13,15],[12,14],[14,16],[11,12],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
function draw(lm) {
  fitCanvas(); ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lm) return;
  const vw = video.videoWidth, vh = video.videoHeight, { s, ox, oy } = videoBox(canvas.width, canvas.height, vw, vh);
  const P = p => [p.x * vw * s + ox, p.y * vh * s + oy];
  const flash = performance.now() < flashUntil;
  ctx.lineWidth = (flash ? 6 : 4) * devicePixelRatio; ctx.strokeStyle = flash ? "#fb923ce6" : "#3ddc84cc"; ctx.fillStyle = flash ? "#fdba74" : "#fff";
  if (flash) { ctx.shadowColor = "#fb923c"; ctx.shadowBlur = 18 * devicePixelRatio; } else ctx.shadowBlur = 0;
  for (const [i, j] of SKEL) {
    if ((lm[i].visibility ?? 0) < 0.4 || (lm[j].visibility ?? 0) < 0.4) continue;
    const [x1, y1] = P(lm[i]), [x2, y2] = P(lm[j]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  for (const k of [11,12,13,14,15,16,23,24,25,26,27,28]) {
    if ((lm[k].visibility ?? 0) < 0.4) continue;
    const [x, y] = P(lm[k]); ctx.beginPath(); ctx.arc(x, y, 5 * devicePixelRatio, 0, 7); ctx.fill();
  }
}

/* ---------- Boucle d'analyse : 20 images/s (12 en mode éco), largement assez pour compter ---------- */
let lastTs = -1, lastInfer = 0;
function loop() {
  if (!running) return;
  requestAnimationFrame(loop);
  if (paused) return;
  const now = performance.now();
  if (now - lastInfer < 1000 / (cfg.eco ? 12 : 20) - 4) return;
  lastInfer = now;
  if (video.readyState < 2 || now <= lastTs) return;
  lastTs = now;
  if (restTimer) { if (useHand()) restHandStep(now); return; }
  if (waitingHand) { handStep(now); return; }
  const res = landmarker.detectForVideo(video, now);
  const cur = res.landmarks?.[0];                // lissage des points pour éviter que le squelette tremble
  if (cur && prevLm) for (let i = 0; i < cur.length; i++) { cur[i].x = prevLm[i].x * 0.6 + cur[i].x * 0.4; cur[i].y = prevLm[i].y * 0.6 + cur[i].y * 0.4; }
  prevLm = cur ? cur.map(p => ({ x: p.x, y: p.y })) : null;
  process(res); draw(cur);
}

/* ---------- Séries et pauses ---------- */
// Tonnage : charge × répétitions (×2 si deux haltères soulevés ensemble)
function tonnageOf(n, split) {
  const X = EXOS[W.exo];
  if (!X?.load || !W.load) return 0;
  return W.load * n * (X.load === "dumbbell" && !split ? 2 : 1);
}
function pushSet() {
  const best = isSplit() ? Math.max(armReps.L, armReps.R) : reps;
  const sec = setStartAt ? Math.round((Date.now() - setStartAt) / 1000) : 0; setStartAt = 0;
  const target = W.reps ? W.reps * (isSplit() ? 2 : 1) : 0, kg = EXOS[W.exo]?.load ? W.load || 0 : 0;
  history.push({ target, exo: W.exo, n: reps, best, sec, kg, ton: tonnageOf(reps, isSplit()), txt: (isSplit() ? `G ${armReps.L} · D ${armReps.R}` : `${reps}`) + (kg ? ` · ${kg} kg` : "") });
  const recs = opts.recs || {};
  if (best > 0 && recs[W.exo] > 0 && best > recs[W.exo]) { setTimeout(() => say("Nouveau record !", false), 1200); setTimeout(() => vibrate([80, 60, 80, 60, 300]), 1200); }
  recs[W.exo] = Math.max(recs[W.exo] || 0, best);
}
function finishSet() {
  vibrate([200, 100, 200]);
  pushSet();
  if (setIdx >= W.sets && blockIdx >= runList.length - 1) { endWorkout(false); return; }
  startRest();
}
function startRest() {
  restLeft = restTotal = W.rest; $("rest").classList.add("on");
  $("restHand").classList.toggle("on", useHand()); openSince = 0;
  if (!useHand()) { try { video.pause(); } catch {} ctx.clearRect(0, 0, canvas.width, canvas.height); }
  const newBlock = setIdx >= W.sets, nb = newBlock ? runList[blockIdx + 1] : W;
  const unit = EXOS[nb.exo]?.timed ? "s" : "reps", perArm = nb.exo === "curls" && nb.arms === "sep" ? " / bras" : "";
  $("restNext").innerHTML = `<div><div class="nc-k">${newBlock ? "Exercice suivant" : "Prochaine série"}</div><div class="nc-v">${exoName(nb.exo)} · ${nb.reps || "max"} ${unit}${perArm}</div></div><div class="nc-n">${newBlock ? 1 : setIdx + 1}<small>/${nb.sets}</small></div>`;
  renderRest();
  restTimer = setInterval(restTick, 1000);
  setTimeout(() => say(`Pause, ${W.rest} secondes${newBlock ? ". Ensuite : " + exoName(nb.exo) : ""}`, false), 900);
}
function restTick() {
  restLeft--; renderRest();
  if (restLeft === 10) { say("Dix secondes"); beep(660, 0.15); }
  if (restLeft > 0 && restLeft <= 3) tick();
  if (restLeft <= 0) nextSet();
}
function renderRest() {
  const m = Math.floor(restLeft / 60), s = restLeft % 60;
  $("restTime").textContent = m ? `${m}:${String(s).padStart(2, "0")}` : s;
  restTotal = Math.max(restTotal, restLeft);
  $("restRing").style.strokeDashoffset = 339.29 * (1 - restLeft / restTotal);
}
function resetSet() {
  reps = 0; armReps = { L: 0, R: 0 }; phase = "up"; smooth = null; dRef = sH = null; armed = false; armDelayEnd = 0; anchorY = null; lastCd = -1;
  setDurs = []; prevRepAt = 0; tempoWarned = false; setStartAt = 0;
}
function nextSet() {
  if (video.paused && stream) video.play().catch(() => {});
  clearInterval(restTimer); restTimer = null; $("rest").classList.remove("on");
  const newBlock = setIdx >= W.sets;
  if (newBlock) { blockIdx++; W = runList[blockIdx]; setIdx = 1; setTip(); } else setIdx++;
  resetSet(); updateCount(); updateSet(); goBeep();
  say(newBlock ? `${exoName(W.exo)}, série 1, mets-toi en position` : `Série ${setIdx}, mets-toi en position`);
}
const setTip = () => $("placeTip").innerHTML = EXOS[W.exo].tip;
$("restSkip").onclick = () => nextSet();
$("restPlus").onclick = () => { restLeft += 15; renderRest(); };
$("restMinus").onclick = () => { restLeft = Math.max(1, restLeft - 15); renderRest(); };
$("plusBtn").onclick = () => addRep(false);
$("minusBtn").onclick = () => {
  if (isSplit()) { if (armReps[lastArm] > 0) { armReps[lastArm]--; reps = armReps.L + armReps.R; updateCount(); beep(400, 0.08, 0.2); } return; }
  if (reps > 0) { reps--; updateCount(); beep(400, 0.08, 0.2); }
};
$("endSetBtn").onclick = () => { resumeWorkout(true); say("Série terminée"); finishSet(); };
holdBtn($("stopBtn"), 900, () => { resumeWorkout(true); if (reps > 0 && !restTimer) pushSet(); endWorkout(true); });

/* ---------- Pause ---------- */
let paused = false, pauseAt = 0, pausedTotal = 0, restWasRunning = false;
function pauseWorkout() {
  if (paused || !running) return;
  paused = true; pauseAt = performance.now();
  restWasRunning = !!restTimer;
  if (restTimer) { clearInterval(restTimer); restTimer = "paused"; }
  $("endSetBtn").style.display = restWasRunning ? "none" : "";
  $("pauseOv").classList.add("on"); say("Pause"); renderElapsed();
}
function resumeWorkout(silent) {
  if (!paused) return;
  const dt = performance.now() - pauseAt; paused = false; pausedTotal += dt;
  if (armDelayEnd) armDelayEnd += dt;          // le compte à rebours reprend où il en était
  lastRepAt = lastTick = stillSince = performance.now();
  if (restWasRunning) { restTimer = setInterval(restTick, 1000); restWasRunning = false; }
  $("pauseOv").classList.remove("on"); if (!silent) say("C'est reparti");
}
$("pauseBtn").onclick = pauseWorkout;
$("restPause").onclick = pauseWorkout;
$("resumeBtn").onclick = () => resumeWorkout();
// chrono de séance, hors pauses
const activeMs = () => (Date.now() - workoutStart) - pausedTotal - (paused ? performance.now() - pauseAt : 0);
function renderElapsed() {
  if (!workoutStart) return;
  $("elapsed").textContent = fmtClock(activeMs());
  if (paused) $("poTime").textContent = fmtClock(activeMs());
}
setInterval(() => { if (running) renderElapsed(); }, 1000);

function endWorkout(stopped) {
  if (!running && !workoutStart) return;
  running = false; waitingHand = false; clearInterval(restTimer); restTimer = null; $("rest").classList.remove("on");
  stopCamera(); releaseWake();
  const r = { history: history.slice(), start: workoutStart, dur: Date.now() - workoutStart, activeMs: activeMs(), stopped };
  workoutStart = 0;
  onEnd?.(r);
}

/* ---------- Démarrage ---------- */
// blocks : [{ exo, sets, reps, arms, load, rest }] ; options : { recs } (records avant la séance)
export async function runCamera(blocks, options, done) {
  unlockAudio(); keepAwake();                   // dès l'appui : délai, caméra et pauses compris
  runList = blocks.map(b => ({ ...b })); blockIdx = 0; W = runList[0]; opts = options || {}; onEnd = done;
  setIdx = 1; history = []; resetSet(); setTip();
  paused = false; pausedTotal = 0; $("pauseOv").classList.remove("on"); $("rest").classList.remove("on"); $("elapsed").textContent = "0:00";
  updateCount(); updateSet(); show("workout"); workoutStart = Date.now();
  $("loading").classList.add("on"); $("loadErr").textContent = "";
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Caméra indisponible : ouvre la page en https.");
    await Promise.all([startCamera(), loadModel(), cfg.trigger === "hand" ? loadHandModel().catch(() => {}) : null]);
  } catch (e) {
    releaseWake(); stopCamera(); workoutStart = 0;
    $("loadErr").innerHTML = `Impossible de démarrer : ${e.message || e}`;
    return;
  }
  $("loading").classList.remove("on");
  running = true; armed = false; lastCd = -1;
  if (useHand()) { waitingHand = true; openSince = 0; armDelayEnd = 0; say("Montre ta main ouverte pour démarrer"); }
  else { waitingHand = false; armDelayEnd = performance.now() + cfg.delay * 1000; say(cfg.delay ? `Départ dans ${cfg.delay} secondes` : "Mets-toi en position"); }
  requestAnimationFrame(loop);
}
