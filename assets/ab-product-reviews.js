/**
 * Review list pagination (sections/ab-product-reviews.liquid).
 * <ab-review-pages data-per-page="4">: shows one page of reviews at a time with numbered
 * buttons (1 2 3 … 32 for long lists) and prev/next. Without JavaScript every review shows.
 */
class AbReviewPages extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('[data-ab-review]'));
    this.perPage = parseInt(this.dataset.perPage, 10) || 4;
    this.pages = Math.ceil(this.items.length / this.perPage);
    this.nav = this.querySelector('[data-ab-review-nav]');
    this.list = this.querySelector('[data-ab-page-list]');
    if (!this.nav || !this.list || this.pages < 2) return;

    this.prev = this.nav.querySelector('[data-ab-page="prev"]');
    this.next = this.nav.querySelector('[data-ab-page="next"]');
    this.prev.addEventListener('click', () => this.show(this.page - 1, true));
    this.next.addEventListener('click', () => this.show(this.page + 1, true));
    this.list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-page]');
      if (button) this.show(parseInt(button.dataset.page, 10), true);
    });

    this.nav.hidden = false;
    this.show(1, false);
  }

  /** Page numbers to draw: all when few, else first 3 (around the current page), …, last. */
  numbers() {
    if (this.pages <= 5) return Array.from({ length: this.pages }, (_, i) => i + 1);
    const start = Math.min(Math.max(this.page - 1, 1), this.pages - 3);
    const run = [start, start + 1, start + 2];
    const out = [];
    if (start > 1) out.push(1, start > 2 ? '…' : null);
    out.push(...run);
    if (start + 2 < this.pages - 1) out.push('…');
    if (start + 2 < this.pages) out.push(this.pages);
    return out.filter((n) => n !== null);
  }

  show(page, moveFocus) {
    this.page = Math.min(Math.max(page, 1), this.pages);
    const first = (this.page - 1) * this.perPage;
    this.items.forEach((item, i) => {
      item.hidden = i < first || i >= first + this.perPage;
    });

    this.list.replaceChildren(
      ...this.numbers().map((n) => {
        const li = document.createElement('li');
        if (n === '…') {
          li.className = 'ab-pagination__gap';
          li.setAttribute('aria-hidden', 'true');
          li.textContent = '…';
          return li;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ab-pagination__page';
        button.dataset.page = String(n);
        button.textContent = String(n);
        button.setAttribute('aria-label', `Page ${n}`);
        if (n === this.page) button.setAttribute('aria-current', 'page');
        li.appendChild(button);
        return li;
      })
    );

    this.prev.disabled = this.page === 1;
    this.next.disabled = this.page === this.pages;

    if (moveFocus) {
      // Bring the new page into view and keep focus on the control that was used.
      const active = this.list.querySelector('[aria-current="page"]');
      this.items[first]?.scrollIntoView({ block: 'nearest' });
      if (document.activeElement === document.body || !this.contains(document.activeElement)) active?.focus();
    }
  }
}

if (!customElements.get('ab-review-pages')) customElements.define('ab-review-pages', AbReviewPages);
