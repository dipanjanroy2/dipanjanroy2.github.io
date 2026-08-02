/* ═══════════ THE MERIDIAN — cinematic tour ═══════════ */

const CHAPTERS = [
  { roman: 'I',   name: 'The Approach', desc: 'Dusk. The city ignites beneath you.' },
  { roman: 'II',  name: 'The Arrival',  desc: 'From the private elevator into the great room.' },
  { roman: 'III', name: 'The Flow',     desc: 'Kitchen to suite — one uninterrupted line.' },
  { roman: 'IV',  name: 'The Terrace',  desc: 'The skyline, mirrored in your own pool.' },
];

/* ── Nav ── */
const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true });

/* ── Reveal on scroll ── */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.18 });
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.setProperty('--d', i % 8);
  io.observe(el);
});

/* ── Price glow ── */
const priceFigure = document.getElementById('priceFigure');
new IntersectionObserver((e) => {
  if (e[0].isIntersecting) priceFigure.classList.add('lit');
}, { threshold: 0.6 }).observe(priceFigure);

/* ── Form ── */
document.getElementById('showingForm').addEventListener('submit', (e) => {
  e.preventDefault();
  e.target.classList.add('sent');
});

/* ── Scroll-scrub tour ── */
const tour = document.getElementById('tour');
const video = document.getElementById('tourVideo');
const rail = document.getElementById('tourRail');
const railFill = document.getElementById('railFill');
const stops = [...document.querySelectorAll('.rail-stop')];
const caption = document.getElementById('tourCaption');
const capRoman = document.getElementById('captionRoman');
const capName = document.getElementById('captionName');
const capDesc = document.getElementById('captionDesc');

let targetTime = 0;
let currentChapter = -1;
let duration = 0;
let switching = false;
let ready = false;   // only scrub once the whole tour is downloaded — prevents cold-load stutter

const setFill = (w) => { const fl = document.getElementById('tourLoaderFill'); if (fl) fl.style.width = w; };

video.addEventListener('loadedmetadata', () => { duration = video.duration; });

const markReady = () => {
  if (ready) return;
  ready = true;
  if (!duration && video.duration) duration = video.duration;
  setFill('100%');
  const ld = document.getElementById('tourLoader');
  if (ld) ld.classList.add('hidden');
  try { video.currentTime = 0.001; } catch (e) {}
  update();
};

/* Download the whole tour as a blob (with progress) so every scrub is instant and
   scrubbing stays disabled until it's fully local — no seeking a half-loaded stream.
   Readiness is fired from several signals (events + poll + timeout) so it never gets
   stuck if one event doesn't fire; markReady is idempotent via the `ready` guard. */
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
        setFill(Math.round(received / total * 100) + '%');
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
  .catch(() => { markReady(); });

function tourProgress() {
  const rect = tour.getBoundingClientRect();
  const scrollable = rect.height - innerHeight;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, -rect.top / scrollable));
}

function setChapter(idx) {
  if (idx === currentChapter || switching) return;
  switching = true;
  caption.classList.add('switching');
  setTimeout(() => {
    const c = CHAPTERS[idx];
    capRoman.textContent = c.roman;
    capName.textContent = c.name;
    capDesc.textContent = c.desc;
    caption.classList.remove('switching');
    currentChapter = idx;
    switching = false;
  }, 300);
  stops.forEach((s, i) => {
    s.classList.toggle('current', i === idx);
    s.classList.toggle('passed', i < idx);
  });
}

function update() {
  const rect = tour.getBoundingClientRect();
  const inTour = rect.top < innerHeight * 0.5 && rect.bottom > innerHeight * 0.5;
  rail.classList.toggle('active', inTour);

  if (ready && duration > 0) {
    const p = tourProgress();
    targetTime = p * (duration - 0.05);
    /* smooth the scrub — lerp toward target, one seek in flight at a time */
    if (!video.seeking) {
      const delta = targetTime - video.currentTime;
      if (Math.abs(delta) > 1.2) {
        video.currentTime = video.currentTime + delta * 0.45;
      } else if (Math.abs(delta) > 0.01) {
        video.currentTime = targetTime;
      }
    }
    railFill.style.height = (p * 100).toFixed(2) + '%';
    setChapter(Math.min(3, Math.floor(p * 4)));
  }
}

function frame() {
  update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
/* also update on scroll + seek completion so the scrub keeps pace even if rAF is throttled */
addEventListener('scroll', update, { passive: true });
video.addEventListener('seeked', update);

/* ═══════════ GOOEY TEXT REVEAL ═══════════
   Splits a block into visual lines, wraps each line in a filtered layer, then
   animates the inner blur out on scroll. Lines are found by measuring where
   words actually wrap, so it re-splits correctly on resize. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = [...document.querySelectorAll('[data-gooey]')];
  if (!targets.length) return;

  /* wrap every word (and honour <br> / inline tags like <em>) in measurable spans */
  function tokenize(el) {
    const out = [];
    const walk = (node, inherited) => {
      node.childNodes.forEach(child => {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part.length) return;
            if (/^\s+$/.test(part)) { out.push({ space: true }); return; }
            const s = document.createElement('span');
            s.className = 'gooey-w';
            s.style.display = 'inline-block';
            s.textContent = part;
            out.push({ node: inherited ? inherited.cloneNode(false) : null, span: s });
          });
        } else if (child.nodeName === 'BR') {
          out.push({ br: true });
        } else if (child.nodeType === 1) {
          walk(child, child);          // e.g. <em> — remember it so we can re-wrap
        }
      });
    };
    walk(el, null);
    return out;
  }

  function build(el) {
    if (!el.dataset.gooeyHtml) el.dataset.gooeyHtml = el.innerHTML;
    else el.innerHTML = el.dataset.gooeyHtml;         // restore before re-splitting

    const tokens = tokenize(el);
    el.innerHTML = '';
    const frag = document.createDocumentFragment();
    tokens.forEach(t => {
      if (t.space) { frag.appendChild(document.createTextNode(' ')); return; }
      if (t.br) { frag.appendChild(document.createElement('br')); return; }
      if (t.node) { t.node.appendChild(t.span); frag.appendChild(t.node); }
      else frag.appendChild(t.span);
    });
    el.appendChild(frag);

    /* group words into lines by their vertical position */
    const words = [...el.querySelectorAll('.gooey-w')];
    if (!words.length) return;
    const lines = [];
    let top = null;
    words.forEach(w => {
      const t = Math.round(w.offsetTop);
      if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
      lines[lines.length - 1].push(w.parentNode === el ? w : w.parentNode);
    });

    /* rebuild as line > inner > words */
    const out = document.createDocumentFragment();
    lines.forEach((items, i) => {
      const line = document.createElement('span');
      line.className = 'gooey-line';
      const inner = document.createElement('span');
      inner.className = 'gooey-inner';
      inner.style.setProperty('--gi', i);
      items.forEach((item, j) => {
        if (j) inner.appendChild(document.createTextNode(' '));
        inner.appendChild(item);
      });
      line.appendChild(inner);
      out.appendChild(line);
      /* keep a real space between lines so copy-paste and screen readers
         don't run the last word of one line into the first of the next */
      if (i < lines.length - 1) out.appendChild(document.createTextNode(' '));
    });
    el.innerHTML = '';
    el.appendChild(out);
    el.classList.add('gooey');
  }

  targets.forEach(build);

  if (reduce) { targets.forEach(t => t.classList.add('in')); return; }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });
  targets.forEach(t => io.observe(t));

  /* re-split on resize (line breaks move); keep the revealed state */
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => targets.forEach(el => {
      const wasIn = el.classList.contains('in');
      build(el);
      if (wasIn) el.classList.add('in');
    }), 200);
  });
})();
