// Loadout Creator — per-item layer calibration
//
// Gear art doesn't all share the base body's canvas size/framing, so each
// item can be nudged/scaled to line up. Keyed by item id -> per-view
// { x, y, scale } (x/y are percent offsets, scale is a multiplier; the
// default when an item has no entry is { x: 0, y: 0, scale: 1 }).
//
// Written by Admin Mode's "Save site-wide" button (via server.js) — hand
// edits are fine too, but let the tool do it when you can.
const ITEM_TRANSFORMS = {
  "vest-m3mp6": {
    "front": {
      "x": 0,
      "y": -13.475866537091028,
      "scale": 0.45
    }
  }
};
