/* ═══════════ ALTANA — Studio di Architettura ═══════════
   No framework, no animation library. Every scroll-driven effect on the page
   reads the scroll position once per event, in one pass, at the bottom. */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const IS_TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;

/* ═══ SMOOTH SCROLL ═══
   One instance and one instance only — two Lenis loops fight over the same
   scroll position and the page visibly judders. Everything else on this page
   listens to the native scroll event, which Lenis still fires, so nothing
   below needs to know it is here. */
let lenis = null;
if (window.Lenis && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  lenis = window.lenis = new Lenis({
    duration: 1.05,
    /* exponential ease-out: quick to answer the wheel, long to settle */
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.6,
  });

  /* Lenis owns the rAF loop; this is the one place rAF is correct here,
     because without a frame there is nothing to smooth in the first place. */
  const tick = time => { lenis.raf(time); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  /* anchor links have to go through Lenis or they jump */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0 });
  });
}

/* ═══ HERO FILM ═══
   The src is assigned here rather than in the markup: pointing the tag at a
   file up front makes the browser start fetching before we know which cut it
   needs, and on a phone that is the heavier file pulled for nothing. */
const heroVideo = document.getElementById('heroVideo');
heroVideo.src = IS_TOUCH ? 'assets/hero-m.mp4' : 'assets/hero.mp4';
heroVideo.load();
/* autoplay is a request, not a promise — if the browser refuses, the poster
   stays and the hero simply reads as a still */
heroVideo.play().catch(() => {});

/* ═══ HEADER ═══
   Retracts on the way down and comes straight back the moment you reverse, so
   the bar is out of the way while reading but never more than a flick away. */
const nav = document.getElementById('nav');
let lastY = 0;

function navPass() {
  const y = Math.max(0, scrollY);
  /* the top of the page always shows it, and small jitters are ignored so a
     trackpad's noise cannot make the bar flicker */
  if (y < 120 || y < lastY - 4) nav.classList.remove('retracted');
  else if (y > lastY + 4 && y > 160) nav.classList.add('retracted');
  lastY = y;
}

/* ═══ MENU ═══ */
const burger = document.getElementById('burger');
const menu = document.getElementById('menu');

function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) {
    menu.hidden = false;
    void menu.offsetHeight;            // commit the unhide before transitioning
    menu.classList.add('open');
  } else {
    menu.classList.remove('open');
    setTimeout(() => { if (!menu.classList.contains('open')) menu.hidden = true; }, 520);
  }
}
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

/* ═══ SERVIZI — the photo rides the pointer and swaps to whichever word it is over ═══ */
const servList = document.getElementById('servList');
const servMedia = document.getElementById('servMedia');
const servShots = [...servMedia.children];

if (!IS_TOUCH) {
  let active = -1;
  const place = (x, y) => { servMedia.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`; };

  servList.addEventListener('pointerover', e => {
    const row = e.target.closest('.serv');
    if (!row) return;
    /* The position is set here too, not only from pointermove: pointerover can
       fire before the browser delivers a pointermove at the same coordinates,
       and without this the frame would reveal at whatever translate it was
       last left at — the CSS default, or a stale spot from an earlier hover —
       instead of appearing at the cursor. */
    place(e.clientX, e.clientY);
    const i = +row.dataset.i;
    if (i === active) return;
    active = i;
    servList.querySelectorAll('.serv.on').forEach(n => n.classList.remove('on'));
    row.classList.add('on');
    servShots.forEach(img => img.classList.toggle('on', +img.dataset.i === i));
    servMedia.classList.add('live');
  });

  /* Written straight from the pointer event. Easing it toward the cursor over
     rAF would look softer, but rAF stalls in a background tab and would leave
     the frame stranded mid-flight. */
  servList.addEventListener('pointermove', e => place(e.clientX, e.clientY));

  servList.addEventListener('pointerleave', () => {
    active = -1;
    servList.querySelectorAll('.serv.on').forEach(n => n.classList.remove('on'));
    servMedia.classList.remove('live');
  });
}

/* ═══ REALIZZAZIONI ═══ */
/* `drop` staggers each frame vertically: on the reference the gallery is not a
   tidy row — the photos sit at different heights and sizes as they pass. */
const PROGETTI = [
  { name: 'Lake House',     img: 'assets/proj-bedroom.jpg', place: 'Bengaluru', year: '2025', drop: 0,   size: 1    },
  { name: 'The Penthouse',  img: 'assets/proj-bath.jpg',    place: 'Mumbai',    year: '2025', drop: 7,   size: .82  },
  { name: 'Palm Residence', img: 'assets/proj-dining.jpg',  place: 'Goa',       year: '2024', drop: -5,  size: 1.08 },
  { name: 'Villa Anaya',    img: 'assets/proj-study.jpg',   place: 'Pune',      year: '2024', drop: 11,  size: .9   },
  { name: 'Heritage Court', img: 'assets/statement-a.jpg',  place: 'Jaipur',    year: '2023', drop: -3,  size: 1    },
  { name: 'Sea View House', img: 'assets/statement-b.jpg',  place: 'Mumbai',    year: '2023', drop: 6,   size: .86  },
];

const realizz = document.querySelector('.s-realizzazioni');
const realizzTrack = document.getElementById('realizzTrack');

PROGETTI.forEach(p => {
  const a = document.createElement('a');
  a.className = 'realizz-item';
  a.href = '#contatti';
  a.style.setProperty('--drop', `${p.drop}vh`);
  a.style.setProperty('--size', p.size);
  a.innerHTML = `
    <div class="realizz-media"><img src="${p.img}" alt="${p.name}, ${p.place}" loading="lazy" decoding="async"></div>
    <div class="realizz-cap"><span>${p.name}</span><span>${p.place} · ${p.year}</span></div>`;
  realizzTrack.appendChild(a);
});

/* The section is made exactly as tall as the distance the track has to travel,
   so the sideways movement finishes precisely as the pin releases — measured
   rather than guessed, which keeps it correct at every viewport width. */
function sizeRealizz() {
  const travel = Math.max(0, realizzTrack.scrollWidth - innerWidth);
  realizz.style.height = `${innerHeight + travel}px`;
  realizz.dataset.travel = travel;
}

/* EQUILIBRIO is pinned too: the headline has to cross the whole screen plus its
   own width, and the section is made tall enough to give it that distance. */
const equilSection = document.querySelector('.s-equilibrio');
const equilTitle = document.getElementById('equilTitle');

function sizeEquil() {
  /* The headline is a full sentence at 170px, so its crossing distance is far
     wider than the screen. Giving it one pixel of scroll per pixel of travel
     would pin the section for four and a half screens; capped at 2.15 it felt
     rushed instead — the frame grew and the words flew past before you could
     read them. 3.2 is the middle ground: enough pinned distance that normal
     wheel scrolling reads as resistance rather than a snap-through. */
  equilSection.dataset.travel = innerWidth + equilTitle.offsetWidth;
  equilSection.style.height = `${innerHeight * 3.2}px`;
}

/* ═══ FOOTER LOCKUP ═══
   Both lines have to span the page, and they are different lengths — so the
   size is measured rather than guessed. Set a known size, read how wide the
   text actually renders, then scale by the ratio. */
const lockupLines = [...document.querySelectorAll('.foot-name, .foot-sub')];

function fitLockup() {
  const room = document.documentElement.clientWidth;
  lockupLines.forEach(line => {
    /* Bodoni Moda carries an optical size axis, so its letterforms are not the
       same shape at 100px as at 400px — one measure-and-scale lands close but
       always a little wide. Correcting against the real rendered width settles
       it; two passes is enough to be exact to a fraction of a pixel. */
    let size = 100;
    for (let i = 0; i < 3; i++) {
      line.style.setProperty('--fit', `${size}px`);
      const w = line.getBoundingClientRect().width;
      if (!w) return;
      size *= room / w;
    }
    line.style.setProperty('--fit', `${size.toFixed(3)}px`);
  });
}

/* ═══ SCROLL-DRIVEN PIECES ═══ */
const equilFig = document.getElementById('equilFig');
const equilImg = document.querySelector('.equil-img');
/* any .container will do — its resolved padding is the page gutter in pixels */
const gutterProbe = document.querySelector('.container');
const parallaxes = [...document.querySelectorAll('[data-parallax]')].map(fig => ({
  fig, img: fig.querySelector('img'),
}));

/* how far through the viewport an element is: 0 as its top enters, 1 as its
   bottom leaves */
function through(el) {
  const r = el.getBoundingClientRect();
  return clamp((innerHeight - r.top) / (innerHeight + r.height));
}

function frame() {
  parallaxes.forEach(({ fig, img }) => {
    /* the photo drifts through its mask — the mask shows 100%, the photo is 125% */
    const t = through(fig);
    const spare = img.offsetHeight - fig.offsetHeight;
    if (spare > 0) img.style.transform = `translate3d(0, ${(-t * spare).toFixed(1)}px, 0)`;

    /* and the frame itself wipes open from its outer edge. The wipe is spent by
       the time the figure is halfway up the screen, so it is over well before
       you are actually looking at the photo. */
    fig.style.setProperty('--wipe', `${((1 - clamp(t / 0.5)) * 100).toFixed(1)}%`);
  });

  const eqScrollable = equilSection.offsetHeight - innerHeight;
  if (eqScrollable > 0) {
    const p = clamp(-equilSection.getBoundingClientRect().top / eqScrollable);

    /* First the frame grows out of the gutter to full bleed, over the opening
       third of the pin; the words only start crossing once it has arrived. */
    const grow = clamp(p / 0.34);
    const eased = 1 - Math.pow(1 - grow, 3);
    const room = document.documentElement.clientWidth;
    /* The gutter is read off a real .container, not from --gut: an unregistered
       custom property comes back as its raw `clamp(...)` token, which parseFloat
       turns into NaN — so the offset silently stayed at zero. */
    const gut = parseFloat(getComputedStyle(gutterProbe).paddingLeft) || 0;
    /* 35% of a phone is a 110px sliver, which reads as a mistake rather than a
       frame — narrow screens open from a much larger share of the width. */
    const startW = (room - gut * 2) * (room < 720 ? 0.68 : 0.35);

    equilFig.style.setProperty('--w', `${(startW + (room - startW) * eased).toFixed(1)}px`);
    equilFig.style.setProperty('--h', `${(innerHeight * (0.62 + 0.38 * eased)).toFixed(1)}px`);
    equilFig.style.setProperty('--ml', `${(gut * (1 - eased)).toFixed(1)}px`);

    /* then the headline is pulled all the way across the room */
    const cross = clamp((p - 0.3) / 0.7);
    equilTitle.style.transform = `translate3d(${(-cross * (+equilSection.dataset.travel || 0)).toFixed(1)}px, 0, 0)`;
    equilImg.style.transform = `scale(${(1 + cross * 0.06).toFixed(4)})`;
  }

  /* the gallery runs sideways for exactly as long as the section is pinned */
  const travel = +realizz.dataset.travel || 0;
  const scrollable = realizz.offsetHeight - innerHeight;
  if (scrollable > 0) {
    const p = clamp(-realizz.getBoundingClientRect().top / scrollable);
    realizzTrack.style.transform = `translate3d(${(-p * travel).toFixed(1)}px, 0, 0)`;
  }
}

/* ═══ FORM ═══
   Validated and acknowledged in the browser only. There is no endpoint behind
   it — wire this to a form service or a Worker before it goes live. */
const form = document.getElementById('form');
const formNote = document.getElementById('formNote');

form.addEventListener('input', e => {
  const f = e.target.closest('.field');
  if (f) f.classList.remove('bad');
});

form.addEventListener('submit', e => {
  e.preventDefault();
  let firstBad = null;
  form.querySelectorAll('input, select, textarea').forEach(el => {
    const ok = el.checkValidity();
    el.closest('.field').classList.toggle('bad', !ok);
    if (!ok && !firstBad) firstBad = el;
  });

  if (firstBad) {
    formNote.className = 'form-note';
    formNote.textContent = 'A few details are still missing.';
    firstBad.focus();
    return;
  }

  const first = document.getElementById('fName').value.trim().split(' ')[0];
  form.querySelector('.link-send').disabled = true;
  formNote.className = 'form-note ok';
  formNote.textContent = `Thank you${first ? ', ' + first : ''} — we read every enquiry ourselves and reply within two working days.`;
});

/* ═══ WORD SPLIT ═══
   Each word gets its own clipped box so it can rise out of nothing. Done from
   JS rather than in the markup so the copy stays plain text for search engines
   and screen readers, and stays legible if this never runs. */
document.querySelectorAll('[data-split]').forEach(el => {
  let n = 0;

  /* rebuild in place so a wrapping <span> (the hero's four lines) keeps its own
     box instead of being flattened into one run of words */
  const build = node => {
    const out = [];
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) {
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part.trim()) { out.push(' '); return; }
          out.push(`<span class="w" style="--w:${n++}"><i>${part}</i></span>`);
        });
      } else if (child.nodeType === 1) {
        const inner = build(child);
        const cls = child.className ? ` class="${child.className}"` : '';
        out.push(`<${child.tagName.toLowerCase()}${cls}>${inner}</${child.tagName.toLowerCase()}>`);
      }
    });
    return out.join('');
  };

  el.innerHTML = build(el);
  el.classList.add('done');            // only now may the words sit hidden
});

/* ═══ SCROLL-LINKED TEXT FILL ═══
   Per character, not per word: the reference's boundary lands inside a word,
   which a word- or line-level clip cannot reproduce. Spaces are left as bare
   text nodes so the browser can still break lines normally. */
const fills = [...document.querySelectorAll('[data-fill]')].map(el => {
  const chars = [];
  const build = node => {
    const out = [];
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) {
        [...child.textContent].forEach(ch => {
          out.push(ch === ' ' ? ' ' : `<span class="c">${ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : ch}</span>`);
        });
      } else if (child.nodeType === 1) {
        const t = child.tagName.toLowerCase();
        out.push(`<${t}>${build(child)}</${t}>`);
      }
    });
    return out.join('');
  };
  el.innerHTML = build(el);
  el.classList.add('done');
  chars.push(...el.querySelectorAll('.c'));
  return { el, chars, lit: 0 };
});

function fillPass() {
  fills.forEach(f => {
    const r = f.el.getBoundingClientRect();
    /* runs from the block reaching three-quarters up the screen to it clearing
       the top — the sentence finishes exactly as it starts to leave */
    const p = clamp((innerHeight * 0.78 - r.top) / (r.height + innerHeight * 0.25));
    const want = Math.round(p * f.chars.length);
    if (want === f.lit) return;
    /* only the characters that actually changed are touched, so a long
       statement costs a few writes per event rather than one per character */
    if (want > f.lit) for (let i = f.lit; i < want; i++) f.chars[i].classList.add('lit');
    else for (let i = f.lit - 1; i >= want; i--) f.chars[i].classList.remove('lit');
    f.lit = want;
  });
}

/* ═══ NOTE ARROWS ═══
   Each arrow is a different path, so each needs its own dash length — one
   shared guess leaves the shorter arrow finished early and the longer one
   permanently part-drawn. */
document.querySelectorAll('.note-arrow path').forEach(p => {
  if (typeof p.getTotalLength !== 'function') return;
  p.style.setProperty('--len', Math.ceil(p.getTotalLength()) || 900);
  p.closest('.note')?.classList.add('measured');
});

/* ═══ REVEALS ═══ */
const pending = [...document.querySelectorAll('.rise, .split')];
pending.forEach(el => el.style.setProperty('--d', el.dataset.rise || 0));

function reveals() {
  const trigger = innerHeight * 0.87;
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i].getBoundingClientRect().top < trigger) {
      pending[i].classList.add('in');
      pending.splice(i, 1);            // revealed once, then it costs nothing
    }
  }
}

/* One handler for the whole page. Driven straight off the scroll event rather
   than gated behind requestAnimationFrame: the work is a handful of rect reads
   and transform writes, and an rAF gate would stall every one of these effects
   wherever frames are throttled. */
function pass() { reveals(); frame(); fillPass(); navPass(); }

/* Both sources, deliberately. Lenis drives a virtual position and its own event
   is the only one that fires while it is smoothing; the native event covers
   everything it does not own — anchor jumps, keyboard paging, find-in-page, and
   the case where the library failed to load or its rAF loop is throttled. pass()
   only reads the current position and writes styles, so running twice in a frame
   costs a little and breaks nothing, whereas missing either source freezes the
   whole page. */
if (lenis) lenis.on('scroll', pass);
addEventListener('scroll', pass, { passive: true });

addEventListener('resize', () => { sizeRealizz(); sizeEquil(); fitLockup(); pass(); });
addEventListener('load', () => { sizeRealizz(); sizeEquil(); fitLockup(); pass(); });   /* images set the track width */
/* Web fonts can land after `load`, and every measured piece here — the
   headline's travel, the gallery's track width, the footer lockup — was sized
   with fallback metrics until they do. Measure once more when they arrive. */
document.fonts.ready.then(() => { sizeRealizz(); sizeEquil(); fitLockup(); pass(); });
sizeRealizz();
sizeEquil();
fitLockup();
pass();
