// Loadout Creator — configuration
//
// This file defines the *framework*: which slots exist, how they're grouped
// in the left-hand menu, and the order they're drawn on the soldier (back to
// front). It ships with empty item lists — add real gear later either by
// uploading through the app itself (stored per-browser) or by editing
// DEFAULT_ITEMS below with permanent presets shipped with the site.

// Draw order, back (bottom of stack) to front (top of stack).
const RENDER_ORDER = [
  "base",
  "footwear",
  "bottom",
  "bottomAccessories",
  "top",
  "belt",
  "beltAccessories",
  "vest",
  "vestAccessories",
  "facewear",
  "eyewear",
  "headwear",
  "headwearAccessories",
];

// Left-hand menu structure. Each group maps to one or more slots.
// type: "single" = pick one item at a time. "multi" = toggle any number on.
const GROUPS = [
  {
    id: "base",
    label: "Base",
    slots: [{ id: "base", label: "Body", type: "single" }],
  },
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
    ],
  },
  {
    id: "vest",
    label: "Armor > Vest",
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
// Each item is { id, name, src, srcBack }. `srcBack` is optional — only
// needed if the item looks different from behind (e.g. a backpack, or a
// plate carrier with a distinct rear panel). Items without a srcBack simply
// don't render while viewing from the rear.
//
// Leave empty and add gear via the in-app uploader, or fill these in once
// final art assets exist (e.g. src: "assets/top/plain_shirt.png").
const DEFAULT_ITEMS = {
  base: [
    {
      id: "base-default",
      name: "Base Body",
      src: "assets/base/front.png",
      srcBack: "assets/base/rear.png",
    },
  ],
};
