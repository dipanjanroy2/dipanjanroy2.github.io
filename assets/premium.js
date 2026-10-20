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

/* posters: fetch a video's poster only when it is about to scroll into view */
(() => {
  const vids = [...document.querySelectorAll('video[data-poster]')];
  const show = (v) => { v.poster = v.dataset.poster; v.removeAttribute('data-poster'); };
  if (!('IntersectionObserver' in window)) { vids.forEach(show); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { rootMargin: '600px 0px' });
  vids.forEach((v) => io.observe(v));
})();
