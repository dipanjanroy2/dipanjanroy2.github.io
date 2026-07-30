/* ═══════════ FORGE — Earn it. ═══════════ */

/* ── Nav ── */
const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true });

/* ═══ HERO SCRUB ═══ */
const hero = document.querySelector('.hero');
const video = document.getElementById('heroVideo');
const heroWord = document.getElementById('heroWord');
const heroMotto = document.getElementById('heroMotto');
const heroHint = document.getElementById('heroHint');
let duration = 0;

video.addEventListener('loadedmetadata', () => { duration = video.duration; });
video.addEventListener('canplay', () => { video.currentTime = 0.001; }, { once: true });
/* Preload whole clip into a blob — scrubbing never touches the network */
fetch(video.getAttribute('src'))
  .then(r => r.blob())
  .then(b => {
    const t = video.currentTime;
    video.src = URL.createObjectURL(b);
    video.currentTime = t;
  })
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

  /* scrub */
  if (duration > 0 && !video.seeking) {
    const target = p * (duration - 0.05);
    const delta = target - video.currentTime;
    if (Math.abs(delta) > 1.2) video.currentTime = video.currentTime + delta * 0.45;
    else if (Math.abs(delta) > 0.01) video.currentTime = target;
  }

  /* FORGE punches in */
  const wIn = easeOut(ramp(p, 0.04, 0.26));
  heroWord.style.opacity = wIn;
  heroWord.style.transform = `scale(${1.6 - 0.6 * wIn})`;

  /* motto rises beneath */
  const mIn = easeOut(ramp(p, 0.28, 0.44));
  heroMotto.style.opacity = mIn;
  heroMotto.style.transform = `translateY(${24 - 24 * mIn}px)`;

  heroHint.style.opacity = p > 0.04 ? 0 : 1;
}

/* ═══ PHILOSOPHY STEPPER ═══ */
const philo = document.getElementById('philosophy');
const lines = [...document.querySelectorAll('.philo-line')];

function updatePhilo() {
  const rect = philo.getBoundingClientRect();
  const scrollable = rect.height - innerHeight;
  if (scrollable <= 0) return;
  const p = clamp01(-rect.top / scrollable);
  const idx = Math.min(lines.length - 1, Math.floor(p * lines.length));
  lines.forEach((el, i) => {
    el.classList.toggle('on', i === idx);
    el.classList.toggle('off-up', i < idx);
  });
}

function update() { updateHero(); updatePhilo(); }
function frame() { update(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
addEventListener('scroll', update, { passive: true });
video.addEventListener('seeked', updateHero);

/* ═══ RESULTS COUNTERS ═══ */
const stats = [...document.querySelectorAll('.stat-num')];
const statIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    statIO.unobserve(e.target);
    const end = +e.target.dataset.count;
    const t0 = performance.now();
    const dur = 1600;
    (function tick(now) {
      const k = clamp01((now - t0) / dur);
      e.target.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString('en-IN');
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  });
}, { threshold: 0.6 });
stats.forEach(s => statIO.observe(s));

/* ═══ SIGNUP FORM ═══ */
document.getElementById('signupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  e.target.classList.add('sent');
});

/* ═══ MOBILE SWIPE HINT ═══ */
if (matchMedia('(max-width: 900px)').matches) {
  const hint = document.createElement('p');
  hint.className = 'swipe-hint';
  hint.textContent = 'Swipe →';
  document.getElementById('programsGrid').after(hint);
}
