/**
 * Collection filtering, sorting and load more (sections/ab-collection-products.liquid).
 * - Any change in the filter & sort form re-renders the section through Shopify's Section
 *   Rendering API, swaps in the new grid, counts and filter values, and keeps the URL in sync
 *   (history.pushState). Back/forward re-render the matching state.
 * - The drawer stays open while filtering; its "Show N results" button closes it.
 * - "Load more" appends the next page of products.
 * - Without JavaScript the form submits normally and Load more is a regular link.
 * The drawer itself opens/closes through window.AB (assets/ab-base.js): focus trap, Escape,
 * focus returned to the Filter & sort button.
 */
(() => {
  if (customElements.get('ab-collection-filters')) return;

  const DEBOUNCE_MS = 300;

  class AbCollection {
    constructor(root) {
      this.root = root;
      this.sectionId = root.dataset.sectionId;
      this.baseUrl = root.dataset.url;
      this.form = root.querySelector('[data-ab-filter-form]');
      this.drawer = root.querySelector('[data-ab-filters]');
      this.controller = null;
      this.timer = null;

      this.form?.addEventListener('change', () => this.queueUpdate());
      this.form?.addEventListener('submit', (event) => {
        event.preventDefault();
        clearTimeout(this.timer);
        this.update(this.formParams()).then(() => this.closeDrawer());
      });

      root.addEventListener('click', (event) => {
        const clear = event.target.closest('[data-ab-clear-filters]');
        if (clear) {
          event.preventDefault();
          this.clearFilters();
          return;
        }
        const more = event.target.closest('[data-ab-load-more]');
        if (more) {
          event.preventDefault();
          this.loadMore(more);
        }
      });
    }

    /** Current form state as URL params (without empty values). */
    formParams() {
      const params = new URLSearchParams();
      if (!this.form) return params;
      for (const [key, value] of new FormData(this.form)) {
        if (value !== '') params.append(key, value);
      }
      // "Featured" is the default sort; leave it out to keep URLs clean.
      if (params.get('sort_by') === this.form.dataset.defaultSort) params.delete('sort_by');
      return params;
    }

    queueUpdate() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.update(this.formParams()), DEBOUNCE_MS);
    }

    clearFilters() {
      const sort = this.form?.querySelector('input[name="sort_by"]:checked')?.value;
      this.form?.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.checked = false;
      });
      const params = new URLSearchParams();
      if (sort && sort !== this.form.dataset.defaultSort) params.set('sort_by', sort);
      this.update(params);
    }

    closeDrawer() {
      if (this.drawer && !this.drawer.hidden) window.AB?.closeDialog(this.drawer);
    }

    async fetchSection(url) {
      this.controller?.abort();
      this.controller = new AbortController();
      const fetchUrl = new URL(url, window.location.origin);
      fetchUrl.searchParams.set('section_id', this.sectionId);
      const response = await fetch(fetchUrl, { signal: this.controller.signal });
      if (!response.ok) throw new Error(`Section request failed: ${response.status}`);
      return new DOMParser().parseFromString(await response.text(), 'text/html');
    }

    /**
     * Re-render for the given params.
     * @param {URLSearchParams} params
     * @param {{ push?: boolean }} options - push a history entry (false for back/forward)
     */
    async update(params, { push = true } = {}) {
      const query = params.toString();
      const url = query ? `${this.baseUrl}?${query}` : this.baseUrl;
      const results = this.root.querySelector('[data-ab-results]');
      results?.setAttribute('aria-busy', 'true');

      try {
        const doc = await this.fetchSection(url);
        this.render(doc);
        if (push && url !== window.location.pathname + window.location.search) {
          history.pushState({ abCollection: this.sectionId }, '', url);
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        window.location.href = url; // fall back to a normal page load
      } finally {
        results?.removeAttribute('aria-busy');
      }
    }

    /** Swap in the parts of the freshly rendered section that change. */
    render(doc) {
      const swap = (selector) => {
        const next = doc.querySelector(selector);
        const current = this.root.querySelector(selector);
        if (next && current) current.replaceWith(next);
        return next;
      };

      swap('[data-ab-results]');

      const nextCount = doc.querySelector('[data-ab-count]');
      const count = this.root.querySelector('[data-ab-count]');
      if (nextCount && count) count.textContent = nextCount.textContent;

      const button = this.root.querySelector('.ab-collection__filter-button');
      const nextButton = doc.querySelector('.ab-collection__filter-button');
      if (button && nextButton) {
        button.querySelector('[data-ab-active-count]')?.remove();
        const badge = nextButton.querySelector('[data-ab-active-count]');
        if (badge) button.append(badge);
      }

      const applyLabel = doc.querySelector('[data-ab-apply-label]');
      const currentApply = this.root.querySelector('[data-ab-apply-label]');
      if (applyLabel && currentApply) currentApply.textContent = applyLabel.textContent;

      const clear = doc.querySelector('.ab-filters__clear');
      const currentClear = this.root.querySelector('.ab-filters__clear');
      if (clear && currentClear) currentClear.setAttribute('href', clear.getAttribute('href'));

      this.renderFilterBody(doc);
    }

    /** Update filter values and counts, keeping open groups, focus and scroll position. */
    renderFilterBody(doc) {
      const body = this.root.querySelector('[data-ab-filter-body]');
      const nextBody = doc.querySelector('[data-ab-filter-body]');
      if (!body || !nextBody) return;

      const focusedId = document.activeElement?.id;
      const openGroups = new Set([...body.querySelectorAll('details[open]')].map((group) => group.id));
      const scrollTop = body.scrollTop;

      nextBody.querySelectorAll('details').forEach((group) => {
        group.open = openGroups.has(group.id) || group.hasAttribute('open');
      });
      body.replaceChildren(...nextBody.childNodes);
      body.scrollTop = scrollTop;

      if (focusedId && body.contains(document.getElementById(focusedId))) {
        document.getElementById(focusedId).focus({ preventScroll: true });
      }
    }

    async loadMore(link) {
      const results = this.root.querySelector('[data-ab-results]');
      const grid = this.root.querySelector('[data-ab-grid]');
      const firstNew = grid?.children.length || 0;
      link.setAttribute('aria-busy', 'true');

      try {
        const doc = await this.fetchSection(link.href);
        const nextItems = doc.querySelectorAll('[data-ab-grid] > li');
        grid?.append(...nextItems);
        const nextPagination = doc.querySelector('[data-ab-pagination]');
        const pagination = this.root.querySelector('[data-ab-pagination]');
        if (nextPagination && pagination) pagination.replaceWith(nextPagination);

        // Move focus to the first new product so keyboard users continue from there.
        grid?.children[firstNew]?.querySelector('a')?.focus({ preventScroll: false });
      } catch (error) {
        if (error.name !== 'AbortError') window.location.href = link.href;
      } finally {
        link.removeAttribute('aria-busy');
        results?.removeAttribute('aria-busy');
      }
    }

    /** Back/forward: re-render the state in the URL. */
    onPopState() {
      const params = new URLSearchParams(window.location.search);
      params.delete('page');
      this.syncForm(params);
      this.update(params, { push: false });
    }

    syncForm(params) {
      if (!this.form) return;
      this.form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.checked = params.getAll(input.name).includes(input.value);
      });
      const sort = params.get('sort_by') || this.form.dataset.defaultSort;
      this.form.querySelectorAll('input[name="sort_by"]').forEach((input) => {
        input.checked = input.value === sort;
      });
    }
  }

  // Marker element so the module only initialises once even if loaded twice.
  customElements.define('ab-collection-filters', class extends HTMLElement {});

  const instances = new Map();
  const init = (scope = document) => {
    scope.querySelectorAll('[data-ab-collection]').forEach((root) => {
      if (!instances.has(root)) instances.set(root, new AbCollection(root));
    });
  };

  window.addEventListener('popstate', () => instances.forEach((instance) => instance.onPopState()));
  document.addEventListener('shopify:section:load', (event) => init(event.target));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
})();
