/* Obsidian skin: cursor spotlight on cards. Pointer-only; does nothing on touch. */
(() => {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const SEL = '.ai-card,.voice-card,.rc,.ad,.fn-panel,.case,.sys,.card,.cert,.rz-num,.pf,.kpi';
  const mark = () => document.querySelectorAll(SEL).forEach((el) => el.classList.add('spot'));
  mark();
  new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('.spot');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
})();

/* posters: the first screens load at once; the rest follow quietly after the page is up,
   so nothing is black by the time you scroll to it. A failed image is retried once. */
(() => {
  const vids = [...document.querySelectorAll('video[data-poster]')];
  const show = (v, tries = 0) => {
    const src = v.dataset.poster;
    if (!src) return;
    const im = new Image();
    im.onload = () => { v.poster = src; v.removeAttribute('data-poster'); };
    im.onerror = () => { if (tries < 2) setTimeout(() => show(v, tries + 1), 900); else { v.poster = src; v.removeAttribute('data-poster'); } };
    im.src = tries ? src + (src.includes('?') ? '&' : '?') + 'r=' + tries : src;
  };
  if (!('IntersectionObserver' in window)) { vids.forEach((v) => show(v)); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { rootMargin: '1400px 0px' });
  vids.forEach((v) => io.observe(v));
  const later = () => {
    const rest = vids.filter((v) => v.dataset.poster);
    let i = 0;
    const next = () => { if (i < rest.length) { io.unobserve(rest[i]); show(rest[i++]); setTimeout(next, 120); } };
    next();
  };
  addEventListener('load', () => setTimeout(later, 1200));
})();

/* any <img> that fails on a flaky connection gets two more tries */
document.addEventListener('error', (e) => {
  const el = e.target;
  if (!el || el.tagName !== 'IMG') return;
  const n = +(el.dataset.retry || 0);
  if (n >= 2) return;
  el.dataset.retry = n + 1;
  const base = el.getAttribute('src').replace(/[?&]r=\d+$/, '');
  setTimeout(() => { el.src = base + (base.includes('?') ? '&' : '?') + 'r=' + (n + 1); }, 900);
}, true);
