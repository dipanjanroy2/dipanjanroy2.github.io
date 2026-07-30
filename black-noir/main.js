/* ═══════════ BLACK NOIR — Eclipse ═══════════ */

const clamp01 = v => Math.min(1, Math.max(0, v));
const ramp = (p, a, b) => clamp01((p - a) / (b - a));
const easeOut = t => 1 - Math.pow(1 - t, 3);

/* ═══ LENIS SMOOTH SCROLL ═══ */
const lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 1, smoothWheel: true });
window.lenis = lenis;
lenis.on('scroll', () => { scrolled = true; });
function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
let scrolled = true;

/* anchor links through Lenis */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const el = document.querySelector(a.getAttribute('href'));
    if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: 0 }); }
  });
});

/* ── Nav ── */
const nav = document.getElementById('nav');

/* ═══ HERO — SCROLL-SCRUBBED ORBIT DRAWN TO CANVAS ═══ */
/* The 360° turntable is scrubbed frame-by-frame via the video's currentTime
   and painted onto a <canvas>, so scrolling rotates the bottle. */
const canvas = document.getElementById('orbit');
const ctx = canvas.getContext('2d');
const hero = document.querySelector('.hero');
const orbitVideo = document.getElementById('orbitVideo');
let orbitDuration = 0;
let orbitReady = false;
let orbitTarget = 0;
let orbitSeeking = false;

const setHeroFill = (w) => { const fl = document.getElementById('heroLoaderFill'); if (fl) fl.style.width = w; };

orbitVideo.addEventListener('loadedmetadata', () => { orbitDuration = orbitVideo.duration; });
orbitVideo.addEventListener('seeked', () => { orbitSeeking = false; paintOrbit(); requestOrbitSeek(); });

const markOrbitReady = () => {
  if (orbitReady) return;
  orbitReady = true;
  if (!orbitDuration && orbitVideo.duration) orbitDuration = orbitVideo.duration;
  setHeroFill('100%');
  const ld = document.getElementById('heroLoader');
  if (ld) ld.classList.add('hidden');
  try { orbitVideo.currentTime = 0.001; } catch (e) {}
  paintOrbit();
  requestOrbitSeek();
};

/* download the whole turntable to a blob (with progress) and keep scrubbing disabled
   until it's fully local — seeking a half-loaded clip is what breaks it on first visit.
   Fire readiness from several signals so it never stalls; markOrbitReady is idempotent. */
fetch(orbitVideo.getAttribute('src'))
  .then(r => {
    const total = +r.headers.get('Content-Length') || 0;
    if (!r.body || !total) return r.blob();
    const reader = r.body.getReader();
    const chunks = [];
    let received = 0;
    return (function pump() {
      return reader.read().then(({ done, value }) => {
        if (done) return new Blob(chunks, { type: 'video/mp4' });
        chunks.push(value);
        received += value.length;
        setHeroFill(Math.round(received / total * 100) + '%');
        return pump();
      });
    })();
  })
  .then(b => {
    orbitVideo.src = URL.createObjectURL(b);
    orbitVideo.load();
    orbitVideo.addEventListener('loadeddata', markOrbitReady, { once: true });
    orbitVideo.addEventListener('canplay', markOrbitReady, { once: true });
    const poll = setInterval(() => { if (orbitVideo.readyState >= 2) { clearInterval(poll); markOrbitReady(); } }, 120);
    setTimeout(() => { clearInterval(poll); markOrbitReady(); }, 4000);
  })
  .catch(() => { markOrbitReady(); });

/* seek-gated scrub: one seek in flight, always chasing the latest scroll target */
function requestOrbitSeek() {
  if (orbitSeeking || !orbitReady || orbitDuration <= 0) return;
  if (Math.abs(orbitTarget - orbitVideo.currentTime) < 0.015) { paintOrbit(); return; }
  orbitSeeking = true;
  orbitVideo.currentTime = orbitTarget;
}

function sizeCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeCanvas();
addEventListener('resize', () => { sizeCanvas(); paintOrbit(); });

function paintOrbit() {
  const vw = orbitVideo.videoWidth, vh = orbitVideo.videoHeight;
  if (!vw || !vh) return;
  const cw = innerWidth, ch = innerHeight;
  ctx.clearRect(0, 0, cw, ch);
  const scale = Math.max(cw / vw, ch / vh);
  const w = vw * scale, h = vh * scale;
  try { ctx.drawImage(orbitVideo, (cw - w) / 2, (ch - h) / 2, w, h); } catch (e) {}
}

function heroProgress() {
  const rect = hero.getBoundingClientRect();
  const scrollable = rect.height - innerHeight;
  if (scrollable <= 0) return 0;
  return clamp01(-rect.top / scrollable);
}

/* hero copy elements */
const hHouse = document.getElementById('heroHouse');
const hWords = [...document.querySelectorAll('.hn-word')];
const hPiece = document.getElementById('heroPiece');
const hHint = document.getElementById('heroHint');

function updateHero() {
  const p = heroProgress();

  /* scrub the orbit: scroll sets the target time, seek-gated chase paints canvas */
  if (orbitDuration > 0) { orbitTarget = p * (orbitDuration - 0.05); requestOrbitSeek(); }

  /* house label early, name tracks in, piece last */
  hHouse.style.opacity = easeOut(ramp(p, 0.02, 0.14));

  const w0 = easeOut(ramp(p, 0.08, 0.30));
  hWords[0].style.opacity = w0;
  hWords[0].style.letterSpacing = (0.5 * (1 - w0)) + 'em';
  hWords[0].style.transform = `translateY(${20 * (1 - w0)}px)`;

  const w1 = easeOut(ramp(p, 0.20, 0.44));
  hWords[1].style.opacity = w1;
  hWords[1].style.letterSpacing = (0.5 * (1 - w1)) + 'em';
  hWords[1].style.transform = `translateY(${20 * (1 - w1)}px)`;

  hPiece.style.opacity = easeOut(ramp(p, 0.40, 0.58));
  hHint.style.opacity = p > 0.04 ? 0 : 1;

  nav.classList.toggle('scrolled', -hero.getBoundingClientRect().top > innerHeight * 0.6);
}

/* ═══ SHARED VIDEO SCRUB — seek-gated (one seek in flight, chase latest target) ═══ */
function makeScrub(video) {
  const s = { duration: 0, ready: false, target: 0, seeking: false };
  const chase = () => {
    if (s.seeking || !s.ready || s.duration <= 0) return;
    if (Math.abs(s.target - video.currentTime) < 0.015) return;
    s.seeking = true;
    video.currentTime = s.target;
  };
  video.addEventListener('loadedmetadata', () => { s.duration = video.duration; });
  video.addEventListener('seeked', () => { s.seeking = false; chase(); });
  const markReady = () => {
    if (s.ready) return;
    s.ready = true;
    if (!s.duration && video.duration) s.duration = video.duration;
    chase();
  };
  /* only scrub once fully downloaded — never seek a partially-buffered stream */
  fetch(video.getAttribute('src'))
    .then(r => r.blob())
    .then(b => {
      video.src = URL.createObjectURL(b);
      video.load();
      video.addEventListener('loadeddata', markReady, { once: true });
      video.addEventListener('canplay', markReady, { once: true });
      const poll = setInterval(() => { if (video.readyState >= 2) { clearInterval(poll); markReady(); } }, 120);
      setTimeout(() => { clearInterval(poll); markReady(); }, 4000);
    })
    .catch(() => { markReady(); });
  return (p) => { if (s.duration > 0) { s.target = p * (s.duration - 0.05); chase(); } };
}

/* ═══ MACRO (clip 2) ═══ */
const macro = document.getElementById('macro');
const macroVideo = document.getElementById('macroVideo');
const macroSeek = makeScrub(macroVideo);
const macroLines = [...document.querySelectorAll('.macro-line')];

function updateMacro() {
  const rect = macro.getBoundingClientRect();
  const scrollable = rect.height - innerHeight;
  if (scrollable <= 0) return;
  const p = clamp01(-rect.top / scrollable);
  if (rect.bottom > 0 && rect.top < innerHeight) macroSeek(p);
  const idx = Math.min(macroLines.length - 1, Math.floor(p * macroLines.length));
  macroLines.forEach((el, i) => {
    el.classList.toggle('on', i === idx);
    el.classList.toggle('off', i < idx);
  });
}

/* ═══ EXPLODED (clip 3) + specs + accords ═══ */
const exploded = document.getElementById('exploded');
const explodedVideo = document.getElementById('explodedVideo');
const explodedSeek = makeScrub(explodedVideo);
const specs = [...document.querySelectorAll('.spec')];
const accords = [...document.querySelectorAll('.accord')];

function updateExploded() {
  const rect = exploded.getBoundingClientRect();
  const scrollable = rect.height - innerHeight;
  if (scrollable <= 0) return;
  const p = clamp01(-rect.top / scrollable);
  if (rect.bottom > 0 && rect.top < innerHeight) explodedSeek(p);
  /* specs stagger in across the section */
  specs.forEach((el, i) => el.classList.toggle('on', p > 0.28 + i * 0.14));
  /* accords reveal as the piece completes */
  accords.forEach((el, i) => el.classList.toggle('on', p > 0.5 + i * 0.11));
}

/* ═══ GENERIC REVEALS ═══ */
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } });
}, { threshold: 0.25 });
document.querySelectorAll('.reveal').forEach(el => revealIO.observe(el));

/* ═══ WAITLIST FORM ═══ */
document.getElementById('waitlistForm').addEventListener('submit', (e) => {
  e.preventDefault();
  e.target.classList.add('sent');
});

/* ═══ MAIN LOOP ═══ */
function update() { updateHero(); updateMacro(); updateExploded(); }
function frame() { update(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
