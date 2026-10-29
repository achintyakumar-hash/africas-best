/**
 * Video cards (As Seen On You): play/pause toggle, one video at a time.
 * Videos are muted, inline and never autoplay. Loaded as a module by sections/ab-ugc.liquid.
 */
(() => {
  if (window.__abVideoCards) return;
  window.__abVideoCards = true;

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
})();
