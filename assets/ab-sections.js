/**
 * Section behaviour shared across pages:
 * - Video cards (As Seen On You): play/pause toggle. Videos are muted, inline, never autoplay.
 * - Scrolling text band: pause/resume button (hover pause is CSS).
 * - Theme editor: selecting a block inside a carousel scrolls it into view.
 */
(() => {
  /* ---------- Video cards ---------- */
  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-ab-video-toggle]');
    if (!toggle) return;
    const card = toggle.closest('[data-ab-video-card]');
    const video = card?.querySelector('video');
    if (!video) return;

    if (video.paused) {
      // Only one video plays at a time.
      document.querySelectorAll('[data-ab-video-card] video').forEach((other) => {
        if (other !== video && !other.paused) other.pause();
      });
      video.muted = true;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });

  const syncVideoState = (event) => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement)) return;
    const card = video.closest('[data-ab-video-card]');
    const toggle = card?.querySelector('[data-ab-video-toggle]');
    if (!toggle) return;
    const playing = !video.paused;
    card.classList.toggle('is-playing', playing);
    toggle.setAttribute('aria-label', toggle.getAttribute('aria-label').replace(playing ? /^Play/ : /^Pause/, playing ? 'Pause' : 'Play'));
  };
  document.addEventListener('play', syncVideoState, true);
  document.addEventListener('pause', syncVideoState, true);

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

  /* ---------- Theme editor ---------- */
  document.addEventListener('shopify:block:select', (event) => {
    const slide = event.target.closest?.('.ab-carousel__slide') || event.target.querySelector?.('.ab-carousel__slide');
    const carousel = slide?.closest('ab-carousel');
    if (carousel && typeof carousel.scrollToSlide === 'function') carousel.scrollToSlide(slide);
  });
})();
