# Africa's Best — Shopify Theme

## Project

The Africa's Best website on Shopify. The theme is built on Shopify's [Horizon](https://github.com/Shopify/horizon) theme, **version 4.3.0**, and will be given a fully custom design.

> **Retail-only site:** no prices, no cart and no checkout. Products link out to retailers.

## Branches

- `main`: production-ready code.
- `dev`: active development.

All work happens on `dev` or on feature branches that are merged into `dev`.

## Deployment

This repository is connected to Shopify through the Shopify GitHub integration.

- The `dev` branch is linked to an **unpublished theme**. Changes appear there after each push.
- Changes made in the Shopify theme editor are committed back to the connected branch, so **always pull before starting work**:

  ```bash
  git pull origin dev
  ```

## Theme structure

| Folder       | Contents                                   |
| ------------ | ------------------------------------------ |
| `assets/`    | CSS, JavaScript, images and icons          |
| `blocks/`    | Theme blocks                               |
| `config/`    | Theme settings schema and saved settings   |
| `layout/`    | Base layouts (`theme.liquid`, `password.liquid`) |
| `locales/`   | Translation files                          |
| `sections/`  | Sections                                   |
| `snippets/`  | Reusable Liquid snippets                   |
| `templates/` | Page templates (JSON)                      |

## License

Horizon is © Shopify; see `LICENSE.md`.
