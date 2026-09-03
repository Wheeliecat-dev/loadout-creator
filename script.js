// Loadout Creator — app logic
// Items come from DEFAULT_ITEMS in data/items.js only — there is no
// in-app uploader. Per-item alignment/scale comes from ITEM_TRANSFORMS in
// data/itemTransforms.js, edited live via Admin Mode below.

(function () {
  "use strict";

  const STORAGE_SELECTION = "loadoutCreator.selection";
  const STORAGE_ACTIVE_GROUP = "loadoutCreator.activeGroup";
  const STORAGE_VIEW = "loadoutCreator.view";
  const STORAGE_ZOOM = "loadoutCreator.zoom";
  const STORAGE_PAN = "loadoutCreator.pan";

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 0.1;

  // ---------- Edge de-halo for cutout PNGs ----------
  // Cutout/background-removal tools typically leave partially-transparent
  // edge pixels whose RGB is still blended toward the original white
  // background even as alpha fades to 0 — a pale halo, most visible when
  // zoomed in or against the dark stage. This "un-blends" each such pixel
  // by assuming a white matte and backing out what the true color must
  // have been: true = (observed - 255*(1-alpha)) / alpha. Fully transparent
  // and fully opaque pixels are untouched. Done once per image via an
  // offscreen canvas, cached in memory for the session.
  const cleanImageCache = new Map(); // src -> cleaned data URL

  function clampByte(n) {
    return n < 0 ? 0 : n > 255 ? 255 : n;
  }

  function cleanImage(src, onReady) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      let imageData;
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {
        onReady(src); // e.g. opened via file:// with canvas tainted — skip
        return;
      }
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a === 0 || a === 255) continue;
        const af = a / 255;
        d[i] = clampByte((d[i] - 255 * (1 - af)) / af);
        d[i + 1] = clampByte((d[i + 1] - 255 * (1 - af)) / af);
        d[i + 2] = clampByte((d[i + 2] - 255 * (1 - af)) / af);
      }
      ctx.putImageData(imageData, 0, 0);
      const cleaned = canvas.toDataURL("image/png");
      cleanImageCache.set(src, cleaned);
      onReady(cleaned);
    };
    img.onerror = () => onReady(src);
    img.src = src;
  }

  // Sets imgEl.src to the de-haloed version of `src`, computing it (async)
  // only the first time — every later call for the same src is instant.
  function applyCleanSrc(imgEl, src) {
    const cached = cleanImageCache.get(src);
    if (cached) {
      imgEl.src = cached;
      return;
    }
    imgEl.src = src; // show the original right away, swap once cleaned
    cleanImage(src, (cleaned) => {
      imgEl.src = cleaned;
    });
  }

  const SLOT_TYPE_BY_ID = {};
  const SLOT_DEF_BY_ID = {};
  GROUPS.forEach((group) => {
    group.slots.forEach((slot) => {
      SLOT_TYPE_BY_ID[slot.id] = slot.type;
      SLOT_DEF_BY_ID[slot.id] = slot;
    });
  });

  // Slots that depend on another slot (via `dependsOn`) — e.g. belt pouches
  // and the belt's rear accessory both need a belt equipped first.
  const DEPENDENT_SLOTS = Object.values(SLOT_DEF_BY_ID).filter((s) => s.dependsOn);

  function isSlotUnlocked(slot) {
    return !slot.dependsOn || !!state.selection[slot.dependsOn];
  }

  function getBaseItem() {
    return (DEFAULT_ITEMS.base && DEFAULT_ITEMS.base[0]) || null;
  }

  function loadSelection() {
    const stored = safeParse(localStorage.getItem(STORAGE_SELECTION)) || {};
    const selection = {};
    RENDER_ORDER.forEach((slotId) => {
      if (slotId === "base") return;
      if (SLOT_TYPE_BY_ID[slotId] === "multi") {
        selection[slotId] = Array.isArray(stored[slotId]) ? stored[slotId] : [];
      } else {
        selection[slotId] = typeof stored[slotId] === "string" ? stored[slotId] : null;
      }
    });
    return selection;
  }

  function safeParse(json) {
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  const state = {
    items: DEFAULT_ITEMS || {},
    transforms: JSON.parse(JSON.stringify(ITEM_TRANSFORMS || {})),
    selection: loadSelection(),
    activeGroup: localStorage.getItem(STORAGE_ACTIVE_GROUP) || (GROUPS[0] && GROUPS[0].id),
    view: localStorage.getItem(STORAGE_VIEW) === "rear" ? "rear" : "front",
    zoom: clamp(parseFloat(localStorage.getItem(STORAGE_ZOOM)) || 1, ZOOM_MIN, ZOOM_MAX),
    pan: safeParse(localStorage.getItem(STORAGE_PAN)) || { x: 0, y: 0 },
    adminMode: false,
    selectedItemId: null,
  };

  function persistSelection() {
    localStorage.setItem(STORAGE_SELECTION, JSON.stringify(state.selection));
  }

  function persistActiveGroup() {
    localStorage.setItem(STORAGE_ACTIVE_GROUP, state.activeGroup);
  }

  function persistZoom() {
    localStorage.setItem(STORAGE_ZOOM, String(state.zoom));
  }

  function persistPan() {
    localStorage.setItem(STORAGE_PAN, JSON.stringify(state.pan));
  }

  function findItem(slotId, itemId) {
    return (state.items[slotId] || []).find((i) => i.id === itemId) || null;
  }

  function isSelected(slotId, itemId) {
    const type = SLOT_TYPE_BY_ID[slotId];
    if (type === "multi") {
      return (state.selection[slotId] || []).includes(itemId);
    }
    return state.selection[slotId] === itemId;
  }

  // Unequips anything that depends on `slotId` — called after that slot
  // itself just became empty, since e.g. a seating pad can't stay attached
  // once the belt it hangs off of is gone.
  function clearDependents(slotId) {
    DEPENDENT_SLOTS.filter((s) => s.dependsOn === slotId).forEach((s) => {
      state.selection[s.id] = s.type === "multi" ? [] : null;
    });
  }

  function toggleSelect(slotId, itemId) {
    if (!isSlotUnlocked(SLOT_DEF_BY_ID[slotId])) return;

    const type = SLOT_TYPE_BY_ID[slotId];
    if (type === "multi") {
      const current = state.selection[slotId] || [];
      state.selection[slotId] = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
    } else {
      state.selection[slotId] = state.selection[slotId] === itemId ? null : itemId;
      if (state.selection[slotId] === null) clearDependents(slotId);
    }
    persistSelection();
    renderStage();
    renderSlots(); // refresh selected styling
    refreshAdminPanel();
  }

  function resetLoadout() {
    if (!confirm("Clear the whole loadout?")) return;
    RENDER_ORDER.forEach((slotId) => {
      if (slotId === "base") return;
      state.selection[slotId] = SLOT_TYPE_BY_ID[slotId] === "multi" ? [] : null;
    });
    state.selectedItemId = null;
    persistSelection();
    renderStage();
    renderSlots();
    refreshAdminPanel();
  }

  // ---------- Transform helpers (admin calibration) ----------

  const DEFAULT_TRANSFORM = { x: 0, y: 0, scale: 1, hue: 0, saturate: 1, brightness: 1, shadow: 0.35 };

  // `shadow` is the drop-shadow's opacity (0 = none), admin-tunable per
  // item. Blur/offset stay fixed — only intensity is exposed. Filter order
  // matters: drop-shadow first so it isn't itself hue/brightness-shifted by
  // the grading that follows it.
  function shadowFilter(intensity) {
    return `drop-shadow(0 3px 5px rgba(0,0,0,${intensity}))`;
  }

  function getTransform(itemId, view) {
    const t = state.transforms[itemId] && state.transforms[itemId][view];
    return t ? { ...DEFAULT_TRANSFORM, ...t } : { ...DEFAULT_TRANSFORM };
  }

  function setTransform(itemId, view, patch) {
    if (!state.transforms[itemId]) state.transforms[itemId] = {};
    state.transforms[itemId][view] = { ...getTransform(itemId, view), ...patch };
  }

  function resetTransform(itemId) {
    if (state.transforms[itemId]) delete state.transforms[itemId][state.view];
  }

  // Per-item color grading (hue/saturate/brightness) so gear rendered with
  // mismatched lighting/tone can be nudged toward a common palette. It's a
  // CSS filter, not real image reprocessing, so it's a rough "kinda match"
  // rather than a true color transfer — but it's cheap, live-adjustable in
  // Admin Mode, and needs no server-side processing.
  function layerStyle(itemId, view) {
    const t = getTransform(itemId, view);
    const filter = `${shadowFilter(t.shadow)} hue-rotate(${t.hue}deg) saturate(${t.saturate}) brightness(${t.brightness})`;
    return `transform: translate(${t.x}%, ${t.y}%) scale(${t.scale}); filter: ${filter};`;
  }

  // Color/pattern variants share one item's calibration via `transformKey`
  // instead of each carrying their own — see the note in data/items.js.
  function transformKeyOf(itemId) {
    const item = findItemAnywhere(itemId);
    return (item && item.transformKey) || itemId;
  }

  function updateLayerStyle(itemId) {
    const el = stageContentEl.querySelector(`.layer[data-item-id="${itemId}"]`);
    if (el) el.style.cssText = layerStyle(transformKeyOf(itemId), state.view);
  }

  // Every equipped layer, back-to-front, for the current view.
  function equippedLayers() {
    const baseItem = getBaseItem();
    const layers = [];
    RENDER_ORDER.forEach((slotId) => {
      let ids;
      if (slotId === "base") {
        ids = baseItem ? [baseItem.id] : [];
      } else {
        const type = SLOT_TYPE_BY_ID[slotId];
        ids = type === "multi" ? state.selection[slotId] || [] : [state.selection[slotId]].filter(Boolean);
      }
      ids.forEach((itemId) => {
        const item = slotId === "base" ? baseItem : findItem(slotId, itemId);
        if (item) layers.push({ item, slotId });
      });
    });
    return layers;
  }

  // ---------- Rendering ----------

  const groupNavEl = document.getElementById("group-nav");
  const slotsContainerEl = document.getElementById("slots-container");
  const stageEl = document.getElementById("stage");
  const stageContentEl = document.getElementById("stage-content");
  const itemTileTemplate = document.getElementById("item-tile-template");

  function renderGroupNav() {
    groupNavEl.innerHTML = "";
    GROUPS.forEach((group) => {
      const btn = document.createElement("button");
      btn.className = "group-btn";
      btn.textContent = group.label;
      btn.dataset.groupId = group.id;
      if (group.id === state.activeGroup) btn.classList.add("active");
      btn.addEventListener("click", () => {
        state.activeGroup = group.id;
        persistActiveGroup();
        renderGroupNav();
        renderSlots();
      });
      groupNavEl.appendChild(btn);
    });
  }

  function renderSlots() {
    const group = GROUPS.find((g) => g.id === state.activeGroup) || GROUPS[0];
    slotsContainerEl.innerHTML = "";
    if (!group) return;

    const heading = document.createElement("h2");
    heading.className = "group-heading";
    heading.textContent = group.label;
    slotsContainerEl.appendChild(heading);

    group.slots.forEach((slot) => {
      const slotEl = document.createElement("div");
      slotEl.className = "slot-block";

      const slotTitle = document.createElement("h3");
      slotTitle.className = "slot-title";
      slotTitle.textContent = slot.label + (slot.type === "multi" ? " (multi-select)" : "");
      slotEl.appendChild(slotTitle);

      if (!isSlotUnlocked(slot)) {
        const locked = document.createElement("p");
        locked.className = "slot-empty";
        const parentLabel = (SLOT_DEF_BY_ID[slot.dependsOn] || {}).label || slot.dependsOn;
        locked.textContent = `Equip a ${parentLabel} first.`;
        slotEl.appendChild(locked);
        slotsContainerEl.appendChild(slotEl);
        return;
      }

      const grid = document.createElement("div");
      grid.className = "item-grid";

      const items = state.items[slot.id] || [];
      if (items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "slot-empty";
        empty.textContent = "No items yet.";
        slotEl.appendChild(empty);
      }

      items.forEach((item) => {
        const tile = itemTileTemplate.content.firstElementChild.cloneNode(true);
        applyCleanSrc(tile.querySelector("img"), item.src || item.srcBack); // rear-only items have no `src`
        tile.querySelector("img").alt = item.name;
        tile.querySelector(".item-name").textContent = item.name;
        if (isSelected(slot.id, item.id)) tile.classList.add("selected");

        tile.addEventListener("click", () => toggleSelect(slot.id, item.id));
        tile.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSelect(slot.id, item.id);
          }
        });

        grid.appendChild(tile);
      });

      slotEl.appendChild(grid);
      slotsContainerEl.appendChild(slotEl);
    });
  }

  // Darker than the item's normal grading, on top of it — simulates being
  // glimpsed past the body's silhouette rather than lit head-on.
  const PEEK_DARKEN = 0.55;

  function peekLayerStyle(key) {
    const t = getTransform(key, "rear"); // only a rear calibration exists for these
    const filter = `${shadowFilter(t.shadow)} hue-rotate(${t.hue}deg) saturate(${t.saturate}) brightness(${t.brightness * PEEK_DARKEN})`;
    return `transform: translate(${t.x}%, ${t.y}%) scale(${t.scale}); filter: ${filter};`;
  }

  function renderStage() {
    stageContentEl.innerHTML = "";
    stageEl.classList.toggle("admin", state.adminMode);
    stageEl.classList.toggle("has-selection", state.adminMode && !!state.selectedItemId);

    const layers = equippedLayers();

    // Rear-only accessories flagged `peekBehindBody` (e.g. a seating pad
    // hanging off the back of a belt) still show in Front view — pushed
    // behind the base body and darkened, as if seen past the silhouette
    // rather than properly lit and in front.
    if (state.view === "front") {
      layers
        .filter(({ item }) => item.peekBehindBody && item.srcBack)
        .forEach(({ item, slotId }) => {
          const img = document.createElement("img");
          img.className = "layer layer-peek";
          applyCleanSrc(img, item.srcBack);
          img.alt = item.name;
          img.dataset.itemId = item.id;
          img.dataset.slot = slotId;
          img.style.cssText = peekLayerStyle(item.transformKey || item.id);
          stageContentEl.appendChild(img);
        });
    }

    layers.forEach(({ item, slotId }) => {
      const src = state.view === "rear" ? item.srcBack : item.src;
      if (!src) return; // no art for this view — skip rather than show the wrong side

      const img = document.createElement("img");
      img.className = "layer";
      applyCleanSrc(img, src);
      img.alt = item.name;
      img.dataset.itemId = item.id;
      img.dataset.slot = slotId;
      img.style.cssText = layerStyle(item.transformKey || item.id, state.view);
      if (item.id === state.selectedItemId) img.classList.add("layer-selected");
      stageContentEl.appendChild(img);
    });

    if (!getBaseItem()) {
      const placeholder = document.createElement("div");
      placeholder.className = "base-placeholder";
      placeholder.innerHTML = "No base body yet.<br>Add one in <strong>DEFAULT_ITEMS.base</strong>.";
      stageEl.appendChild(placeholder);
    }
  }

  // ---------- View toggle ----------

  function setView(view) {
    state.view = view;
    localStorage.setItem(STORAGE_VIEW, view);
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    renderStage();
    refreshAdminPanel();
  }

  // ---------- Zoom & pan (locked across every layer) ----------
  // translate() is listed before scale() so the pan offset is in fixed
  // screen pixels regardless of zoom level — dragging tracks the cursor
  // 1:1 at any zoom instead of the pan distance scaling with it.

  function applyViewTransform() {
    stageContentEl.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
    document.getElementById("zoom-level").textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function setZoom(zoom) {
    state.zoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
    if (state.zoom <= 1) {
      state.pan = { x: 0, y: 0 }; // nothing to pan to once fully zoomed out
      persistPan();
    }
    persistZoom();
    applyViewTransform();
  }

  document.getElementById("zoom-in").addEventListener("click", () => setZoom(state.zoom + ZOOM_STEP));
  document.getElementById("zoom-out").addEventListener("click", () => setZoom(state.zoom - ZOOM_STEP));

  // Drag-to-pan for regular users (admin mode's own mousedown handler below
  // takes over item-dragging instead).
  stageEl.addEventListener("mousedown", (e) => {
    if (state.adminMode) return;
    e.preventDefault();

    const startX = e.clientX - state.pan.x;
    const startY = e.clientY - state.pan.y;
    stageEl.classList.add("panning");

    function onMove(ev) {
      state.pan = { x: ev.clientX - startX, y: ev.clientY - startY };
      applyViewTransform();
    }

    function onUp() {
      stageEl.classList.remove("panning");
      persistPan();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  // ---------- Admin Mode ----------
  // (the stage's wheel listener below handles both zoom-when-not-admin and
  // per-item scaling-when-admin, since only one wheel behavior can own the
  // gesture at a time)

  const adminPanelEl = document.getElementById("admin-panel");
  const adminLayerListEl = document.getElementById("admin-layer-list");
  const adminItemNameEl = document.getElementById("admin-item-name");
  const adminXEl = document.getElementById("admin-x");
  const adminYEl = document.getElementById("admin-y");
  const adminScaleEl = document.getElementById("admin-scale");
  const adminHueEl = document.getElementById("admin-hue");
  const adminSaturateEl = document.getElementById("admin-saturate");
  const adminBrightnessEl = document.getElementById("admin-brightness");
  const adminShadowEl = document.getElementById("admin-shadow");
  const adminShadowValueEl = document.getElementById("admin-shadow-value");
  const adminResetItemBtn = document.getElementById("admin-reset-item-btn");
  const adminSaveBtn = document.getElementById("admin-save-btn");
  const adminSaveStatusEl = document.getElementById("admin-save-status");

  function setAdminMode(on) {
    state.adminMode = on;
    document.getElementById("admin-toggle-btn").classList.toggle("active", on);
    adminPanelEl.hidden = !on;
    if (!on) {
      state.selectedItemId = null;
    }
    renderStage();
    refreshAdminPanel();
  }

  function selectLayer(itemId) {
    state.selectedItemId = itemId;
    renderStage();
    refreshAdminPanel();
  }

  function refreshAdminPanel() {
    if (!state.adminMode) return;

    // Layer picker: every currently equipped item for this view.
    adminLayerListEl.innerHTML = "";
    equippedLayers().forEach(({ item }) => {
      const hasArt = state.view === "rear" ? !!item.srcBack : !!item.src;
      const btn = document.createElement("button");
      btn.className = "admin-layer-row";
      if (item.id === state.selectedItemId) btn.classList.add("active");
      btn.textContent = hasArt ? item.name : `${item.name} (no ${state.view} art)`;
      btn.disabled = !hasArt;
      btn.addEventListener("click", () => selectLayer(item.id));
      adminLayerListEl.appendChild(btn);
    });

    const item = state.selectedItemId && findItemAnywhere(state.selectedItemId);
    const fields = [
      adminXEl,
      adminYEl,
      adminScaleEl,
      adminHueEl,
      adminSaturateEl,
      adminBrightnessEl,
      adminShadowEl,
      adminResetItemBtn,
    ];
    if (!item) {
      adminItemNameEl.textContent = "—";
      fields.forEach((el) => (el.disabled = true));
      fields.forEach((el) => el !== adminResetItemBtn && (el.value = ""));
      adminShadowValueEl.textContent = "";
      return;
    }
    const t = getTransform(item.transformKey || item.id, state.view);
    adminItemNameEl.textContent = `${item.name} (${state.view})`;
    fields.forEach((el) => (el.disabled = false));
    adminXEl.value = t.x;
    adminYEl.value = t.y;
    adminScaleEl.value = t.scale;
    adminHueEl.value = t.hue;
    adminSaturateEl.value = t.saturate;
    adminBrightnessEl.value = t.brightness;
    adminShadowEl.value = t.shadow;
    adminShadowValueEl.textContent = t.shadow.toFixed(2);
  }

  function findItemAnywhere(itemId) {
    for (const slotId of Object.keys(state.items)) {
      const found = (state.items[slotId] || []).find((i) => i.id === itemId);
      if (found) return found;
    }
    return null;
  }

  // Dragging/scaling always act on the *selected* layer (picked from the
  // list above), never "whichever layer is under the cursor" — every layer
  // spans the full stage box, so z-order would otherwise make anything but
  // the topmost item unreachable.
  stageEl.addEventListener("mousedown", (e) => {
    if (!state.adminMode || !state.selectedItemId) return;
    e.preventDefault();

    const itemId = state.selectedItemId;
    const key = transformKeyOf(itemId);
    const stageRect = stageEl.getBoundingClientRect();
    const start = getTransform(key, state.view);
    const startX = e.clientX;
    const startY = e.clientY;

    function onMove(ev) {
      const dxPct = ((ev.clientX - startX) / stageRect.width) * 100 / state.zoom;
      const dyPct = ((ev.clientY - startY) / stageRect.height) * 100 / state.zoom;
      setTransform(key, state.view, { x: start.x + dxPct, y: start.y + dyPct });
      updateLayerStyle(itemId);
      refreshAdminPanel();
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  stageEl.addEventListener(
    "wheel",
    (e) => {
      if (!state.adminMode) {
        e.preventDefault();
        setZoom(state.zoom - Math.sign(e.deltaY) * ZOOM_STEP);
        return;
      }
      if (!state.selectedItemId) return;
      e.preventDefault();

      const itemId = state.selectedItemId;
      const key = transformKeyOf(itemId);
      const current = getTransform(key, state.view);
      const next = clamp(current.scale - Math.sign(e.deltaY) * 0.02, 0.05, 10);
      setTransform(key, state.view, { scale: next });
      updateLayerStyle(itemId);
      refreshAdminPanel();
    },
    { passive: false }
  );

  function applyNumericEdit(field, value) {
    if (!state.selectedItemId) return;
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    setTransform(transformKeyOf(state.selectedItemId), state.view, { [field]: num });
    renderStage();
  }

  adminXEl.addEventListener("input", () => applyNumericEdit("x", adminXEl.value));
  adminYEl.addEventListener("input", () => applyNumericEdit("y", adminYEl.value));
  adminScaleEl.addEventListener("input", () => applyNumericEdit("scale", adminScaleEl.value));
  adminHueEl.addEventListener("input", () => applyNumericEdit("hue", adminHueEl.value));
  adminSaturateEl.addEventListener("input", () => applyNumericEdit("saturate", adminSaturateEl.value));
  adminBrightnessEl.addEventListener("input", () => applyNumericEdit("brightness", adminBrightnessEl.value));
  adminShadowEl.addEventListener("input", () => {
    applyNumericEdit("shadow", adminShadowEl.value);
    adminShadowValueEl.textContent = parseFloat(adminShadowEl.value).toFixed(2);
  });

  adminResetItemBtn.addEventListener("click", () => {
    if (!state.selectedItemId) return;
    resetTransform(transformKeyOf(state.selectedItemId));
    renderStage();
    refreshAdminPanel();
  });

  adminSaveBtn.addEventListener("click", () => {
    adminSaveStatusEl.textContent = "Saving…";
    fetch("/api/save-transforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.transforms),
    })
      .then((res) => {
        if (!res.ok) throw new Error("save failed");
        adminSaveStatusEl.textContent = "Saved to data/itemTransforms.js — commit & push to ship it.";
      })
      .catch(() => {
        adminSaveStatusEl.textContent =
          "Couldn't reach the save server. Double-click start.bat (or run \"node server.js\") " +
          "in the project folder, then reload this page from http://localhost:5544 and try again.";
      });
  });

  document.getElementById("admin-toggle-btn").addEventListener("click", () => setAdminMode(!state.adminMode));
  document.getElementById("reset-btn").addEventListener("click", resetLoadout);
  document.getElementById("view-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".view-btn");
    if (btn) setView(btn.dataset.view);
  });

  renderGroupNav();
  renderSlots();
  setView(state.view);
  applyViewTransform();
})();
