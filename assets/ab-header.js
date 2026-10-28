/**
 * Header behaviour:
 * - Desktop nav: dropdown and mega menu panels. They open on click or hover; Escape, a click
 *   outside or tabbing away closes them.
 * - Search overlay: predictive product results from Shopify's /search/suggest.json.
 *   Titles and images only, never prices.
 * The menu drawer and search overlay open/close through window.AB (assets/ab-base.js).
 */
(() => {
  const desktopQuery = window.matchMedia('(min-width: 1024px)');
  const canHover = window.matchMedia('(hover: hover)');

  /* ---------- Desktop navigation ---------- */
  function panelFor(trigger) {
    return document.getElementById(trigger.getAttribute('aria-controls'));
  }

  function closePanel(trigger, returnFocus = false) {
    if (!trigger || trigger.getAttribute('aria-expanded') !== 'true') return;
    trigger.setAttribute('aria-expanded', 'false');
    const panel = panelFor(trigger);
    if (panel) panel.hidden = true;
    if (returnFocus) trigger.focus();
  }

  function closeAll(except) {
    document.querySelectorAll('[data-ab-nav-trigger][aria-expanded="true"]').forEach((trigger) => {
      if (trigger !== except) closePanel(trigger);
    });
  }

  function openPanel(trigger) {
    closeAll(trigger);
    trigger.setAttribute('aria-expanded', 'true');
    const panel = panelFor(trigger);
    if (panel) panel.hidden = false;
  }

  function initNav(root) {
    root.querySelectorAll('[data-ab-nav-item]').forEach((item) => {
      const trigger = item.querySelector('[data-ab-nav-trigger]');
      if (!trigger || item.dataset.abNavReady) return;
      item.dataset.abNavReady = 'true';
      let closeTimer;

      trigger.addEventListener('click', () => {
        if (trigger.getAttribute('aria-expanded') === 'true') closePanel(trigger);
        else openPanel(trigger);
      });

      item.addEventListener('mouseenter', () => {
        if (!desktopQuery.matches || !canHover.matches) return;
        clearTimeout(closeTimer);
        openPanel(trigger);
      });

      item.addEventListener('mouseleave', () => {
        if (!desktopQuery.matches || !canHover.matches) return;
        closeTimer = setTimeout(() => closePanel(trigger), 150);
      });

      item.addEventListener('focusout', (event) => {
        if (!item.contains(event.relatedTarget)) closePanel(trigger);
      });

      item.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
          event.stopPropagation();
          closePanel(trigger, true);
        }
      });
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-ab-nav-item]')) closeAll();
  });

  desktopQuery.addEventListener('change', (event) => {
    if (!event.matches) closeAll();
    else {
      const drawer = document.getElementById('AbMenuDrawer');
      if (drawer && !drawer.hidden) window.AB?.closeDialog(drawer);
    }
  });

  /* ---------- Predictive search ---------- */
  function initSearch(root) {
    const search = root.querySelector('[data-ab-search]') || (root.matches?.('[data-ab-search]') ? root : null);
    if (!search || search.dataset.abSearchReady) return;
    search.dataset.abSearchReady = 'true';

    const input = search.querySelector('[data-ab-search-input]');
    const defaults = search.querySelector('[data-ab-search-default]');
    const live = search.querySelector('[data-ab-search-live]');
    const list = search.querySelector('[data-ab-search-list]');
    const allLink = search.querySelector('[data-ab-search-all]');
    const empty = search.querySelector('[data-ab-search-empty]');
    const endpoint = `${search.dataset.predictiveUrl || '/search/suggest'}.json`;
    const searchUrl = allLink?.getAttribute('href') || '/search';
    let timer;
    let controller;

    const showDefaults = () => {
      if (defaults) defaults.hidden = false;
      live.hidden = true;
      empty.hidden = true;
    };

    const thumbUrl = (product) => {
      const src = product.featured_image?.url || product.image;
      if (!src) return null;
      try {
        const url = new URL(src, window.location.origin);
        url.searchParams.set('width', '128');
        return url.toString();
      } catch (error) {
        return src;
      }
    };

    const render = (query, products) => {
      if (defaults) defaults.hidden = true;
      if (!products.length) {
        live.hidden = true;
        empty.hidden = false;
        empty.textContent = `No products found for “${query}”.`;
        return;
      }
      empty.hidden = true;
      live.hidden = false;
      allLink.href = `${searchUrl}?q=${encodeURIComponent(query)}`;

      list.replaceChildren(
        ...products.map((product) => {
          const li = document.createElement('li');
          const link = document.createElement('a');
          link.className = 'ab-search__product';
          link.href = product.url;

          const thumb = document.createElement('span');
          thumb.className = 'ab-search__thumb';
          const src = thumbUrl(product);
          if (src) {
            const img = document.createElement('img');
            img.src = src;
            img.alt = '';
            img.width = 64;
            img.height = 64;
            img.loading = 'lazy';
            thumb.append(img);
          }

          const title = document.createElement('span');
          title.className = 'ab-search__product-title';
          title.textContent = product.title;

          link.append(thumb, title);
          li.append(link);
          return li;
        })
      );
    };

    const fetchResults = async (query) => {
      controller?.abort();
      controller = new AbortController();
      const params = new URLSearchParams({
        q: query,
        'resources[type]': 'product',
        'resources[limit]': '6',
        'resources[options][unavailable_products]': 'last',
      });
      try {
        const response = await fetch(`${endpoint}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Search failed: ${response.status}`);
        const data = await response.json();
        render(query, data?.resources?.results?.products || []);
      } catch (error) {
        if (error.name !== 'AbortError') showDefaults();
      }
    };

    input?.addEventListener('input', () => {
      clearTimeout(timer);
      const query = input.value.trim();
      if (query.length < 2) {
        controller?.abort();
        showDefaults();
        return;
      }
      timer = setTimeout(() => fetchResults(query), 250);
    });

    search.addEventListener('ab:dialog-close', () => {
      clearTimeout(timer);
      controller?.abort();
    });
  }

  function init(root = document) {
    initNav(root);
    initSearch(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();

  document.addEventListener('shopify:section:load', (event) => init(event.target));
})();
