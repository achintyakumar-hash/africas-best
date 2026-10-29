# Africa's Best — Shopify theme

Custom design for Africa's Best (textured hair care), built as a Shopify theme on top of
**Horizon v4.3.0**. The approved designs come from a Claude Design export that is **not** stored
in this repo. Only these artboards are in scope:

- `FINAL / …` (desktop, 1440px): Homepage, Collection Page, Product Page, Where to Buy Modal,
  Blog Listing, Blog Article
- `FINAL MOBILE / …` (390px) and the `MOBILE STATES` screens
- The dev handoff sheets: Mobile Components, Desktop Components and Responsive Spec

Every other artboard, and every earlier iteration in the design chat, is superseded. Ignore them.

## Working rules (every session follows these)

### 1. Branch and deploys
- Work on the `dev` branch. **Always `git pull --rebase origin dev` before starting any work.**
  Shopify's GitHub integration commits theme editor changes back to this branch.
- **Before every push, check for Shopify editor commits:**
  `git fetch origin dev && git log --format='%h %an <%ae> %s' HEAD..origin/dev`.
  If there are commits you didn't make (Shopify's integration, or the client in the editor),
  rebase onto them and look at what they changed. That is usually `config/settings_data.json`,
  `templates/*.json` or `sections/*-group.json`. Keep their setting changes; never overwrite
  them with an older copy. Mention them in your report.
- Commit in small, logical steps with clear messages. Push after each completed component.
  Shopify deploys `dev` to an unpublished theme for review.
- Shopify silently rejects a file it considers invalid, and keeps the previous version on the
  theme. A template that references a rejected section is rejected too. If the store doesn't
  show a change you pushed, check Online Store > Themes > the dev theme for sync errors before
  assuming it was overwritten.

### 2. Horizon is the base, the design is fully custom
- New sections go in `sections/ab-*.liquid`, snippets in `snippets/ab-*.liquid`, blocks in
  `blocks/ab-*.liquid`, styles in `assets/ab-*.css` and scripts in `assets/ab-*.js`.
  Scripts are vanilla JS: no frameworks and no build step.
- Section groups we own are `sections/ab-header-group.json` and `sections/ab-footer-group.json`.
- Do **not** edit Horizon's core section, snippet, block or asset files. The only Horizon files
  you may touch are:
  - `layout/theme.liquid`, to load our CSS/JS and global sections
  - `config/settings_schema.json`, to add our settings (they live in the "Africa's Best" groups at
    the end of the file)
  - `templates/*.json`, to place our sections
- **Never overwrite `config/settings_data.json` wholesale.** Shopify commits theme editor
  changes back to it. If you must change it, make a minimal, targeted edit on top of the
  latest pulled version.
- `sections/ab-*-group.json` and `templates/*.json` are also written by the theme editor.
  Pull first and edit them surgically.

### 3. Retail-only site
- No prices, no cart icon, no cart drawer, no "Add to cart", no checkout or account links,
  anywhere.
- Product cards link to the product page with a **VIEW** button (`snippets/ab-product-card.liquid`).
- Buying happens only through retailer links on the product page (Where to Buy modal / bottom sheet).
- `assets/ab-base.css` hides Horizon's price, buy-button and cart elements globally, as a
  safety net for templates that have not been rebuilt yet.

### 4. Everything is editable in the theme editor
- Text, images, links, and colors where sensible are section/block settings.
- Repeating items are blocks. Every section has a preset so it can be added from the editor.
- Shared values (Where to Buy link, social links, card eyebrow, fonts) are theme settings under
  "Africa's Best" in `config/settings_schema.json`.

### 5. Mobile-first and responsive
| Range | Layout | Side padding | Section padding |
|---|---|---|---|
| 0–767px | 390px mobile designs | 20px | 56px |
| 768–1023px | mobile layouts with wider grids, hamburger header | 32px | 72px |
| 1024px+ | 1440px desktop designs, content max width 1280px, centered | 40px | 96px |

Write CSS mobile-first: base styles are for mobile, then
`@media (min-width: 768px)` and `@media (min-width: 1024px)`.
Use the tokens in `assets/ab-tokens.css`. Don't hard-code colors, radii or spacing that already
exist as tokens.

### 6. Accessibility
- WCAG 2.1 AA contrast on every text and button state.
- Use semantic HTML and give every image alt text. Decorative images get `alt=""`.
- Visible focus: `outline: 2px solid #123D2E; outline-offset: 2px` (white on dark green
  backgrounds via `.ab-on-dark`).
- Carousels, accordions, menus and modals must work from the keyboard. Modals and drawers
  trap focus, close on Escape and return focus to their trigger.
- Tap targets are at least 44 × 44px. Where the design draws a smaller control (40px mobile
  buttons), extend the hit area with a pseudo-element.

### 7. Performance
- Use `image_url` + `image_tag` with responsive `widths` and `sizes` for every image.
- Lazy-load images below the fold. The first visible image of a page (the hero) is eager, with
  `fetchpriority: 'high'`.
- No heavy libraries. Load scripts with `defer` or `type="module"`. Icons are inline SVG
  (`snippets/ab-icon.liquid`), not an icon font.

### 8. Measurements
- Follow the exact measurements in the dev handoff component sheets and the Responsive Spec.
- When something isn't specified, match the FINAL artboards visually. List the assumption in
  your report to the user.

## Architecture

```
layout/theme.liquid              renders ab-head (global CSS/JS/fonts), ab-header-group, ab-footer-group
snippets/ab-head.liquid          font faces, tokens, base/component/header/footer CSS, header JS
assets/ab-tokens.css             design tokens (colors, placeholders, type scale, spacing, radii)
assets/ab-base.css               base element styles, layout helpers, empty-state helpers, commerce hiding
assets/ab-components.css         buttons, text links, arrows, badges, stars, accordions, carousel
assets/ab-header.css / .js       announcement bar, header, mega menu, dropdowns, drawer, search
assets/ab-footer.css             footer
assets/ab-base.js                dialogs (focus trap/Escape), announcement dismiss, footer toggles
assets/ab-carousel.js            <ab-carousel>: arrows desktop, swipe + dots below 1024, keyboard,
                                 autoplay with pause, theme-editor block select
assets/ab-<section>.css          one stylesheet per section, loaded by that section
assets/ab-video-cards.js         As Seen On You play/pause (loaded by ab-ugc)
assets/ab-marquee.js             scrolling text pause button (loaded by ab-marquee)
assets/ab-product-card.css       product card + product grid/carousel (loaded by sections with cards)
assets/ab-collection.js          collection filter/sort/load more via the Section Rendering API (ab-collection-products)
snippets/ab-button.liquid        the single button component (primary/secondary/on-image/link)
snippets/ab-image.liquid         responsive image + design-photo fallback + empty-state placeholder
snippets/ab-fallback-url.liquid  placeholder photo URLs used until real images are uploaded
snippets/ab-icon.liquid          inline SVG icon set
snippets/ab-product-card.liquid  the single product card, used everywhere products appear
snippets/ab-stars.liquid         star rating (size from the parent's --ab-star-size)
snippets/ab-logo.liquid          logo image, or the text wordmark fallback
sections/ab-*.liquid             sections
```

### Loading section assets
Each section loads only its own assets at the top of its file:
`{{ 'ab-x.css' | asset_url | stylesheet_tag: preload: true }}` and
`<script src="{{ 'ab-x.js' | asset_url }}" type="module"></script>`. Module scripts run once even when
two sections include the same file. Don't add section CSS/JS to `ab-head`, and don't use
`{% stylesheet %}`, because Shopify bundles that CSS onto every page.

### Images and empty states
- Render images with `snippets/ab-image.liquid`. Only the first hero image is eager, with
  `preload`. Everything else is lazy.
- The image's container sets the size or aspect ratio and a placeholder background
  (`--ab-color-placeholder`, or `--ab-color-placeholder-dark` behind white text). A missing or
  failed image then leaves a neutral block instead of a broken icon or a collapsed box.

### Collection and page handles used as defaults
Collections: best-sellers, growth-oils, olive-oil-conditioning, repair-restore, kids, skin-care,
bundles, hair-growth, deep-moisture, scalp-care.
Pages: about-us, where-to-buy, contact, faq, hair-care-guide, accessibility-policy.

### Breakpoint names
- `--ab-bp-tablet: 768px`, `--ab-bp-desktop: 1024px`. CSS custom properties can't be used in
  media queries, so write the literal values `768px` / `1024px`.

### Collection page
- `templates/collection.json`: ab-collection-banner, ab-collection-products, ab-ugc, ab-faq.
- Filters come from Search & Discovery (`collection.filters`). Never render `price_range` filters or
  price sorts. Filter/sort changes re-render `ab-collection-products` with `?section_id=` and keep
  the URL in sync.
- Per-collection FAQ: metafield `custom.faq` (list of `faq` metaobjects with `question` and
  `answer` fields). `ab-faq` with "Use the page's own FAQ" falls back to its blocks.

### Product data used by the product card
- Badge: metafield `custom.badge` (single line text, e.g. "Best Seller" or "New"). Falls back to
  a product tag `badge:Best Seller` / `badge:New`.
- Benefit line: metafield `custom.benefit` (single line text).
- Hover image: metafield `custom.card_hover_image` (file, image).
- Rating: standard metafields `reviews.rating` / `reviews.rating_count` (written by review apps).

## Checking your work
- Validate every section schema and JSON template against the Shopify rules that theme-check
  does **not** catch. Any of these makes Shopify reject the file:
  - `url` setting defaults may only be `/collections` or `/collections/all`. Put real links in
    the template JSON or in a Liquid `default:` fallback.
  - `range` defaults and saved values must sit on a step: `(value - min) % step == 0`.
    Each range has at most 101 steps.
  - `select` values must be one of the options. `richtext` defaults must start with a block tag
    (`<p>`, `<ul>` …).
  - Every setting/block id saved in `templates/*.json` and `sections/*-group.json` must exist in
    the section schema, and blocks must not exceed `max_blocks`.
- Run Shopify theme-check on the repo before you push. It is not committed here; install it
  outside the repo with `npm i @shopify/theme-check-node` and run it through its `check()` API.
  Only fix offenses in `ab-*` files.
- Search the whole repo for price or cart output after each change.
