// Loadout Creator — per-item layer calibration
//
// Gear art doesn't all share the base body's canvas size/framing, so each
// item can be nudged/scaled to line up. Keyed by item id -> per-view
// { x, y, scale, hue, saturate, brightness, shadow } (x/y are percent
// offsets, scale/saturate/brightness are multipliers, hue is degrees,
// shadow is the drop-shadow's opacity 0-1; defaults are
// { x: 0, y: 0, scale: 1, hue: 0, saturate: 1, brightness: 1, shadow: 0.35 }
// for any field an entry omits).
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
      "scale": 0.3199999999999994,
      "hue": 0,
      "saturate": 1,
      "brightness": 1.25
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
      "x": 1.3888888888888886,
      "y": -14.469931713047947,
      "scale": 0.5199999999999999,
      "hue": 0,
      "saturate": 0.65,
      "brightness": 1
    },
    "rear": {
      "x": 1.246438746438746,
      "y": -14.492022520071568,
      "scale": 0.5399999999999999
    }
  },
  "bottom-mm14-uniform": {
    "front": {
      "x": 1.5277777777777777,
      "y": 22.118829086814987,
      "scale": 0.6199999999999999,
      "hue": 0,
      "saturate": 1,
      "brightness": 0.85
    },
    "rear": {
      "x": 1.3503086419753085,
      "y": 22.510438847688278,
      "scale": 0.6399999999999999
    }
  },
  "belt-mm14-rps": {
    "front": {
      "x": 1.736111111111111,
      "y": -1.566439043493159,
      "scale": 0.27999999999999936
    },
    "rear": {
      "x": 1.7361111111111112,
      "y": 3.524487847859608,
      "scale": 0.27999999999999936,
      "hue": 9,
      "saturate": 0.7,
      "brightness": 1.4
    }
  },
  "beltrear-seatpad-folded": {
    "rear": {
      "x": 1.658950617283951,
      "y": 17.75297582625581,
      "scale": 0.6199999999999997,
      "hue": 0,
      "saturate": 0.75,
      "brightness": 1
    }
  },
  "beltrear-seatpad-unfolded": {
    "rear": {
      "x": 1.7746913580246906,
      "y": 16.96975630450922,
      "scale": 0.5999999999999996
    }
  },
  "headwear-kaska": {
    "front": {
      "x": 1.226851851851852,
      "y": -38.61272242210638,
      "scale": 0.19999999999999937,
      "hue": 0,
      "saturate": 1,
      "brightness": 1
    },
    "rear": {
      "x": 0.8680555555555558,
      "y": -39.0957077938501,
      "scale": 0.17999999999999938,
      "hue": 0,
      "saturate": 1,
      "brightness": 1
    }
  }
};
