/**
 * Scrolling text band: pause/resume button. Hover pause and reduced motion are handled in CSS.
 * Loaded as a module by sections/ab-marquee.liquid.
 */
(() => {
  if (window.__abMarquee) return;
  window.__abMarquee = true;

  /* ---------- Scrolling text band ---------- */
  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-ab-marquee-toggle]');
    if (!toggle) return;
    const marquee = toggle.closest('[data-ab-marquee]');
    const paused = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Play scrolling text' : 'Pause scrolling text';
    marquee?.classList.toggle('is-paused', paused);
  });
})();
