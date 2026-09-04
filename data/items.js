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
      { id: "vestAccessories", label: "MOLLE Pouches", type: "multi" },
      // Patches attach to the vest, so both need one worn — see
      // `dependsOn`. Listed either side of Backpack to mirror the
      // render order: front patches draw under the pack, rear ones over it.
      { id: "vestPatchesFront", label: "Patches (Front)", type: "multi", dependsOn: "vest" },
      // Renders above literally everything (see RENDER_ORDER) — a
      // backpack sits over headwear too, not just the torso layers.
      { id: "vestRearAcc", label: "Backpack", type: "single" },
      { id: "vestPatchesRear", label: "Patches (Rear)", type: "multi", dependsOn: "vest" },
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
// Each item is { id, name, src, srcBack, transformKey, peekBehindBody }.
//
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
