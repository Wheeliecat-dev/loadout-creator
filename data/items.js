// Loadout Creator — configuration
//
// This file defines the *framework*: which slots exist, how they're grouped
// in the left-hand menu, and the order they're drawn on the soldier (back to
// front). Add real gear by editing DEFAULT_ITEMS below.

// Draw order, back (bottom of stack) to front (top of stack).
const RENDER_ORDER = [
  "base",
  "footwear",
  "bottom",
  "bottomAccessories",
  // Balaclava/mask tucks under the shirt collar and under the helmet, so
  // it draws before both — not grouped with eyewear/headwear even though
  // it's picked from a similar spot in the menu.
  "facewear",
  "top",
  "belt",
  "beltAccessories",
  "beltRear",
  "vest",
  "vestAccessories",
  // Front patches sit on top of the vest/pouches but still under the
  // backpack (which is last, see below).
  "vestPatchesFront",
  "eyewear",
  "headwear",
  "headwearAccessories",
  // Last = topmost. A backpack sits on top of literally everything else in
  // both views (even headwear), unlike ordinary gear.
  "vestRearAcc",
  // Rear patches render on top of the backpack itself (e.g. a flag patch
  // stuck to the pack) — the only rear patch position for now.
  "vestPatchesRear",
];

// Left-hand menu structure. Each group maps to one or more slots.
// type: "single" = pick one item at a time. "multi" = toggle any number on.
//
// "base" is intentionally not a group here — the base body always renders
// (the first entry in DEFAULT_ITEMS.base) and isn't user-selectable.
//
// `attachTo` marks a multi-select slot as MOLLE-attached to whatever's
// equipped in another (single-select) slot — e.g. vestAccessories attaches
// to "vest". Equipping an item there opens a row-picker (from the parent
// item's `molleRows[view]`) plus a slide control instead of toggling
// straight on; position is computed live from the row + slide + the
// parent's own current position/scale, so it moves and resizes correctly
// if the parent is ever recalibrated. Pair it with `dependsOn` pointing at
// the same slot, same as any other attachment.
const GROUPS = [
  {
    id: "top",
    label: "Top",
    slots: [
      { id: "top", label: "Shirts / Uniforms", type: "single" },
    ],
  },
  {
    id: "bottom",
    label: "Bottom",
    slots: [
      { id: "bottom", label: "Pants", type: "single" },
      { id: "bottomAccessories", label: "Knee Pads / Holster / Thigh Armor", type: "multi" },
    ],
  },
  {
    id: "belt",
    label: "Belt",
    slots: [
      { id: "belt", label: "Belt", type: "single" },
      // Both of these attach to the belt itself, so they're locked out
      // (and auto-unequipped) whenever no belt is worn — see `dependsOn`.
      { id: "beltAccessories", label: "Pouches", type: "multi", dependsOn: "belt" },
      { id: "beltRear", label: "Rear Accessory", type: "single", dependsOn: "belt" },
    ],
  },
  {
    id: "vest",
    label: "Vest",
    slots: [
      { id: "vest", label: "Plate Carrier / Chest Rig", type: "single" },
      // `attachTo` makes this a MOLLE slot: instead of a plain toggle, an
      // item picks a row (snapped) and slides left/right along it, keyed
      // to whatever's equipped in the "vest" slot — see the note above
      // DEFAULT_ITEMS and `molleRows` on vest-m3mp6 below.
      { id: "vestAccessories", label: "MOLLE Pouches", type: "multi", dependsOn: "vest", attachTo: "vest" },
      // Patches attach to the vest, so both need one worn — see
      // `dependsOn`. Listed either side of Backpack to mirror the
      // render order: front patches draw under the pack, rear ones over it.
      { id: "vestPatchesFront", label: "Patches (Front)", type: "multi", dependsOn: "vest" },
      // Renders above literally everything (see RENDER_ORDER) — a
      // backpack sits over headwear too, not just the torso layers.
      { id: "vestRearAcc", label: "Backpack", type: "single" },
      // Sits on top of the backpack itself, so it depends on the
      // backpack being worn, not just the vest — see beltRear's note.
      { id: "vestPatchesRear", label: "Patches (Rear)", type: "multi", dependsOn: "vestRearAcc" },
    ],
  },
  {
    id: "footwear",
    label: "Footwear",
    slots: [{ id: "footwear", label: "Boots / Shoes", type: "single" }],
  },
  {
    id: "facewear",
    label: "Facewear",
    slots: [{ id: "facewear", label: "Masks / Balaclavas", type: "single" }],
  },
  {
    id: "eyewear",
    label: "Eyewear",
    slots: [{ id: "eyewear", label: "Goggles / Glasses", type: "single" }],
  },
  {
    id: "headwear",
    label: "Headwear",
    slots: [
      { id: "headwear", label: "Helmets / Hats", type: "single" },
      { id: "headwearAccessories", label: "Accessories", type: "multi" },
    ],
  },
];

// Optional permanent presets. Keyed by slot id -> array of items.
// Each item is { id, name, src, srcBack, thumb, transformKey, peekBehindBody,
// zSlot, companions }.
//
// - `thumb` is optional: overrides which image shows in the item-picker
//   tile. Defaults to `src`, falling back to `srcBack` for rear-only items.
//   Use it when the more "recognizable" view isn't the one worn on the
//   body's front — e.g. the backpack's front is just straps, so its thumb
//   points at the rear art instead.
// - `srcBack` is optional — only needed if the item looks different from
//   behind (e.g. a backpack, or a plate carrier's rear panel). Items
//   without a srcBack simply don't render while viewing from the rear.
// - A rear-only item (nothing hangs off the front) just omits `src` and
//   sets `srcBack` — it then only shows up, and is only selectable, in
//   Rear view. Set `peekBehindBody: true` on one of these and it *does*
//   still show in Front view too — pushed behind the base body (so the
//   body's silhouette occludes it, but it can peek out past the edges)
//   and darkened, as if glimpsed rather than properly lit. Its position
//   there always comes from the item's Rear calibration; there's no
//   separate Front one to tune.
// - `transformKey` is optional. Admin-mode calibration (position/scale,
//   and hue/saturation/brightness grading) is normally keyed by the
//   item's own `id`. Set `transformKey` to another item's id to reuse
//   *its* calibration instead — for color/pattern variants of the same
//   physical object, which should always sit in exactly the same spot.
//   Calibrate the first variant, then give every other variant
//   `transformKey: "<that variant's id>"` and they inherit it
//   automatically (recalibrating one recalibrates all of them).
// - `zSlot` is optional. An item normally stacks at its own slot's
//   position in RENDER_ORDER; set `zSlot` to another slot's id to draw it
//   there instead — e.g. a hooded winter jacket sets
//   `zSlot: "headwearAccessories"` so it renders over the helmet rather
//   than under it like every other Top item. Calibration is unaffected —
//   it's still keyed by the item's own id/view (or its transformKey).
// - `companions` is optional: an array of mini-items (same shape, minus
//   `companions` itself) that render automatically whenever their parent
//   is equipped. They're never their own pickable tile — only the parent
//   shows in the item grid — but each still gets its own row in Admin
//   Mode's layer list, so its position/scale/grading is calibrated
//   independently. Built for exactly this jacket: the body stays a
//   normal Top item (under belt/vest) while the hood is a companion with
//   `zSlot: "headwearAccessories"` so it draws over the helmet — one flat
//   image can't occupy two stack positions, so the hood had to become a
//   second layer to get both right at once.
// - `molleRows` is optional, set on a *parent* item (e.g. a vest), not on
//   the attachment itself: { front: [...], rear: [...] }, each an array of
//   { id, px, py, halfWidth } describing one MOLLE row on that item's own
//   image (px/py = row center, halfWidth = how far a pouch can slide
//   either side of center — all 0-100, top-left origin, independent of
//   the item's on-stage calibration). Measure it once by painting each
//   row solid red on a copy of the art and pixel-scanning it. Items in a
//   slot with `attachTo` pointing at this one will read these to build
//   their row picker; an item with no rows for the current view simply
//   can't be attached while viewing it.
//
// Fill these in once final art assets exist (e.g.
// src: "assets/top/plain_shirt.png").
const DEFAULT_ITEMS = {
  base: [
    {
      id: "base-default",
      name: "Base Body",
      src: "assets/base/front.png",
      srcBack: "assets/base/rear.png",
    },
  ],
  top: [
    {
      id: "top-mm14-ubacs",
      name: "MM14 UBACS",
      src: "assets/Top/mm14_ubacs_front.png",
      srcBack: "assets/Top/mm14_ubacs_back.png",
    },
    {
      id: "top-mm14-jacket",
      name: "MM14 Uniform Jacket",
      src: "assets/Top/mm14_uniform_jacket_front.png",
      srcBack: "assets/Top/mm14_uniform_jacket_back.png",
    },
    {
      id: "top-olive-fleece",
      name: "Olive Fleece",
      src: "assets/Top/olive_fleece_front.png",
      srcBack: "assets/Top/olive_fleece_rear.png",
    },
    {
      id: "top-mm14-winter-jacket",
      name: "MM14 Winter Jacket",
      src: "assets/Top/mm14_winter_jacket_front.png",
      srcBack: "assets/Top/mm14_winter_jacket_back.png",
      // The hood is a separate image so it can render over the helmet
      // (via zSlot) while the jacket body stays under the belt/vest at
      // the normal Top position. Front hood art can be added the same
      // way later — for now it's rear-only.
      companions: [
        {
          id: "top-mm14-winter-jacket-hood",
          name: "Winter Jacket Hood",
          srcBack: "assets/Top/mm14_winter_jacket_hood_back.png",
          zSlot: "headwearAccessories",
        },
      ],
    },
  ],
  bottom: [
    {
      id: "bottom-mm14-uniform",
      name: "MM14 Uniform Pants",
      src: "assets/Bottom/mm14_uniform_front.png",
      srcBack: "assets/Bottom/mm14_uniform_back.png",
    },
  ],
  belt: [
    {
      id: "belt-mm14-rps",
      name: "MM14 RPS",
      src: "assets/Belt/mm14_rps_front.png",
      srcBack: "assets/Belt/mm14_rps_back.png",
    },
  ],
  // Rear-only, single-select: only one can be attached at a time, and
  // nothing here shows up in Front view. Folded/unfolded are different
  // content (not just a recolor), so they're calibrated independently;
  // a same-shape color variant of either one should reuse its
  // transformKey — see note above DEFAULT_ITEMS.
  beltRear: [
    {
      id: "beltrear-seatpad-folded",
      name: "Seating Pad (Folded, Camo)",
      srcBack: "assets/Belt/seating_pad_folded.png",
      peekBehindBody: true,
    },
    {
      id: "beltrear-seatpad-folded-coyote",
      name: "Seating Pad (Folded, Coyote)",
      srcBack: "assets/Belt/seating_pad_folded_cayote.png",
      transformKey: "beltrear-seatpad-folded",
      peekBehindBody: true,
    },
    {
      id: "beltrear-seatpad-folded-olive",
      name: "Seating Pad (Folded, Olive)",
      srcBack: "assets/Belt/seating_pad_folded_olive.png",
      transformKey: "beltrear-seatpad-folded",
      peekBehindBody: true,
    },
    {
      id: "beltrear-seatpad-unfolded",
      name: "Seating Pad (Unfolded)",
      srcBack: "assets/Belt/seating_pad_unfolded.png",
      peekBehindBody: true,
    },
  ],
  vest: [
    {
      id: "vest-m3mp6",
      name: "M3MP6",
      src: "assets/vest/m3mp6_front.png",
      srcBack: "assets/vest/m3mp6_back.png",
      // MOLLE row geometry, measured directly off m3mp6_front_molle.png /
      // m3mp6_back_molle.png (each row painted solid red, one pixel-scan
      // per row): px/py are the row's center in this item's own image,
      // 0-100 top-left origin; halfWidth is how far a pouch can slide
      // either side of center before running off the row, same units.
      molleRows: {
        front: [
          { id: "row1", px: 52.56, py: 36.64, halfWidth: 20.47 },
          { id: "row2", px: 52.09, py: 43.19, halfWidth: 20.23 },
          { id: "row3", px: 51.98, py: 50.17, halfWidth: 20.12 },
          { id: "row4", px: 52.09, py: 56.47, halfWidth: 20.47 },
          { id: "row5", px: 50.47, py: 76.21, halfWidth: 17.44 },
          { id: "row6", px: 50.12, py: 82.41, halfWidth: 16.86 },
          { id: "row7", px: 50.0, py: 88.19, halfWidth: 16.28 },
        ],
        rear: [
          { id: "row1", px: 47.09, py: 39.48, halfWidth: 19.65 },
          { id: "row2", px: 46.74, py: 48.71, halfWidth: 19.3 },
          { id: "row3", px: 46.86, py: 57.41, halfWidth: 19.42 },
          { id: "row4", px: 48.26, py: 67.59, halfWidth: 28.72 },
          { id: "row5", px: 48.49, py: 76.47, halfWidth: 28.95 },
          { id: "row6", px: 47.91, py: 85.69, halfWidth: 28.37 },
          { id: "row7", px: 48.95, py: 93.36, halfWidth: 28.02 },
        ],
      },
    },
    {
      id: "vest-mtac-qrs",
      name: "M-TAC QRS",
      src: "assets/vest/mtac_qrs_front.png",
      srcBack: "assets/vest/mtac_qrs_back.png",
    },
  ],
  // MOLLE-attached (see vestAccessories' `attachTo` above): equipping one
  // opens the row/slide picker instead of toggling it straight on. Its own
  // `scale` (set via Admin Mode as usual) is relative to the *vest's*
  // scale, not the stage — so it resizes correctly if the vest ever gets
  // recalibrated. No molleRows entry needed on the pouch itself; it reads
  // whichever vest is currently worn.
  vestAccessories: [
    {
      id: "vestacc-double-ak-mag",
      name: "Double AK Mag Pouch",
      src: "assets/VestFrontAcc/double_ak_mag_pouch.png",
    },
  ],
  // Same patch art registered on both sides — a flat patch like this can
  // reasonably go on either. Each has its own independent calibration
  // since front and rear placement won't match.
  vestPatchesFront: [
    {
      id: "vestpatch-front-ua",
      name: "UA Flag",
      src: "assets/Patches/ua_patch.png",
    },
  ],
  vestPatchesRear: [
    {
      id: "vestpatch-rear-ua",
      name: "UA Flag",
      srcBack: "assets/Patches/ua_patch.png",
    },
  ],
  facewear: [
    {
      id: "facewear-balaclava-olive",
      name: "Balaclava (Olive)",
      src: "assets/Face/olive_balaclava_front.png",
      srcBack: "assets/Face/olive_balaclava_rear.png",
    },
    {
      id: "facewear-balaclava-coyote",
      name: "Balaclava (Coyote)",
      src: "assets/Face/coyote_balaclava_front.png",
      srcBack: "assets/Face/coyote_balaclava_rear.png",
    },
  ],
  vestRearAcc: [
    {
      id: "vestrearacc-mm14-backpack",
      name: "MM14 Backpack",
      src: "assets/VestRearAcc/mm14_backpack_front.png",
      srcBack: "assets/VestRearAcc/mm14_backpack_rear.png",
      // Front art is just straps — the back view is what's recognizable
      // as "a backpack" in a small picker thumbnail.
      thumb: "assets/VestRearAcc/mm14_backpack_rear.png",
    },
  ],
  headwear: [
    {
      id: "headwear-kaska",
      name: "KASKA",
      src: "assets/Helmet/kaska_front.png",
      srcBack: "assets/Helmet/kaska_rear.png",
    },
    {
      id: "headwear-fast",
      name: "FAST",
      src: "assets/Helmet/fast_front.png",
      srcBack: "assets/Helmet/fast_back.png",
    },
  ],
};
