# Loadout Creator

A 2D "dress the soldier" configurator. Pick a category on the left, click an
item to equip it, and it layers onto the stage in the middle. The base body
always renders — it's not a selectable item.

Items are curated, not user-uploaded: add gear by dropping image files into
`assets/<slot>/` and registering them in `data/items.js` under
`DEFAULT_ITEMS`, e.g.:

```js
const DEFAULT_ITEMS = {
  top: [
    { id: "top-plain-shirt", name: "Plain Shirt", src: "assets/top/plain_shirt.png" },
  ],
};
```

`srcBack` is optional on any item — add it if the item looks different
from behind (a backpack, a plate carrier's rear panel, etc.). Items
without a `srcBack` simply don't render while the stage is in Rear view.
The base body ships with both (`assets/base/front.png` /
`assets/base/rear.png`).

The stage has a Front / Rear toggle above it that switches every layer to
its back-view art (skipping layers that don't have one), and a zoom control
that scales the whole composed figure as one locked unit (equipped items
never drift relative to each other while zooming).

## Categories / slots

Defined in `data/items.js`:

- **Top** — shirts, ubaks, uniforms, winter clothing
- **Bottom** — pants, + accessories (knee pads, hip holster, thigh armor)
- **Belt** — battle belt / rigger's belt, + pouches
- **Vest** — plate carriers, chest rigs, + MOLLE pouches
- **Footwear** — boots, shoes
- **Facewear** — masks, balaclavas
- **Eyewear** — goggles, glasses
- **Headwear** — helmets, hats, + accessories

Draw order (back to front) is controlled by `RENDER_ORDER` in the same file.

## Aligning gear (Admin Mode)

Gear art rarely shares the base body's exact canvas size/framing (see the
M3MP6 vest, which needed scaling down ~55% and nudging up to sit on the
chest). Rather than hand-editing numbers, use **Admin Mode** (button in the
sidebar):

1. Equip the item(s) you want to align.
2. Turn on Admin Mode, pick the item from the layer list.
3. Drag it on the stage to reposition, scroll to resize, or type exact
   X / Y / Scale values.
4. Front and Rear are calibrated independently — switch views and repeat if
   the item has a `srcBack`.
5. Click **Save site-wide** — this writes `data/itemTransforms.js` so the
   calibration applies for every visitor, not just your browser. Commit and
   push it to ship the change.

Saving requires running the local admin server (see below) — it writes the
file to disk. `npx serve` alone can't do this since it's read-only.

## Running locally

For calibrating items (Admin Mode's "Save site-wide"), run the bundled
server, which also serves the static site:

```bash
node server.js
```

For just browsing without saving, any static server works, e.g.
`npx serve .`, or open `index.html` directly in a browser.

## Deploying

This is a static site (HTML/CSS/JS, no framework), so it deploys to Vercel
as-is: push to a GitHub repo, then import it in Vercel with the framework
preset set to "Other". `server.js` is a local-only dev convenience — it
isn't needed in production and Admin Mode's save simply won't work there
(there's nowhere for a static deployment to persist the write); do all
calibration locally and ship the resulting `data/itemTransforms.js`.
