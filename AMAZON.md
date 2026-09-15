# Amazon.ca Associates — Payoff Lab

## Tag in use

| Constant     | Value           |
|--------------|-----------------|
| `AMAZON_TAG` | `payofflab-20` |

Defined in **`amazon.js`** as:

```js
const AMAZON_TAG = 'payofflab-20';
```

On page load, `amazon.js` rewrites every `a[href*="amazon.ca"]` so the `tag` query param matches `AMAZON_TAG`. Static HTML links also include `tag=payofflab-20` so they work before JS runs.

## How to swap the tag

1. Change `AMAZON_TAG` in `amazon.js` to the new Associates tag.
2. Optionally find-replace `payofflab-20` in `index.html` so no-JS / crawl hrefs match (JS will fix them either way).
3. Redeploy `index.html`, `amazon.js`, and related assets.

## Link rules

- Base: `https://www.amazon.ca/s?k=QUERY&tag=TAG` (spaces as `+`)
- Attributes: `rel="nofollow sponsored noopener"` and `target="_blank"`
- Required disclosure (near the section): “As an Amazon Associate I earn from qualifying purchases.”

## Section placement

After the calculator disclaimer, before the Gumroad renewal CTA (`#fun-money`).

## Badge

`img/available-at-amazon-ca-white.png` — from Amazon Associates “Available at Amazon.ca” assets.
