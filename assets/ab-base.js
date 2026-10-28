/**
 * Africa's Best shared behaviour.
 * - window.AB.openDialog / closeDialog: modal drawers and overlays with focus trap,
 *   Escape to close, scroll lock, and focus returned to the opener.
 * - Announcement bar dismiss (remembered per message in localStorage).
 * - Footer menu columns: collapsible below 1024px, always open on desktop.
 */
(() => {
  const FOCUSABLE =
    'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

  const desktopQuery = window.matchMedia('(min-width: 1024px)');
  let openStack = [];

  const isVisible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const focusableIn = (container) => Array.from(container.querySelectorAll(FOCUSABLE)).filter(isVisible);

  function lockScroll() {
    document.documentElement.classList.add('ab-scroll-locked');
  }

  function unlockScroll() {
    if (!openStack.length) document.documentElement.classList.remove('ab-scroll-locked');
  }

  function onKeydown(event) {
    const current = openStack[openStack.length - 1];
    if (!current) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog(current.dialog);
      return;
    }

    if (event.key !== 'Tab') return;
    const items = focusableIn(current.dialog);
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * @param {HTMLElement} dialog - element with role="dialog"; shown by removing [hidden]
   * @param {HTMLElement} [opener] - element that receives focus again on close
   * @param {HTMLElement} [initialFocus] - element focused on open (defaults to the first focusable)
   */
  function openDialog(dialog, opener, initialFocus) {
    if (!dialog || openStack.some((entry) => entry.dialog === dialog)) return;

    openStack.push({ dialog, opener: opener || document.activeElement });
    if (opener) opener.setAttribute('aria-expanded', 'true');

    dialog.hidden = false;
    lockScroll();
    if (openStack.length === 1) document.addEventListener('keydown', onKeydown);

    requestAnimationFrame(() => {
      dialog.classList.add('is-open');
      const target = initialFocus || focusableIn(dialog)[0] || dialog;
      target.focus({ preventScroll: true });
    });

    dialog.dispatchEvent(new CustomEvent('ab:dialog-open', { bubbles: true }));
  }

  function closeDialog(dialog) {
    const index = openStack.findIndex((entry) => entry.dialog === dialog);
    if (index === -1) return;
    const [{ opener }] = openStack.splice(index, 1);

    dialog.classList.remove('is-open');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      if (!dialog.classList.contains('is-open')) dialog.hidden = true;
    };
    if (reduced) finish();
    else setTimeout(finish, 250);

    if (!openStack.length) document.removeEventListener('keydown', onKeydown);
    unlockScroll();

    if (opener && document.contains(opener)) {
      opener.setAttribute('aria-expanded', 'false');
      opener.focus({ preventScroll: true });
    }

    dialog.dispatchEvent(new CustomEvent('ab:dialog-close', { bubbles: true }));
  }

  window.AB = Object.assign(window.AB || {}, { openDialog, closeDialog, focusableIn, desktopQuery });

  /* ---------- Generic open/close wiring ----------
   * <button data-ab-open="DialogId" aria-controls="DialogId" aria-expanded="false">
   * <button data-ab-close> inside the dialog, or a backdrop with data-ab-close.
   */
  document.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-ab-open]');
    if (openTrigger) {
      const dialog = document.getElementById(openTrigger.dataset.abOpen);
      if (dialog) {
        event.preventDefault();
        const initial = dialog.querySelector('[data-ab-initial-focus]');
        openDialog(dialog, openTrigger, initial);
      }
      return;
    }

    const closeTrigger = event.target.closest('[data-ab-close]');
    if (closeTrigger) {
      const dialog = closeTrigger.closest('[role="dialog"]') || document.getElementById(closeTrigger.dataset.abClose);
      if (dialog) {
        event.preventDefault();
        closeDialog(dialog);
      }
    }
  });

  /* ---------- Announcement bar ---------- */
  const ANNOUNCEMENT_KEY = 'ab-announcement-dismissed';

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-ab-announcement-close]');
    if (!button) return;
    const bar = button.closest('[data-ab-announcement]');
    if (!bar) return;
    bar.hidden = true;
    try {
      localStorage.setItem(ANNOUNCEMENT_KEY, bar.dataset.key || '1');
    } catch (error) {
      /* Storage unavailable: dismissal lasts for this page view only. */
    }
    // Keep keyboard focus nearby instead of dropping it on <body>.
    document.querySelector('.ab-header a, .ab-header button')?.focus({ preventScroll: true });
  });

  /* ---------- Footer columns ----------
   * Below 1024px each menu column is a collapsible row (closed by default).
   * On desktop the toggle button is hidden by CSS and the links are always shown.
   */
  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-ab-footer-toggle]');
    if (!toggle) return;
    const column = toggle.closest('[data-ab-footer-column]');
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    column?.classList.toggle('is-open', open);
  });
})();
