/**
 * Product page behaviour (sections/ab-main-product.liquid).
 * - <ab-product-gallery>: one media per view. Swipe (scroll-snap) on mobile/tablet with a
 *   position indicator; prev/next arrows on desktop; thumbnails select a slide everywhere;
 *   Left/Right arrow keys move between slides while focus is in the gallery.
 * - Deferred media: videos, external videos and 3D models load when their poster is clicked
 *   (gallery and Popular Videos). Leaving a gallery slide pauses its video.
 * - Size pills: pick the matching variant, update the URL (?variant=), show its image and
 *   re-render the retailer links through the Section Rendering API (links can differ per variant).
 * - Sticky Where to Buy bar below 1024px, shown once the main button has scrolled out of view.
 */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const desktopQuery = window.matchMedia('(min-width: 1024px)');

/* ---------- Deferred media ---------- */
function loadModelViewerUI(modelViewer) {
  if (!window.Shopify || typeof window.Shopify.loadFeatures !== 'function') return;
  window.Shopify.loadFeatures([
    {
      name: 'model-viewer-ui',
      version: '1.0',
      onLoad: (errors) => {
        if (errors || !window.Shopify.ModelViewerUI) return;
        const ui = new window.Shopify.ModelViewerUI(modelViewer);
        ui.play?.();
      },
    },
  ]);
}

function loadDeferredMedia(button) {
  const holder = button.parentElement;
  const template = holder?.querySelector('template[data-ab-media-template]');
  if (!template) return;

  const content = template.content.cloneNode(true);
  const player = content.firstElementChild;
  holder.appendChild(content);
  button.remove();
  template.remove();

  const element = holder.querySelector('video, iframe, model-viewer') || player;
  if (!element) return;

  if (element.tagName === 'VIDEO') {
    element.play?.().catch(() => {});
  } else if (element.tagName === 'MODEL-VIEWER') {
    loadModelViewerUI(element);
  }
  element.setAttribute('tabindex', element.getAttribute('tabindex') || '0');
  element.focus({ preventScroll: true });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('.ab-product [data-ab-media-load]');
  if (!button) return;
  event.preventDefault();
  loadDeferredMedia(button);
});

/* ---------- Gallery ---------- */
class AbProductGallery extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-ab-gallery-track]');
    if (!this.track) return;
    this.slides = Array.from(this.track.children);
    this.thumbs = Array.from(this.querySelectorAll('[data-ab-gallery-thumb]'));
    this.dots = Array.from(this.querySelectorAll('[data-ab-gallery-dot]'));
    this.index = -1;

    this.onScroll = this.onScroll.bind(this);
    this.track.addEventListener('scroll', this.onScroll, { passive: true });

    this.querySelector('[data-ab-gallery-prev]')?.addEventListener('click', () => this.go(this.index - 1));
    this.querySelector('[data-ab-gallery-next]')?.addEventListener('click', () => this.go(this.index + 1));
    this.thumbs.forEach((thumb) =>
      thumb.addEventListener('click', () => this.go(parseInt(thumb.dataset.abGalleryThumb, 10)))
    );
    this.addEventListener('keydown', (event) => this.onKeydown(event));

    // Start on the selected variant's image without animating.
    const initial = this.slides.findIndex((slide) => slide.hasAttribute('data-initial'));
    this.go(Math.max(initial, 0), { instant: true });

    // Keep the current slide in place when the layout changes (rotation, window resize).
    this.realign = () => this.go(this.index, { instant: true, force: true });
    this.resizeObserver = new ResizeObserver(this.realign);
    this.resizeObserver.observe(this.track);
    window.addEventListener('resize', this.realign);
  }

  disconnectedCallback() {
    this.track?.removeEventListener('scroll', this.onScroll);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.realign);
  }

  onScroll() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const width = this.track.clientWidth || 1;
      this.setActive(Math.round(this.track.scrollLeft / width));
    });
  }

  onKeydown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.target.closest('video, model-viewer, iframe, input')) return;
    event.preventDefault();
    // From a thumbnail, move relative to that thumbnail and keep focus on the thumbnails.
    const thumb = event.target.closest('[data-ab-gallery-thumb]');
    const base = thumb ? parseInt(thumb.dataset.abGalleryThumb, 10) : this.index;
    this.go(base + (event.key === 'ArrowRight' ? 1 : -1));
    if (thumb) this.thumbs[this.index]?.focus();
  }

  /**
   * @param {number} index - slide index (wraps around)
   * @param {{instant?: boolean, force?: boolean}} [options]
   */
  go(index, { instant = false, force = false } = {}) {
    const count = this.slides.length;
    if (!count) return;
    const target = ((index % count) + count) % count;
    if (target === this.index && !force) return;
    const behavior = instant || reducedMotion.matches ? 'auto' : 'smooth';
    this.track.scrollTo({ left: target * this.track.clientWidth, behavior });
    this.setActive(target);
  }

  selectMedia(mediaId) {
    if (!mediaId) return;
    const index = this.slides.findIndex((slide) => slide.dataset.mediaId === String(mediaId));
    if (index > -1) this.go(index);
  }

  setActive(index) {
    if (index === this.index || index < 0 || index >= this.slides.length) return;
    const previous = this.slides[this.index];
    previous?.querySelectorAll('video').forEach((video) => video.pause());
    this.index = index;

    this.slides.forEach((slide, i) => {
      if (i === index) slide.removeAttribute('inert');
      else slide.setAttribute('inert', '');
    });
    this.thumbs.forEach((thumb, i) => thumb.setAttribute('aria-current', String(i === index)));
    this.dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
  }
}

if (!customElements.get('ab-product-gallery')) customElements.define('ab-product-gallery', AbProductGallery);

/* ---------- Variant picker + sticky bar, per product section ---------- */
function initProductSection(section) {
  if (!section || section.dataset.abReady) return;
  section.dataset.abReady = 'true';

  const form = section.querySelector('[data-ab-variant-form]');
  if (form) initVariantPicker(section, form);
  initStickyBar(section);
}

function initVariantPicker(section, form) {
  let variants = [];
  try {
    variants = JSON.parse(form.querySelector('[data-ab-variants]')?.textContent || '[]');
  } catch (error) {
    return;
  }
  const gallery = section.querySelector('ab-product-gallery');
  let controller;

  form.addEventListener('change', (event) => {
    const fieldset = event.target.closest('fieldset');
    const optionIndex = Array.from(form.querySelectorAll('fieldset')).indexOf(fieldset);
    const selected = Array.from(form.querySelectorAll('fieldset')).map(
      (set) => set.querySelector('input:checked')?.value
    );

    // Exact match, else the first variant with the option that was just changed.
    const variant =
      variants.find((v) => v.options.every((value, i) => value === selected[i])) ||
      variants.find((v) => v.options[optionIndex] === selected[optionIndex]);
    if (!variant) return;

    // Reflect the variant that was found (the other options may have changed with it).
    form.querySelectorAll('fieldset').forEach((set, i) => {
      const input = Array.from(set.querySelectorAll('input')).find((el) => el.value === variant.options[i]);
      if (input && !input.checked) input.checked = true;
      const label = set.querySelector('[data-ab-option-value]');
      if (label) label.textContent = variant.options[i];
    });

    const url = new URL(window.location.href);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url.toString());

    gallery?.selectMedia(variant.media);

    controller?.abort();
    controller = new AbortController();
    const sectionUrl = `${section.dataset.productUrl}?variant=${variant.id}&section_id=${section.dataset.sectionId}`;
    fetch(sectionUrl, { signal: controller.signal })
      .then((response) => (response.ok ? response.text() : Promise.reject(response.status)))
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        section.querySelectorAll('[data-ab-swap][id]').forEach((region) => {
          const fresh = doc.getElementById(region.id);
          if (fresh) region.innerHTML = fresh.innerHTML;
        });
      })
      .catch(() => {
        /* Network error or aborted: the retailer links stay as they were. */
      });
  });
}

function initStickyBar(section) {
  const bar = section.querySelector('[data-ab-sticky-bar]');
  const actions = section.querySelector('.ab-product__actions');
  if (!bar || !actions) return;

  let visible = false;
  const setVisible = (next) => {
    if (next === visible) return;
    visible = next;
    bar.classList.toggle('is-visible', visible);
    bar.setAttribute('aria-hidden', String(!visible));
    bar.toggleAttribute('inert', !visible);
    document.documentElement.classList.toggle('ab-has-sticky-bar', visible);
  };

  // Shown once the main button is above the top of the screen (a scroll position check, so a
  // jump past the button, e.g. from an anchor link or scroll restoration, also shows the bar).
  let frame;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      setVisible(!desktopQuery.matches && actions.getBoundingClientRect().bottom < 0);
    });
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  desktopQuery.addEventListener('change', update);
  update();
}

const initAll = () => document.querySelectorAll('[data-ab-product]').forEach(initProductSection);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
else initAll();

document.addEventListener('shopify:section:load', (event) => {
  initProductSection(event.target.querySelector('[data-ab-product]'));
});

/* Theme editor: selecting an accordion block opens it; selecting a retailer opens the list. */
document.addEventListener('shopify:block:select', (event) => {
  const target = event.target;
  if (!target.closest?.('[data-ab-product]')) return;
  if (target.matches('details')) target.open = true;
  const dialog = target.closest('.ab-wtb');
  if (dialog && dialog.hidden) window.AB?.openDialog(dialog);
});

document.addEventListener('shopify:block:deselect', (event) => {
  const dialog = event.target.closest?.('.ab-wtb');
  if (dialog && !dialog.hidden) window.AB?.closeDialog(dialog);
});
