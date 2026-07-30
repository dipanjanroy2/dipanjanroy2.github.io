/* ═══════════ SAFFRON & OAK ═══════════ */

/* ── Nav ── */
const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true });

/* ═══ HERO SCRUB ═══ */
const hero = document.querySelector('.hero');
const video = document.getElementById('heroVideo');
const heroName = document.getElementById('heroName');
const words = [...heroName.querySelectorAll('.w')];
const heroAmp = document.getElementById('heroAmp');
const heroSub = document.getElementById('heroSub');
const heroHint = document.getElementById('heroHint');
let duration = 0;

video.addEventListener('loadedmetadata', () => { duration = video.duration; });
video.addEventListener('canplay', () => { video.currentTime = 0.001; }, { once: true });
/* Preload whole clip into a blob so scrubbing never touches the network */
fetch(video.getAttribute('src'))
  .then(r => r.blob())
  .then(b => { const t = video.currentTime; video.src = URL.createObjectURL(b); video.currentTime = t; })
  .catch(() => {});

const clamp01 = v => Math.min(1, Math.max(0, v));
const ramp = (p, a, b) => clamp01((p - a) / (b - a));
const easeOut = t => 1 - Math.pow(1 - t, 3);

function heroProgress() {
  const rect = hero.getBoundingClientRect();
  const scrollable = rect.height - innerHeight;
  if (scrollable <= 0) return 0;
  return clamp01(-rect.top / scrollable);
}

function updateHero() {
  const p = heroProgress();

  if (duration > 0 && !video.seeking) {
    const target = p * (duration - 0.05);
    const delta = target - video.currentTime;
    if (Math.abs(delta) > 1.2) video.currentTime = video.currentTime + delta * 0.45;
    else if (Math.abs(delta) > 0.01) video.currentTime = target;
  }

  /* "Saffron" tracks in, then "&", then "Oak" */
  const t0 = easeOut(ramp(p, 0.05, 0.24));
  const t1 = easeOut(ramp(p, 0.16, 0.34));
  const t2 = easeOut(ramp(p, 0.24, 0.44));
  words[0].style.opacity = t0;
  words[0].style.transform = `translateX(${-30 * (1 - t0)}px)`;
  words[0].style.letterSpacing = `${0.12 * (1 - t0)}em`;
  heroAmp.style.opacity = t1;
  words[1].style.opacity = t2;
  words[1].style.transform = `translateX(${30 * (1 - t2)}px)`;
  words[1].style.letterSpacing = `${0.12 * (1 - t2)}em`;

  /* subtitle fades up */
  const s = easeOut(ramp(p, 0.42, 0.6));
  heroSub.style.opacity = s;
  heroSub.style.letterSpacing = `${0.45 + 0.25 * (1 - s)}em`;

  heroHint.style.opacity = p > 0.04 ? 0 : 1;
}

/* ═══ PARALLAX + LAZY BG VIDEO ═══ */
const parallaxItems = [...document.querySelectorAll('[data-parallax]')].map(el => ({
  el,
  media: el.querySelector('.bg-video'),
}));

const vidIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.src && v.dataset.src) v.src = v.dataset.src;
      if (v.readyState === 0) v.load();
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  });
}, { threshold: 0.05 });
parallaxItems.forEach(({ media }) => {
  /* defer real src until near viewport */
  media.dataset.src = media.getAttribute('src');
  media.removeAttribute('src');
  vidIO.observe(media);
});

function updateParallax() {
  for (const { el, media } of parallaxItems) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) continue;
    /* progress of section center through viewport, -1..1 */
    const center = (rect.top + rect.height / 2 - innerHeight / 2) / (innerHeight);
    media.style.transform = `translateY(${center * -7}%) scale(1.14)`;
  }
}

/* ═══ REVEALS ═══ */
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } });
}, { threshold: 0.3 });
document.querySelectorAll('.reveal').forEach(el => revealIO.observe(el));

/* ═══ RAF LOOP ═══ */
function update() { updateHero(); updateParallax(); }
function frame() { update(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
addEventListener('scroll', update, { passive: true });
video.addEventListener('seeked', updateHero);

/* ═══ RESERVE FORM ═══ */
const form = document.getElementById('reserveForm');
/* min date = today */
const dateInput = document.getElementById('rDate');
const today = new Date().toISOString().split('T')[0];
dateInput.min = today;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  form.classList.add('sent');
});
