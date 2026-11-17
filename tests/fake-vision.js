// Remplace MediaPipe pendant les tests : un corps qui fait des flexions de bras en boucle,
// et une main ouverte quand window.__hand vaut true.
const mkL = () => {
  const t = performance.now() / 1000, f = (Math.sin(t * 2.2) + 1) / 2;
  const L = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .95 }));
  L[0] = { x: .5, y: .15, visibility: .95 }; L[11] = { x: .45, y: .25, visibility: .95 }; L[12] = { x: .55, y: .25, visibility: .95 };
  L[13] = { x: .43, y: .38, visibility: .95 }; L[14] = { x: .57, y: .38, visibility: .95 };
  const a = f * 0.85 * Math.PI;
  L[15] = { x: .43 + .07 * Math.sin(a), y: .38 + .13 * Math.cos(a), visibility: .95 }; L[16] = { x: .57 - .07 * Math.sin(a), y: .38 + .13 * Math.cos(a), visibility: .95 };
  L[23] = { x: .46, y: .55, visibility: .95 }; L[24] = { x: .54, y: .55, visibility: .95 }; L[25] = { x: .46, y: .72, visibility: .95 };
  L[26] = { x: .54, y: .72, visibility: .95 }; L[27] = { x: .46, y: .9, visibility: .95 }; L[28] = { x: .54, y: .9, visibility: .95 };
  return L;
};
const mkH = () => {
  const ar = 640 / 480, sc = .9, P = (x, y) => ({ x: .5 + x * sc / ar, y: .6 - y * sc }), h = [];
  h[0] = P(0, 0); h[1] = P(-.025, .02); h[2] = P(-.045, .04); h[3] = P(-.06, .06); h[4] = P(-.075, .08);
  [[5, -.025], [9, -.008], [13, .008], [17, .024]].forEach(([m, x], i) => { const l = [.09, .095, .09, .08][i]; h[m] = P(x, l); h[m + 1] = P(x * 1.2, l + .035); h[m + 2] = P(x * 1.35, l + .06); h[m + 3] = P(x * 1.5, l + .08); });
  return h;
};
export const PoseLandmarker = { createFromOptions: async () => ({ detectForVideo: () => ({ landmarks: [mkL()] }), close() {} }) };
export const HandLandmarker = { createFromOptions: async () => ({ detectForVideo: () => window.__hand ? { landmarks: [mkH()], handedness: [[{ score: .95 }]] } : { landmarks: [], handedness: [] }, close() {} }) };
export const FilesetResolver = { forVisionTasks: async () => ({}) };
