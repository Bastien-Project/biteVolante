// ============ Bite volante =============
// Images : dossier "image/" (.jpg)   |   Sons : dossier "son/" (.mp3)
// Pour bite.jpg et chatte.jpg : le NOIR du fond devient transparent (mode "screen").
//   bite.jpg  = bite vue de dessus
//   chatte.jpg = chatte découpée, vue de face
//                Si l'image a un fond noir au lieu d'être transparente, mettre fusion: "screen" dans CHATTE.

// ====== Niveaux et images à gagner ======
// Un niveau est terminé quand toutes ses images sont débloquées : le niveau suivant démarre alors.
//   at      = nombre de chatte à traverser (dans une même partie) pour gagner l'image
//   file    = chemin du .jpg dans le dossier image/ (sans ".jpg")
//   vitesse = multiplicateur de vitesse du niveau (1 = normal)
//   fond    = (facultatif) image de fond du niveau, par défaut "niveauN/fond" -> image/niveauN/fond.jpg
//             Elle sert aussi de fond à l'écran d'accueil quand c'est le niveau en cours.
const NIVEAUX = [
  {
    nom: "Niveau 1", vitesse: 1, images: [
      { at: 5, file: "niveau1/recompense1" }, { at: 12, file: "niveau1/recompense2" },
      { at: 20, file: "niveau1/recompense3" }, { at: 30, file: "niveau1/recompense4" },
      { at: 45, file: "niveau1/recompense5" }, { at: 60, file: "niveau1/recompense6" }]
  },
  {
    nom: "Niveau 2", vitesse: 1, images: [
      { at: 6, file: "niveau2/recompense1" }, { at: 15, file: "niveau2/recompense2" },
      { at: 25, file: "niveau2/recompense3" }, { at: 40, file: "niveau2/recompense4" },
      { at: 55, file: "niveau2/recompense5" }, { at: 70, file: "niveau2/recompense6" }]
  },
  {
    nom: "Niveau 3", vitesse: 1, images: [
      { at: 8, file: "niveau3/recompense1" }, { at: 18, file: "niveau3/recompense2" },
      { at: 30, file: "niveau3/recompense3" }, { at: 45, file: "niveau3/recompense4" },
      { at: 60, file: "niveau3/recompense5" }, { at: 80, file: "niveau3/recompense6" }]
  }
];
// =============================================================

// ====== Réglages de la bite et des chattes ======
// h = hauteur affichée de la bite ; hw = demi-largeur de collision ;
// base = position verticale de la sortie des flammes (fraction de la hauteur, depuis le centre)
// ====== Vitesse du jeu (valeurs identiques à toutes les versions précédentes) ======
// depart = vitesse à la premiere chatte
// accel =  gain par chatte passé
// max =    plafond (en pixels/seconde)
const VITESSE = { depart: 170, accel: 26, max: 720 };

const BITE = { h: 128, hw: 18, base: 0.46 };
// Réglages de la chatte (mesurés sur l'image 548×456)
//   ouv     = largeur du passage à la « ligne de passage » (fraction de la largeur de l'image)
//   cx      = position horizontale du centre du passage (fraction de la largeur, 0.5 = milieu)
//   ligne   = hauteur de la ligne de passage (fraction de la hauteur de l'image, 0 = haut)
//   hscale  = écrasement vertical de la chatte (1 = taille d'origine, plus petit = moins haute)
//   fondu   = hauteur du fondu du haut de la chatte (fraction de la hauteur de l'image ; 0 = aucun fondu, coupe nette).
//   retourne = true pour retourner la chatte verticalement
//   fusion  = "normal" (image transparente) ou "screen" (fond noir = transparent)
// La bite doit passer dans la chatte au moment où la ligne de passage croise sa position.
const CHATTE = { ouv: 0.33, cx: 0.497, ligne: 0.1, hscale: 0.7, fondu: 0, retourne: false, fusion: "normal" };

const cv = document.getElementById("c"), ctx = cv.getContext("2d");
let W, H, u, dpr;
function rs() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  u = Math.max(.5, Math.min(H / 700, W / 380));
}
addEventListener("resize", rs); rs();

// ---------- Images (.jpg) ----------
const DIR_IMG = "image/", DIR_SND = "son/";
function loadImg(name) { const i = new Image(); i.src = DIR_IMG + name + ".jpg"; return i; }
const ready = i => i && i.complete && i.naturalWidth > 0;
const BITE_IMG = loadImg("bite"), CHATTE_IMG = loadImg("chatte-bis");
NIVEAUX.forEach((L, n) => {
  L.fondImg = loadImg(L.fond || `niveau${n + 1}/fond`);
  L.images.forEach(r => r.img = loadImg(r.file));
});
const TOTAL = NIVEAUX.reduce((s, L) => s + L.images.length, 0);

// ---------- Sons (.mp3) ----------
const SFX_NAMES = ["gemiss_haaaa", "gemiss_haa", "gemiss_hooo", "gemiss_humm",
                  "gemiss-joui-1", "gemiss-joui-2", "gemiss-joui-3",
                  "gemiss-touch-1", "gemiss-touch-2", "gemiss-touch-3", "gemiss-touch-4", "gemiss-touch-5", "gemiss-touch-6", "gemiss-touch-7", "gemiss-touch-8", "gemiss-touch-9", "gemiss-touch-10", "gemiss-touch-11", "gemiss-touch-12", "gemiss-touch-13", "gemiss-touch-14"];
const SND = {};
[...SFX_NAMES, "perdu", "debloque", "depart"].forEach(n => {
  const a = new Audio(DIR_SND + n + ".mp3"); a.preload = "auto"; SND[n] = a;
});
function play(name, vol = 1) {
  const a = SND[name]; if (!a) return;
  try { const c = a.cloneNode(); c.volume = vol; const p = c.play(); if (p && p.catch) p.catch(() => { }); } catch (e) { }
}
let sfxLast = "";
function sfx() {
  let n; do { n = SFX_NAMES[Math.floor(Math.random() * SFX_NAMES.length)]; } while (n === sfxLast);
  sfxLast = n; play(n);
}
function buzz(n) { try { navigator.vibrate && navigator.vibrate(n); } catch (e) { } }

// ---------- Sauvegarde ----------
let best = 0;
try { best = +localStorage.getItem("queue-best") || 0; } catch (e) { }
let got = new Set();
try { got = new Set(JSON.parse(localStorage.getItem("queue-debloque") || "[]")); } catch (e) { }
const isUn = (n, k) => got.has(n + ":" + k);
function saveGot() { try { localStorage.setItem("queue-debloque", JSON.stringify([...got])); } catch (e) { } }
const countGot = () => got.size;
const levelDone = n => NIVEAUX[n].images.every((_, k) => isUn(n, k));
const allDone = () => NIVEAUX.every((_, n) => levelDone(n));
function curLevel() { for (let n = 0; n < NIVEAUX.length; n++) if (!levelDone(n)) return n; return NIVEAUX.length - 1; }

// ---------- État ----------
let state = "start";                 // start | play | reveal | over
let lvl = 0, score = 0, px = 0, tx = 0, ang = 0;
let rings = [], parts = [], trail = [];
let bg = 0, t = 0, shake = 0, overAt = 0, speed = 0;
let reveal = null, revealAt = 0;     // image qui vient d'être gagnée
let gal = false, galScroll = 0, galMax = 0, galHits = [], drag = null;
let viewing = null;                  // {n,k} image ouverte en grand
let btnGal = null;
const keys = {};
const stars = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + .4, f: Math.random() * .6 + .2 }));

const sy = () => H * .68, L = () => 118 * u, HW = () => BITE.hw * u;
const spd = s => Math.min(VITESSE.depart + VITESSE.accel * s, VITESSE.max) * u * NIVEAUX[lvl].vitesse;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TRAIL = "255,170,80";

function spawn() {
  const last = rings[rings.length - 1];
  const gap = Math.max(260 * u, speed * 1.3);
  const w = Math.max(125, 190 - score * 3) * u, m = w / 2 + 12 * u;
  const cx = clamp(last.cx + (Math.random() * 2 - 1) * .35 * W, m, W - m);
  rings.push({ cx, y: last.y - gap, w, done: false });
}
function reset() {
  lvl = curLevel();
  score = 0; px = tx = W / 2; ang = 0; parts = []; trail = []; speed = spd(0);
  rings = [{ cx: W / 2, y: H * .05, w: 190 * u, done: false }];
  while (rings[rings.length - 1].y > -300 * u) spawn();
}
reset();

// À chaque chatte passée : record + révélation d'une image si le palier du niveau est atteint
function unlock() {
  if (score > best) { best = score; try { localStorage.setItem("queue-best", best); } catch (e) { } }
  if (levelDone(lvl)) return;
  const k = NIVEAUX[lvl].images.findIndex((r, i) => r.at === score && !isUn(lvl, i));
  if (k < 0) return;
  got.add(lvl + ":" + k); saveGot();
  const fin = levelDone(lvl), suite = fin && lvl < NIVEAUX.length - 1;
  reveal = { n: lvl, k, fin, suite };
  state = "reveal"; revealAt = performance.now() + 800;
  play("debloque"); buzz([30, 40, 60]);
}
function burst(x, yy, n, col, pw) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = (60 + Math.random() * pw) * u;
    parts.push({ x, y: yy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1, c: col });
  }
}

// ---------- Contrôles ----------
const inR = (r, x, y) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function tap() {
  if (state === "start") { state = "play"; play("depart"); }
  else if (state === "reveal" && performance.now() > revealAt) {
    if (reveal.suite) reset();                 // nouveau niveau : on repart de zéro
    state = "play";
  }
  else if (state === "over" && performance.now() > overAt) { reset(); state = "play"; }
}
function galTap(x, y) {
  if (y < 64 * u) { if (inR({ x: 14 * u, y: 14 * u, w: 110 * u, h: 38 * u }, x, y)) { gal = false; play("pop"); } return; }
  const h = galHits.find(g => inR(g, x, y));
  if (h) { viewing = { n: h.n, k: h.k }; play("pop"); }
}
addEventListener("pointerdown", e => {
  e.preventDefault(); tx = e.clientX;
  if (viewing) { viewing = null; return; }
  if (gal) { drag = { y: e.clientY, s: galScroll, moved: false }; return; }
  if ((state === "start" || (state === "over" && performance.now() > overAt)) && inR(btnGal, e.clientX, e.clientY)) {
    gal = true; galScroll = 0; play("pop"); return;
  }
  tap();
});
addEventListener("pointermove", e => {
  tx = e.clientX;
  if (drag) { const dy = e.clientY - drag.y; if (Math.abs(dy) > 8) drag.moved = true; galScroll = clamp(drag.s - dy, 0, galMax); }
});
addEventListener("pointerup", e => { if (drag && !drag.moved) galTap(e.clientX, e.clientY); drag = null; });
addEventListener("pointercancel", () => { drag = null; });
addEventListener("wheel", e => { if (gal) galScroll = clamp(galScroll + e.deltaY, 0, galMax); }, { passive: true });
addEventListener("keydown", e => {
  keys[e.code] = true;
  if (e.code === "Escape") { if (viewing) viewing = null; else gal = false; }
  if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); if (viewing) viewing = null; else if (!gal) tap(); }
});
addEventListener("keyup", e => { keys[e.code] = false; });

function die() {
  state = "over"; overAt = performance.now() + 500; shake = 1;
  burst(px, sy(), 30, "255,120,110", 260); buzz(200); play("perdu");
}

// ---------- Mise à jour ----------
function update(dt) {
  t += dt;
  if (state === "reveal") return;            // jeu en pause pendant la révélation
  if (state !== "over") {
    const dir = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA || keys.KeyQ ? 1 : 0);
    if (dir && !gal) tx = clamp(tx + dir * 800 * u * dt, 0, W);
    const op = px; px = clamp(px + (tx - px) * Math.min(1, dt * 14), 16 * u, W - 16 * u);
    const v = (px - op) / Math.max(dt, .001);
    ang += (clamp(v / (1000 * u), -.35, .35) - ang) * Math.min(1, dt * 12);
  }
  if (state === "start") { speed = spd(0) * .4; bg += speed * dt; }
  if (state === "play") {
    speed = spd(score); bg += speed * dt;
    const half = L() / 2;
    for (const r of rings) {
      r.y += speed * dt;
      if (!r.done && r.y > sy() - half && r.y < sy() + half) {
        const xc = px + (sy() - r.y) * Math.tan(ang);
        if (Math.abs(xc - r.cx) > r.w / 2 - HW() - 2 * u) return die();
      }
      if (!r.done && r.y >= sy() + half) {
        r.done = true; score++; unlock();
        // Couleur gouttelette validation chatte
        // burst(r.cx, r.y, 16, `${(score * 25 + 180) % 360}`, 200);
        burst(r.cx, r.y, 16, "120,210,255", 200);
        buzz(15);
        if (state === "reveal") break; else sfx();
      }
    }
    rings = rings.filter(r => r.y < H + 80 * u);
    while (rings[rings.length - 1].y > -300 * u) spawn();
    trail.push({ x: px - half * Math.sin(ang), y: sy() + half * Math.cos(ang), l: 1 });
  }
  for (const p of trail) { p.y += speed * dt; p.l -= dt * 1.8; }
  trail = trail.filter(p => p.l > 0);
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * u * dt; p.l -= dt * 1.6; }
  parts = parts.filter(p => p.l > 0);
  shake = Math.max(0, shake - dt * 3);
}

// ---------- Dessin ----------
const ringCol = i => `hsl(${(i * 25 + 180 + lvl * 50) % 360},95%,62%)`;

function drawBg() {
  const F = NIVEAUX[(state === "start" || state === "over") ? curLevel() : lvl].fondImg;
  if (ready(F)) {
    const k = W / F.naturalWidth, th = F.naturalHeight * k, off = (bg * .35) % th;
    for (let y = off - th; y < H; y += th) ctx.drawImage(F, 0, y, W, th + 1);
  } else { ctx.fillStyle = "#1b1038"; ctx.fillRect(0, 0, W, H); }
  ctx.strokeStyle = "#fff"; ctx.lineCap = "round";
  for (const s of stars) {
    const y = (s.y * H + bg * s.f) % H, len = Math.min(60 * u, 2 + speed * .05 * s.f);
    ctx.globalAlpha = .2 + .45 * s.f; ctx.lineWidth = s.r * u;
    ctx.beginPath(); ctx.moveTo(s.x * W, y); ctx.lineTo(s.x * W, y - len); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// Chatte : l'image est préparée une fois dans un canvas, puis dessinée derrière la bite
let chatte = null;
function buildChatte(im) {
  const w = im.naturalWidth, h = im.naturalHeight;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = "source-atop";                 // dégradé de profondeur à l'intérieur de la forme
  const t = document.createElement("canvas"); t.width = w; t.height = h;   // liseré = forme moins sa version réduite
  const q = t.getContext("2d"), cx = w * CHATTE.cx, cy = h * .47, k = .9;
  q.drawImage(im, 0, 0);
  q.globalCompositeOperation = "destination-out";
  q.drawImage(im, cx - cx * k, cy - cy * k, w * k, h * k);
  q.globalCompositeOperation = "source-atop";
  g.globalCompositeOperation = "source-over"; g.drawImage(t, 0, 0);
  if (CHATTE.fondu > 0) {                                       // fondu en haut : l'image est coupée net à son bord supérieur
    g.globalCompositeOperation = "destination-out";
    const fd = g.createLinearGradient(0, 0, 0, h * CHATTE.fondu);
    fd.addColorStop(0, "rgba(0,0,0,1)"); fd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fd; g.fillRect(0, 0, w, h * CHATTE.fondu);
  }
  return c;
}
function drawCave(r) {
  const im = CHATTE_IMG, w = r.w / CHATTE.ouv;
  if (!ready(im)) {                                   // secours si chatte.jpg est absent
    ctx.lineWidth = 8 * u; ctx.strokeStyle = "#4fd0ff";
    ctx.beginPath(); ctx.ellipse(r.cx, r.y, r.w / 2, r.w * .3, 0, 0, Math.PI * 2); ctx.stroke();
    return;
  }
  if (!chatte) chatte = buildChatte(im);
  const h = w * im.naturalHeight / im.naturalWidth * CHATTE.hscale;
  ctx.save(); ctx.translate(r.cx, r.y);
  if (CHATTE.retourne) ctx.scale(1, -1);
  if (CHATTE.fusion === "screen") ctx.globalCompositeOperation = "screen";
  ctx.shadowColor = "rgba(120,190,255,.85)"; ctx.shadowBlur = 16 * u;
  ctx.drawImage(chatte, -CHATTE.cx * w, -CHATTE.ligne * h, w, h);
  ctx.restore();
}
// Bite (image)
function drawBite() {
  const im = BITE_IMG, h = BITE.h * u, w = ready(im) ? h * im.naturalWidth / im.naturalHeight : h * .43;
  ctx.save(); ctx.translate(px, sy()); ctx.rotate(ang);
  ctx.globalCompositeOperation = "lighter";
  const k = .5 + Math.min(speed / (520 * u), 1) * .8;
  ctx.globalCompositeOperation = "screen";
  if (ready(im)) ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function txt(s, x, yy, size, col, align = "center", w = 800) {
  ctx.font = `${w} ${size * u}px system-ui,-apple-system,"Segoe UI",sans-serif`;
  ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(s, x, yy);
}
// Image entière (sans déformation) avec cadre arrondi
function drawContain(img, cx, cy, maxW, maxH, name) {
  if (!ready(img)) {
    txt("Image introuvable :", cx, cy - 10 * u, 16, "#fff", undefined, 600);
    txt("image/" + name + ".jpg", cx, cy + 14 * u, 16, "#ffe0a3", undefined, 600);
    return;
  }
  const k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k, x = cx - w / 2, y = cy - h / 2;
  ctx.save();
  ctx.shadowColor = "rgba(255,220,150,.7)"; ctx.shadowBlur = 30 * u;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 18 * u); ctx.fillStyle = "#000"; ctx.fill();
  ctx.shadowBlur = 0; ctx.clip(); ctx.drawImage(img, x, y, w, h); ctx.restore();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3 * u;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 18 * u); ctx.stroke();
}
function drawButton(yc, label) {
  const w = 250 * u, h = 46 * u;
  btnGal = { x: W / 2 - w / 2, y: yc - h / 2, w, h };
  ctx.beginPath(); ctx.roundRect(btnGal.x, btnGal.y, w, h, 23 * u);
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2 * u; ctx.stroke();
  txt(label, W / 2, yc + 6 * u, 17, "#fff", undefined, 700);
}

// Galerie : toutes les images de tous les niveaux (débloquées ou non), défilement vertical
function drawGalerie() {
  ctx.fillStyle = "rgba(10,4,25,.97)"; ctx.fillRect(0, 0, W, H);
  galHits = [];
  const top = 64 * u, pad = 14 * u, cols = 3, gap = 10 * u, cell = (W - pad * 2 - gap * (cols - 1)) / cols;
  let y = top + 10 * u - galScroll;
  NIVEAUX.forEach((Lv, n) => {
    const nb = Lv.images.filter((_, k) => isUn(n, k)).length;
    txt(`${Lv.nom} · ${nb}/${Lv.images.length}`, pad, y + 20 * u, 18, "#ffe0a3", "left", 700);
    y += 34 * u;
    Lv.images.forEach((r, k) => {
      const c = k % cols, row = Math.floor(k / cols);
      const x = pad + c * (cell + gap), yy = y + row * (cell + gap), ok = isUn(n, k);
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, yy, cell, cell, 12 * u); ctx.fillStyle = "#1a0f33"; ctx.fill(); ctx.clip();
      if (ok && ready(r.img)) {
        const m = Math.min(r.img.naturalWidth, r.img.naturalHeight);
        ctx.drawImage(r.img, (r.img.naturalWidth - m) / 2, (r.img.naturalHeight - m) / 2, m, m, x, yy, cell, cell);
      }
      ctx.restore();
      ctx.strokeStyle = ok ? "#fff" : "rgba(255,255,255,.3)"; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.roundRect(x, yy, cell, cell, 12 * u); ctx.stroke();
      if (!ok) {
        txt("🔒", x + cell / 2, yy + cell / 2 + 2 * u, 26, "#fff", undefined, 400);
        txt(r.at + " chattes", x + cell / 2, yy + cell / 2 + 28 * u, 13, "rgba(255,255,255,.75)", undefined, 600);
      } else galHits.push({ x, y: yy, w: cell, h: cell, n, k });
    });
    y += Math.ceil(Lv.images.length / cols) * (cell + gap) + 12 * u;
  });
  galMax = Math.max(0, y + galScroll - H + 20 * u);
  galScroll = clamp(galScroll, 0, galMax);
  // en-tête
  ctx.fillStyle = "#0a0419"; ctx.fillRect(0, 0, W, top);
  ctx.beginPath(); ctx.roundRect(14 * u, 14 * u, 110 * u, 38 * u, 19 * u);
  ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fill();
  txt("← Retour", 14 * u + 55 * u, 39 * u, 16, "#fff", undefined, 700);
  txt(`Mes images ${countGot()}/${TOTAL}`, W - 14 * u, 39 * u, 17, "#ffe0a3", "right", 700);
}

function draw() {
  btnGal = null;
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 14 * shake * u, (Math.random() - .5) * 14 * shake * u);
  drawBg();
  rings.forEach(r => drawCave(r));
  ctx.lineCap = "round";
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i];
    ctx.strokeStyle = `rgba(${TRAIL},${Math.max(0, b.l) * .5})`; ctx.lineWidth = 9 * u * b.l;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  if (state !== "over" || performance.now() < overAt) drawBite();
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.l);
    ctx.fillStyle = p.c.includes(",") ? `rgb(${p.c})` : `hsl(${p.c},95%,65%)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.5 * u * p.l + 1, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();

  if (state !== "start") {
    txt(String(score), W / 2, 100 * u, 64, "#fff");
    txt("vitesse ×" + (speed / (VITESSE.depart * u)).toFixed(1), W / 2, 130 * u, 16, "rgba(255,255,255,.8)", undefined, 600);
    txt(NIVEAUX[lvl].nom, 16 * u, 34 * u, 15, "rgba(255,255,255,.85)", "left", 700);
  }
  if (state === "start" || state === "over") {
    const n = curLevel(), Lv = NIVEAUX[n], nb = Lv.images.filter((_, k) => isUn(n, k)).length;
    const info = allDone() ? "Toutes les images sont débloquées !" : `${Lv.nom} · images ${nb}/${Lv.images.length}`;
    if (state === "start") {
      txt("Bite volante", W / 2, H * .2, 44, "#fff");
      txt("Glisse ton doigt à gauche et à droite", W / 2, H * .2 + 34 * u, 16, "rgba(255,255,255,.85)", undefined, 500);
      txt("pour enfiler les chattes", W / 2, H * .2 + 56 * u, 16, "rgba(255,255,255,.85)", undefined, 500);
      txt("Touche pour démarrer", W / 2, H * .44, 20, "#ffe0a3", undefined, 700);
      if (best) txt("Record : " + best, W / 2, H * .44 + 30 * u, 15, "rgba(255,255,255,.8)", undefined, 500);
      txt(info, W / 2, H * .44 + 54 * u, 15, "rgba(255,255,255,.8)", undefined, 600);
      drawButton(H * .86, `Mes images · ${countGot()}/${TOTAL}`);
    } else {
      ctx.fillStyle = "rgba(15,5,35,.55)"; ctx.fillRect(0, 0, W, H);
      txt("Raté !", W / 2, H * .3, 48, "#ff8a7a");
      txt(score + (score > 1 ? " chattes" : " chatte"), W / 2, H * .3 + 60 * u, 32, "#fff");
      txt("Record : " + best, W / 2, H * .3 + 96 * u, 18, "#ffe0a3", undefined, 600);
      txt(info, W / 2, H * .3 + 124 * u, 15, "rgba(255,255,255,.85)", undefined, 600);
      if (performance.now() > overAt) txt("Touche pour rejouer", W / 2, H * .58, 22, "#fff", undefined, 700);
      drawButton(H * .72, `Mes images · ${countGot()}/${TOTAL}`);
    }
  }
  if (state === "reveal") {
    ctx.fillStyle = "rgba(10,4,25,.82)"; ctx.fillRect(0, 0, W, H);
    const Lv = NIVEAUX[reveal.n];
    txt(reveal.fin ? `${Lv.nom} terminé !` : "Image débloquée !", W / 2, H * .09, 30, "#ffe0a3");
    if (reveal.fin) txt(reveal.suite ? "Dernière image de ce niveau" : "Toutes les images sont débloquées !", W / 2, H * .09 + 28 * u, 15, "rgba(255,255,255,.85)", undefined, 600);
    const R = Lv.images[reveal.k];
    drawContain(R.img, W / 2, H * .5, W * .88, H * .64, R.file);
    if (performance.now() > revealAt)
      txt(reveal.suite ? `Touche pour passer au ${NIVEAUX[reveal.n + 1].nom.toLowerCase()}` : "Touche pour continuer", W / 2, H * .93, 20, "#fff", undefined, 700);
  }
  if (gal) drawGalerie();
  if (viewing) {
    ctx.fillStyle = "rgba(10,4,25,.94)"; ctx.fillRect(0, 0, W, H);
    const R = NIVEAUX[viewing.n].images[viewing.k];
    txt(NIVEAUX[viewing.n].nom, W / 2, H * .07, 20, "#ffe0a3");
    drawContain(R.img, W / 2, H * .5, W * .9, H * .72, R.file);
    txt("Touche pour fermer", W / 2, H * .94, 18, "rgba(255,255,255,.85)", undefined, 600);
  }
}

// ---------- Boucle ----------
let last = performance.now();
function loop(n) {
  const dt = Math.min(.033, (n - last) / 1000); last = n;
  update(dt); draw(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
