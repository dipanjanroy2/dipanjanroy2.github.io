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
