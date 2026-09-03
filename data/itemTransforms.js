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
      "x": 1.1111111111111112,
      "y": -14.10244215448829,
      "scale": 0.43
    },
    "rear": {
      "x": 1.6666666666666665,
      "y": -21.14692708715765,
      "scale": 0.3199999999999994
    }
  },
  "base-default": {
    "front": {
      "x": 0,
      "y": 0,
      "scale": 1.1800000000000002
    },
    "rear": {
      "x": 0,
      "y": 0,
      "scale": 1.1800000000000002
    }
  },
  "top-mm14-ubacs": {
    "front": {
      "x": 1.1111111111111112,
      "y": -15.096507330445212,
      "scale": 0.47999999999999987
    },
    "rear": {
      "x": 1.3888888888888888,
      "y": -16.193014660890427,
      "scale": 0.5199999999999999
    }
  },
  "top-mm14-jacket": {
    "front": {
      "x": 0,
      "y": -14,
      "scale": 0.6
    },
    "rear": {
      "x": 0,
      "y": -14,
      "scale": 0.6
    }
  },
  "bottom-mm14-uniform": {
    "front": {
      "x": 0,
      "y": 37,
      "scale": 0.76
    },
    "rear": {
      "x": 0,
      "y": 37,
      "scale": 0.76
    }
  }
};
