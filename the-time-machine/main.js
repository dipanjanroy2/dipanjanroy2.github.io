/* ═══════════ BOLDGROW TIME MACHINE ═══════════ */
const clamp01 = v => Math.min(1, Math.max(0, v));

/* ── seek-gated scrubber ──
   Scrubbing is only enabled once the ENTIRE video is downloaded as a blob.
   Seeking a partially-buffered streaming source is what causes the "janky on
   fresh load, fine after a few seconds" stutter — so we gate on full download,
   show a loader with progress until then, and never seek a half-loaded source. */
function makeScrub(video, hooks = {}) {
  const s = { duration: 0, ready: false, target: 0, seeking: false };
  const chase = () => {
    if (s.seeking || !s.ready || s.duration <= 0) return;
    if (Math.abs(s.target - video.currentTime) < 0.02) return;
    s.seeking = true;
    video.currentTime = s.target;
  };
  video.addEventListener('loadedmetadata', () => { s.duration = video.duration; });
  video.addEventListener('seeked', () => { s.seeking = false; chase(); });

  const markReady = () => {
    if (s.ready) return;
    s.ready = true;
    if (!s.duration && video.duration) s.duration = video.duration;
    hooks.onReady && hooks.onReady();
    chase();
  };

  // Download the whole file with progress, then hand the browser a fully-local
  // blob URL so every subsequent seek resolves instantly. Readiness fires from
  // several signals (events + poll + timeout) so it never stalls; markReady is
  // idempotent via the `ready` guard.
  fetch(video.getAttribute('src'))
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
          hooks.onProgress && hooks.onProgress(received / total);
          return pump();
        });
      })();
    })
    .then(b => {
      video.src = URL.createObjectURL(b);
      video.load();
      video.addEventListener('loadeddata', markReady, { once: true });
      video.addEventListener('canplay', markReady, { once: true });
      const poll = setInterval(() => { if (video.readyState >= 2) { clearInterval(poll); markReady(); } }, 120);
      setTimeout(() => { clearInterval(poll); markReady(); }, 4000); // absolute fallback
    })
    .catch(() => { markReady(); }); // network fell back: still allow scrubbing
  return (p) => { if (s.duration > 0) { s.target = p * (s.duration - 0.05); chase(); } };
}
const timeVideo = document.getElementById('timeVideo');
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const timeSeek = makeScrub(timeVideo, {
  onProgress: (f) => { if (loaderFill) loaderFill.style.width = Math.round(f * 100) + '%'; },
  onReady: () => {
    if (loaderFill) loaderFill.style.width = '100%';
    if (loader) loader.classList.add('hidden');
    update(); // snap the video to wherever the user has already scrolled
  },
});
timeVideo.addEventListener('seeked', () => update());

/* ── mechanical odometer: 4 wheels, clean digits + carry roll ── */
const YEAR_START = 1926, YEAR_END = 2126;
const digitEls = [...document.querySelectorAll('.od-digit')]; // [thousands, hundreds, tens, units]
const strips = digitEls.map(el => {
  const strip = document.createElement('div');
  strip.className = 'od-strip';
  for (let n = 0; n <= 10; n++) { // 0..9 + duplicate 0 for seamless wrap
    const span = document.createElement('span');
    span.textContent = n % 10;
    strip.appendChild(span);
  }
  el.textContent = '';
  el.appendChild(strip);
  return strip;
});

function setOdometer(year) {
  const H = digitEls[3].clientHeight || 1;
  // places: index 0 = thousands (10^3) ... index 3 = units (10^0)
  for (let i = 0; i < 4; i++) {
    const pv = Math.pow(10, 3 - i);
    let off;
    if (pv === 1) {
      off = ((year % 10) + 10) % 10;           // units roll continuously
    } else {
      const digit = Math.floor(year / pv) % 10;
      const distToAdvance = (pv - (year % pv)) / pv; // 1 → 0 as this wheel nears its next click
      const roll = distToAdvance < 0.03 ? (0.03 - distToAdvance) / 0.03 : 0;
      off = digit + roll;
    }
    strips[i].style.transform = `translateY(${-off * H}px)`;
  }
}

/* ── era captions ── */
const eraCaption = document.getElementById('eraCaption');
const CAPTIONS = [
  { until: 1955, text: '1926 — the tram &amp; the tonga' },
  { until: 2005, text: '1976 — Ambassadors &amp; silver-screen dreams' },
  { until: 2080, text: '2026 — the city we know' },
  { until: 9999, text: '2126 — a century on, still standing' },
];
let lastCap = -1;
function setCaption(year) {
  const idx = CAPTIONS.findIndex(c => year < c.until);
  if (idx !== lastCap) {
    lastCap = idx;
    eraCaption.style.opacity = '0';
    setTimeout(() => { eraCaption.innerHTML = CAPTIONS[idx].text; eraCaption.style.opacity = '1'; }, 220);
  }
}

/* ── refs ── */
const journey = document.getElementById('journey');
const timelineFill = document.getElementById('timelineFill');

function journeyProgress() {
  const rect = journey.getBoundingClientRect();
  const scrollable = rect.height - innerHeight;
  if (scrollable <= 0) return 0;
  return clamp01(-rect.top / scrollable);
}

function update() {
  const p = journeyProgress();
  timeSeek(p);
  const year = YEAR_START + p * (YEAR_END - YEAR_START);
  setOdometer(year);
  setCaption(year);
  timelineFill.style.width = (p * 100).toFixed(2) + '%';
}

function loop() { update(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
addEventListener('scroll', update, { passive: true });
addEventListener('resize', update);
update();
