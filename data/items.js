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
  "top",
  "belt",
  "beltAccessories",
  "beltRear",
  "vest",
  "vestAccessories",
  "facewear",
  "eyewear",
  "headwear",
  "headwearAccessories",
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
      { id: "beltAccessories", label: "Pouches", type: "multi" },
      { id: "beltRear", label: "Rear Accessory", type: "single" },
    ],
  },
  {
    id: "vest",
    label: "Vest",
    slots: [
      { id: "vest", label: "Plate Carrier / Chest Rig", type: "single" },
      { id: "vestAccessories", label: "MOLLE Pouches", type: "multi" },
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
// Each item is { id, name, src, srcBack, transformKey }.
//
// - `srcBack` is optional — only needed if the item looks different from
//   behind (e.g. a backpack, or a plate carrier's rear panel). Items
//   without a srcBack simply don't render while viewing from the rear.
// - A rear-only item (nothing hangs off the front) just omits `src` and
//   sets `srcBack` — it then only shows up, and is only selectable, in
//   Rear view.
// - `transformKey` is optional. Admin-mode calibration (position/scale) is
//   normally keyed by the item's own `id`. Set `transformKey` to another
//   item's id to reuse *its* calibration instead — for color/pattern
//   variants of the same physical object, which should always sit in
//   exactly the same spot. Calibrate the first variant, then give every
//   other variant `transformKey: "<that variant's id>"` and they inherit
//   it automatically (recalibrating one recalibrates all of them).
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
      name: "Seating Pad (Folded)",
      srcBack: "assets/Belt/seating_pad_folded.png",
    },
    {
      id: "beltrear-seatpad-unfolded",
      name: "Seating Pad (Unfolded)",
      srcBack: "assets/Belt/seating_pad_unfolded.png",
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
};
