# Loadout Creator

A 2D "dress the soldier" configurator. Pick a category on the left, add gear
images, click to equip them, and they layer onto the stage in the middle.

This repo currently ships as an empty **framework** — no artwork included.
Add items in one of two ways:

1. **In the app** — open a category, click the dashed "+ Add item" tile,
   pick an image, name it. Uploaded items are stored per-browser
   (`localStorage`), so they persist on reload but aren't shared between
   devices or visitors.
2. **As permanent presets** — drop image files into `assets/<slot>/` and
   register them in `data/items.js` under `DEFAULT_ITEMS`, e.g.:

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
its back-view art (skipping layers that don't have one).

## Categories / slots

Defined in `data/items.js`:

- **Base** — the soldier body (upload this first; everything else layers on top)
- **Top** — shirts, ubaks, uniforms, winter clothing
- **Bottom** — pants, + accessories (knee pads, hip holster, thigh armor)
- **Belt** — battle belt / rigger's belt, + pouches
- **Armor > Vest** — plate carriers, chest rigs, + MOLLE pouches
- **Footwear** — boots, shoes
- **Facewear** — masks, balaclavas
- **Eyewear** — goggles, glasses
- **Headwear** — helmets, hats, + accessories

Draw order (back to front) is controlled by `RENDER_ORDER` in the same file.

## Running locally

No build step — just open `index.html` in a browser, or serve the folder
with any static server:

```bash
npx serve .
```

## Deploying

This is a static site (HTML/CSS/JS, no framework), so it deploys to Vercel
as-is: push to a GitHub repo, then import it in Vercel with the framework
preset set to "Other".
