/**
 * <ab-carousel>: one carousel behaviour for every slider on the site.
 * - Desktop (1024px+): previous/next arrow buttons.
 * - Mobile and tablet: native swipe with scroll-snap, plus dot indicators.
 * - Keyboard: the track is focusable; Left/Right arrow keys move one slide, Home/End jump.
 * - Optional autoplay (data-autoplay="6000") with a pause/play toggle. Off when the visitor
 *   prefers reduced motion; pauses on hover and while focus is inside.
 *
 * Markup:
 * <ab-carousel data-label="Best sellers" data-autoplay="6000">
 *   <ul class="ab-carousel__track" role="list">
 *     <li class="ab-carousel__slide">…</li>
 *   </ul>
 *   <button class="ab-arrow ab-carousel__arrow ab-carousel__arrow--prev" data-ab-prev>…</button>
 *   <button class="ab-arrow ab-carousel__arrow ab-carousel__arrow--next" data-ab-next>…</button>
 *   <div class="ab-carousel__dots" data-ab-dots></div>
 *   <button data-ab-autoplay-toggle>…</button>  (optional)
 * </ab-carousel>
 */
(() => {
  if (customElements.get('ab-carousel')) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  class AbCarousel extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.ab-carousel__track');
      if (!this.track) return;

      this.prevButton = this.querySelector('[data-ab-prev]');
      this.nextButton = this.querySelector('[data-ab-next]');
      this.dotsContainer = this.querySelector('[data-ab-dots]');
      this.toggleButton = this.querySelector('[data-ab-autoplay-toggle]');
      this.positions = [];
      this.activeIndex = 0;

      this.setupAccessibility();

      this.onScroll = this.onScroll.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.track.addEventListener('scroll', this.onScroll, { passive: true });
      this.track.addEventListener('keydown', this.onKeydown);
      this.prevButton?.addEventListener('click', () => this.goTo(this.activeIndex - 1, true));
      this.nextButton?.addEventListener('click', () => this.goTo(this.activeIndex + 1, true));

      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.track);

      this.setupAutoplay();
      this.measure();
    }

    disconnectedCallback() {
      this.resizeObserver?.disconnect();
      this.stopAutoplay();
    }

    get slides() {
      return Array.from(this.track.children).filter((el) => el.classList.contains('ab-carousel__slide'));
    }

    setupAccessibility() {
      const label = this.dataset.label;
      this.setAttribute('role', 'region');
      this.setAttribute('aria-roledescription', 'carousel');
      if (label) this.setAttribute('aria-label', label);

      this.track.setAttribute('tabindex', '0');
      this.track.setAttribute('aria-label', label ? `${label}: use the arrow keys to scroll` : 'Use the arrow keys to scroll');

      const slides = this.slides;
      slides.forEach((slide, index) => {
        slide.setAttribute('aria-roledescription', 'slide');
        if (!slide.hasAttribute('aria-label')) slide.setAttribute('aria-label', `${index + 1} of ${slides.length}`);
      });
    }

    /** Scroll offsets that each reachable "first visible slide" snaps to. */
    measure() {
      const track = this.track;
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const overflow = maxScroll > 1;
      this.dataset.overflow = String(overflow);

      const paddingStart = parseFloat(getComputedStyle(track).scrollPaddingInlineStart) || 0;
      const trackLeft = track.getBoundingClientRect().left;
      const offsets = this.slides.map((slide) =>
        Math.round(track.scrollLeft + slide.getBoundingClientRect().left - trackLeft - paddingStart)
      );

      const positions = offsets.filter((offset) => offset < maxScroll - 1).map((offset) => Math.max(0, offset));
      if (!positions.length || positions[positions.length - 1] < maxScroll - 1) positions.push(maxScroll);
      this.positions = overflow ? positions : [0];

      this.renderDots();
      this.onScroll();
    }

    renderDots() {
      if (!this.dotsContainer) return;
      const count = this.positions.length;
      if (this.dotsContainer.childElementCount === count) return;

      this.dotsContainer.setAttribute('aria-hidden', 'true');
      this.dotsContainer.replaceChildren(
        ...this.positions.map((_, index) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'ab-carousel__dot';
          dot.tabIndex = -1;
          dot.addEventListener('click', () => this.goTo(index, true));
          return dot;
        })
      );
    }

    onScroll() {
      if (this.scrollFrame) return;
      this.scrollFrame = requestAnimationFrame(() => {
        this.scrollFrame = null;
        const scrollLeft = this.track.scrollLeft;
        let closest = 0;
        this.positions.forEach((position, index) => {
          if (Math.abs(position - scrollLeft) < Math.abs(this.positions[closest] - scrollLeft)) closest = index;
        });
        this.setActive(closest);
      });
    }

    setActive(index) {
      this.activeIndex = index;
      const last = this.positions.length - 1;
      if (this.prevButton) this.prevButton.disabled = index <= 0;
      if (this.nextButton) this.nextButton.disabled = index >= last;
      this.dotsContainer?.querySelectorAll('.ab-carousel__dot').forEach((dot, dotIndex) => {
        dot.setAttribute('aria-current', String(dotIndex === index));
      });
    }

    goTo(index, userInitiated = false) {
      const last = this.positions.length - 1;
      if (last < 0) return;
      const target = Math.min(Math.max(index, 0), last);
      if (userInitiated) this.stopAutoplay(true);
      this.track.scrollTo({ left: this.positions[target], behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      this.setActive(target);
    }

    onKeydown(event) {
      if (event.target !== this.track) return;
      const keyMap = {
        ArrowRight: this.activeIndex + 1,
        ArrowLeft: this.activeIndex - 1,
        Home: 0,
        End: this.positions.length - 1,
      };
      if (!(event.key in keyMap)) return;
      event.preventDefault();
      this.goTo(keyMap[event.key], true);
    }

    /* ---------- Autoplay ---------- */
    setupAutoplay() {
      const delay = parseInt(this.dataset.autoplay, 10);
      if (!delay || reducedMotion.matches) {
        if (this.toggleButton) this.toggleButton.hidden = true;
        return;
      }
      this.autoplayDelay = delay;
      this.autoplayPausedByUser = false;

      this.toggleButton?.addEventListener('click', () => {
        if (this.autoplayTimer) {
          this.stopAutoplay(true);
        } else {
          this.autoplayPausedByUser = false;
          this.startAutoplay();
        }
      });

      const pause = () => this.stopAutoplay();
      const resume = () => {
        if (!this.autoplayPausedByUser && !this.contains(document.activeElement)) this.startAutoplay();
      };
      this.addEventListener('mouseenter', pause);
      this.addEventListener('mouseleave', resume);
      this.addEventListener('focusin', pause);
      this.addEventListener('focusout', () => setTimeout(resume, 0));

      this.startAutoplay();
    }

    startAutoplay() {
      if (!this.autoplayDelay || this.autoplayTimer) return;
      this.autoplayTimer = setInterval(() => {
        const next = this.activeIndex >= this.positions.length - 1 ? 0 : this.activeIndex + 1;
        this.goTo(next);
      }, this.autoplayDelay);
      this.updateToggle(true);
    }

    stopAutoplay(byUser = false) {
      if (byUser) this.autoplayPausedByUser = true;
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
      this.updateToggle(false);
    }

    updateToggle(playing) {
      if (!this.toggleButton) return;
      this.toggleButton.setAttribute('aria-label', playing ? 'Pause slideshow' : 'Play slideshow');
      this.toggleButton.dataset.playing = String(playing);
    }
  }

  customElements.define('ab-carousel', AbCarousel);
})();
