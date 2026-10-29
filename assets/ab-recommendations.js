/**
 * Product recommendations (sections/ab-product-recommendations.liquid).
 * The section renders the fallback collection first, then asks Shopify's recommendations
 * endpoint for the same section and swaps the carousel in when there are recommendations.
 * Loads when the section comes near the viewport.
 */
function load(section) {
  if (section.dataset.abLoaded) return;
  section.dataset.abLoaded = 'true';

  fetch(section.dataset.url)
    .then((response) => (response.ok ? response.text() : Promise.reject(response.status)))
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('[data-ab-recommendations-carousel][data-recommended]');
      const current = section.querySelector('[data-ab-recommendations-carousel]');
      if (fresh && current) current.replaceWith(document.importNode(fresh, true));
    })
    .catch(() => {
      /* Keep the fallback products. */
    });
}

function init(root = document) {
  root.querySelectorAll('[data-ab-recommendations]').forEach((section) => {
    if (!('IntersectionObserver' in window)) return load(section);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load(section);
        }
      },
      { rootMargin: '0px 0px 400px 0px' }
    );
    observer.observe(section);
  });
}

init();
document.addEventListener('shopify:section:load', (event) => init(event.target));
