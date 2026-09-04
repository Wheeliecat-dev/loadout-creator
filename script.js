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
    // In-progress MOLLE placement: { slotId, itemId, row, slide } | null.
    // Nothing is added to `selection` until confirmed.
    placing: null,
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

  // Multi-select entries are plain item-id strings, except MOLLE-attached
  // slots (see `attachTo`), where each entry is { itemId, row, slide }.
  function entryItemId(entry) {
    return typeof entry === "string" ? entry : entry.itemId;
  }

  function isSelected(slotId, itemId) {
    const type = SLOT_TYPE_BY_ID[slotId];
    if (type === "multi") {
      return (state.selection[slotId] || []).some((e) => entryItemId(e) === itemId);
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
    state.placing = null;
    persistSelection();
    renderStage();
    renderSlots();
    refreshAdminPanel();
  }

  // ---------- Transform helpers (admin calibration) ----------

  const DEFAULT_TRANSFORM = { x: 0, y: 0, scale: 1, hue: 0, saturate: 1, brightness: 1, shadow: 0.35, spread: 5 };

  // `shadow` is the drop-shadow's opacity (0 = none), `spread` is its blur
  // radius in px (drop-shadow has no separate spread-radius like
  // box-shadow does, so blur is the closest "how far it diffuses" knob) —
  // both admin-tunable per item. Offset stays fixed. Filter order matters:
  // drop-shadow first so it isn't itself hue/brightness-shifted by the
  // grading that follows it.
  function shadowFilter(intensity, spread) {
    return `drop-shadow(0 3px ${spread}px rgba(0,0,0,${intensity}))`;
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
    const filter = `${shadowFilter(t.shadow, t.spread)} hue-rotate(${t.hue}deg) saturate(${t.saturate}) brightness(${t.brightness})`;
    return `transform: translate(${t.x}%, ${t.y}%) scale(${t.scale}); filter: ${filter};`;
  }

  // ---------- MOLLE attachment (row-snap, slide, parented to the host) ----------

  function getAttachParent(slot) {
    if (!slot || !slot.attachTo) return null;
    const parentId = state.selection[slot.attachTo];
    if (!parentId) return null;
    return findItem(slot.attachTo, parentId);
  }

  function getMolleRows(parentItem, view) {
    return (parentItem && parentItem.molleRows && parentItem.molleRows[view]) || [];
  }

  // A MOLLE item's own x/y are never used — its position comes from the
  // row it's snapped to plus its slide, resolved against the *parent's*
  // current position/scale. Its own `scale` is treated as relative to the
  // parent's scale (not the stage), so it resizes correctly if the parent
  // is ever recalibrated — true parenting, not just a one-time copy.
  // A pouch snapped dead-center on its row every time reads as too
  // perfect/CG. This is a small fixed-at-placement jitter (rolled once in
  // startPlacement, not re-rolled on every render) rather than true
  // randomness, so it looks hand-placed instead of glitching around.
  const ROW_JITTER_RANGE = 0.8; // vest image-local %, roughly "a couple pixels"

  function rollRowJitter() {
    return (Math.random() - 0.5) * ROW_JITTER_RANGE;
  }

  function molleLayerStyle(item, view, parentItem, rowId, slide, jitter) {
    const rows = getMolleRows(parentItem, view);
    const row = rows.find((r) => r.id === rowId) || rows[0];
    if (!row) return "display: none;"; // no row geometry for this view

    const parentT = getTransform(parentItem.transformKey || parentItem.id, view);
    const t = getTransform(item.transformKey || item.id, view);
    const slideClamped = clamp(slide || 0, -row.halfWidth, row.halfWidth);
    const px = row.px + slideClamped;
    const py = row.py + (jitter || 0);
    const x = parentT.x + (px - 50) * parentT.scale;
    const y = parentT.y + (py - 50) * parentT.scale;
    // Scale is absolute — same units as every other item's, set once via
    // Admin Mode and rendered exactly as typed. Only x/y are parented to
    // the vest's current position; if the vest is later rescaled a lot,
    // pouch sizes may need re-tuning too, same as they would have without
    // MOLLE attachment at all.
    const filter = `${shadowFilter(t.shadow, t.spread)} hue-rotate(${t.hue}deg) saturate(${t.saturate}) brightness(${t.brightness})`;
    return `transform: translate(${x}%, ${y}%) scale(${t.scale}); filter: ${filter};`;
  }

  // A row's usable slide range is only approximate ground truth — pouches
  // vary in width and we don't track their exact footprint — so "valid"
  // just means "not suspiciously close to another pouch already on this
  // row," using a fraction of the row's own width as the minimum gap.
  const MIN_SLIDE_GAP_FRACTION = 0.3;

  function isPlacementValid() {
    if (!state.placing || !state.placing.row) return false;
    const { slotId, row, slide } = state.placing;
    const parentItem = getAttachParent(SLOT_DEF_BY_ID[slotId]);
    const rowDef = getMolleRows(parentItem, state.view).find((r) => r.id === row);
    if (!rowDef) return false;
    const minGap = rowDef.halfWidth * MIN_SLIDE_GAP_FRACTION;
    const others = state.selection[slotId] || [];
    return !others.some((e) => e.row === row && Math.abs(e.slide - slide) < minGap);
  }

  function startPlacement(slotId, itemId) {
    const slot = SLOT_DEF_BY_ID[slotId];
    const parentItem = getAttachParent(slot);
    const rows = getMolleRows(parentItem, state.view);
    // Rolled once up front so the preview already shows the final look —
    // no jump between preview and confirmed result.
    state.placing = { slotId, itemId, row: rows.length ? rows[0].id : null, slide: 0, jitter: rollRowJitter() };
    renderSlots();
    renderStage();
  }

  function setPlacingRow(rowId) {
    if (!state.placing) return;
    state.placing = { ...state.placing, row: rowId, slide: 0 };
    renderSlots();
    renderStage();
  }

  // Multiple instances of the same pouch are allowed (see below), so
  // confirming always adds a new entry rather than toggling one — each
  // gets its own instanceId since `itemId` alone no longer identifies a
  // unique placement.
  function confirmPlacement() {
    if (!state.placing || !isPlacementValid()) return;
    const { slotId, itemId, row, slide, jitter } = state.placing;
    const instanceId = `${itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    state.selection[slotId] = [...(state.selection[slotId] || []), { instanceId, itemId, row, slide, jitter }];
    state.placing = null;
    persistSelection();
    renderSlots();
    renderStage();
    refreshAdminPanel();
  }

  function cancelPlacement() {
    state.placing = null;
    renderSlots();
    renderStage();
  }

  function removeMolleInstance(slotId, instanceId) {
    state.selection[slotId] = (state.selection[slotId] || []).filter((e) => e.instanceId !== instanceId);
    persistSelection();
    renderSlots();
    renderStage();
    refreshAdminPanel();
  }

  // Molle items are handled entirely separately from the plain toggle
  // flow: clicking a tile always starts placing *another* instance —
  // removal happens only via the equipped-instances list (see
  // renderSlots), since with duplicates allowed, "click to remove" on the
  // shared tile would be ambiguous about which instance to drop.
  function handleTileActivate(slot, itemId) {
    if (slot.attachTo) {
      startPlacement(slot.id, itemId);
      return;
    }
    toggleSelect(slot.id, itemId);
  }

  // Color/pattern variants share one item's calibration via `transformKey`
  // instead of each carrying their own — see the note in data/items.js.
  function transformKeyOf(itemId) {
    const item = findItemAnywhere(itemId);
    return (item && item.transformKey) || itemId;
  }

  // Only for non-MOLLE items: a MOLLE pouch can have several instances at
  // once (different rows/slides), so a single shared style string can't be
  // patched onto all of them — those go through a full renderStage()
  // instead, which recomputes each instance from its own placement.
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
      ids.forEach((entry) => {
        const itemId = entryItemId(entry);
        const item = slotId === "base" ? baseItem : findItem(slotId, itemId);
        if (!item) return;

        const slotDef = SLOT_DEF_BY_ID[slotId];
        const molle =
          slotDef && slotDef.attachTo && typeof entry === "object"
            ? { row: entry.row, slide: entry.slide, jitter: entry.jitter, parentItem: getAttachParent(slotDef) }
            : null;
        layers.push({ item, slotId, molle });
        // Companions ride along with their parent — always equipped when
        // it is, never separately pickable — e.g. a jacket's hood, drawn
        // over the helmet via its own zSlot while the jacket itself stays
        // under the belt/vest at its normal position.
        (item.companions || []).forEach((companion) => layers.push({ item: companion, slotId }));
      });
    });
    // Most items stack at their own slot's RENDER_ORDER position, but a few
    // need an exception (e.g. a hooded jacket drawn over the helmet instead
    // of under it, like everything else in "top"). `item.zSlot` renders the
    // item as if it belonged to that other slot instead — stable-sorted so
    // items without an override keep their natural relative order.
    return layers
      .map((layer, i) => ({ layer, i, order: RENDER_ORDER.indexOf(layer.item.zSlot || layer.slotId) }))
      .sort((a, b) => a.order - b.order || a.i - b.i)
      .map(({ layer }) => layer);
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

      if (slot.attachTo) {
        slotEl.appendChild(buildEquippedInstancesList(slot));
        if (state.placing && state.placing.slotId === slot.id) {
          slotEl.appendChild(buildPlacementPanel(slot));
        }
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
        // Picker thumbnail: explicit `thumb` override wins (e.g. a backpack
        // whose front is just straps — the back view reads better as a
        // thumbnail); otherwise front art, falling back to rear-only items.
        tile.querySelector("img").src = item.thumb || item.src || item.srcBack;
        tile.querySelector("img").alt = item.name;
        tile.querySelector(".item-name").textContent = item.name;
        if (isSelected(slot.id, item.id)) tile.classList.add("selected");
        if (state.placing && state.placing.slotId === slot.id && state.placing.itemId === item.id) {
          tile.classList.add("placing");
        }

        tile.addEventListener("click", () => handleTileActivate(slot, item.id));
        tile.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleTileActivate(slot, item.id);
          }
        });

        grid.appendChild(tile);
      });

      slotEl.appendChild(grid);
      slotsContainerEl.appendChild(slotEl);
    });
  }

  // List of every currently-placed instance in a MOLLE slot, each with its
  // own remove button — needed because clicking the shared item tile can
  // no longer mean "remove" once duplicates are allowed (see
  // handleTileActivate).
  function buildEquippedInstancesList(slot) {
    const wrap = document.createElement("div");
    wrap.className = "molle-instance-list";
    const entries = state.selection[slot.id] || [];
    if (entries.length === 0) return wrap;

    const rows = getMolleRows(getAttachParent(slot), state.view);
    entries.forEach((entry) => {
      const item = findItem(slot.id, entry.itemId);
      if (!item) return;
      const rowIndex = rows.findIndex((r) => r.id === entry.row);
      const row = document.createElement("div");
      row.className = "molle-instance-row";
      const label = document.createElement("span");
      label.textContent = `${item.name} — Row ${rowIndex >= 0 ? rowIndex + 1 : "?"}`;
      const removeBtn = document.createElement("button");
      removeBtn.className = "molle-instance-remove";
      removeBtn.textContent = "×";
      removeBtn.title = "Remove";
      removeBtn.addEventListener("click", () => removeMolleInstance(slot.id, entry.instanceId));
      row.appendChild(label);
      row.appendChild(removeBtn);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function buildPlacementPanel(slot) {
    const panel = document.createElement("div");
    panel.className = "molle-placement";

    const parentItem = getAttachParent(slot);
    const item = findItem(slot.id, state.placing.itemId);
    const rows = getMolleRows(parentItem, state.view);

    const title = document.createElement("p");
    title.className = "molle-placement-title";
    title.textContent = `Placing: ${item ? item.name : ""}`;
    panel.appendChild(title);

    if (!rows.length) {
      const none = document.createElement("p");
      none.className = "slot-empty";
      none.textContent = `No MOLLE rows defined for ${parentItem ? parentItem.name : "this"} in ${state.view} view.`;
      panel.appendChild(none);
      const cancelOnly = document.createElement("button");
      cancelOnly.className = "btn btn-secondary";
      cancelOnly.textContent = "Cancel";
      cancelOnly.addEventListener("click", cancelPlacement);
      panel.appendChild(cancelOnly);
      return panel;
    }

    const rowButtons = document.createElement("div");
    rowButtons.className = "molle-row-buttons";
    rows.forEach((row, i) => {
      const btn = document.createElement("button");
      btn.className = "molle-row-btn";
      btn.textContent = `Row ${i + 1}`;
      if (state.placing.row === row.id) btn.classList.add("active");
      btn.addEventListener("click", () => setPlacingRow(row.id));
      rowButtons.appendChild(btn);
    });
    panel.appendChild(rowButtons);

    const currentRow = rows.find((r) => r.id === state.placing.row) || rows[0];
    const slideRow = document.createElement("div");
    slideRow.className = "molle-slide-row";
    const slideLabel = document.createElement("label");
    slideLabel.textContent = "Position";
    const slideInput = document.createElement("input");
    slideInput.type = "range";
    slideInput.min = String(-currentRow.halfWidth);
    slideInput.max = String(currentRow.halfWidth);
    slideInput.step = "0.5";
    slideInput.value = String(state.placing.slide);
    slideRow.appendChild(slideLabel);
    slideRow.appendChild(slideInput);
    panel.appendChild(slideRow);

    const validityMsg = document.createElement("p");
    validityMsg.className = "molle-validity";
    panel.appendChild(validityMsg);

    const actions = document.createElement("div");
    actions.className = "molle-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", cancelPlacement);
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn";
    confirmBtn.textContent = "Confirm";
    confirmBtn.addEventListener("click", confirmPlacement);
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    panel.appendChild(actions);

    function refreshValidity() {
      const valid = isPlacementValid();
      confirmBtn.disabled = !valid;
      validityMsg.textContent = valid ? "Position OK." : "Too close to another pouch on this row.";
      validityMsg.classList.toggle("molle-validity-bad", !valid);
    }

    slideInput.addEventListener("input", () => {
      state.placing.slide = parseFloat(slideInput.value);
      renderStage();
      refreshValidity();
    });

    refreshValidity();
    return panel;
  }

  // Darker than the item's normal grading, on top of it — simulates being
  // glimpsed past the body's silhouette rather than lit head-on.
  const PEEK_DARKEN = 0.55;

  function peekLayerStyle(key) {
    const t = getTransform(key, "rear"); // only a rear calibration exists for these
    const filter = `${shadowFilter(t.shadow, t.spread)} hue-rotate(${t.hue}deg) saturate(${t.saturate}) brightness(${t.brightness * PEEK_DARKEN})`;
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
          img.src = item.srcBack;
          img.alt = item.name;
          img.dataset.itemId = item.id;
          img.dataset.slot = slotId;
          img.style.cssText = peekLayerStyle(item.transformKey || item.id);
          stageContentEl.appendChild(img);
        });
    }

    layers.forEach(({ item, slotId, molle }) => {
      const src = state.view === "rear" ? item.srcBack : item.src;
      if (!src) return; // no art for this view — skip rather than show the wrong side

      const img = document.createElement("img");
      img.className = "layer";
      img.src = src;
      img.alt = item.name;
      img.dataset.itemId = item.id;
      img.dataset.slot = slotId;
      img.style.cssText =
        molle && molle.parentItem
          ? molleLayerStyle(item, state.view, molle.parentItem, molle.row, molle.slide, molle.jitter)
          : layerStyle(item.transformKey || item.id, state.view);
      if (item.id === state.selectedItemId) img.classList.add("layer-selected");
      stageContentEl.appendChild(img);
    });

    // Live preview of an unconfirmed MOLLE placement, dimmed so it reads as
    // "not committed yet."
    if (state.placing) {
      const slot = SLOT_DEF_BY_ID[state.placing.slotId];
      const parentItem = getAttachParent(slot);
      const item = findItem(state.placing.slotId, state.placing.itemId);
      const src = item && (state.view === "rear" ? item.srcBack : item.src);
      if (item && parentItem && src) {
        const img = document.createElement("img");
        img.className = "layer layer-preview";
        img.src = src;
        img.alt = item.name;
        img.style.cssText = molleLayerStyle(
          item,
          state.view,
          parentItem,
          state.placing.row,
          state.placing.slide,
          state.placing.jitter
        );
        stageContentEl.appendChild(img);
      }
    }

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
  const adminSpreadEl = document.getElementById("admin-spread");
  const adminSpreadValueEl = document.getElementById("admin-spread-value");
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

    // Layer picker: every currently equipped item for this view. A MOLLE
    // pouch can have several instances (different rows) sharing one item
    // id — its scale/grading is shared too, so list it once regardless of
    // how many are placed.
    adminLayerListEl.innerHTML = "";
    const seenItemIds = new Set();
    equippedLayers().forEach(({ item }) => {
      if (seenItemIds.has(item.id)) return;
      seenItemIds.add(item.id);
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
      adminSpreadEl,
      adminResetItemBtn,
    ];
    if (!item) {
      adminItemNameEl.textContent = "—";
      fields.forEach((el) => (el.disabled = true));
      fields.forEach((el) => el !== adminResetItemBtn && (el.value = ""));
      adminShadowValueEl.textContent = "";
      adminSpreadValueEl.textContent = "";
      return;
    }
    const t = getTransform(item.transformKey || item.id, state.view);
    const molleActive = isMolleSelected();
    adminItemNameEl.textContent = `${item.name} (${state.view})${molleActive ? " — position via row/slide picker" : ""}`;
    fields.forEach((el) => (el.disabled = false));
    adminXEl.disabled = molleActive;
    adminYEl.disabled = molleActive;
    adminXEl.value = t.x;
    adminYEl.value = t.y;
    adminScaleEl.value = t.scale;
    adminHueEl.value = t.hue;
    adminSaturateEl.value = t.saturate;
    adminBrightnessEl.value = t.brightness;
    adminShadowEl.value = t.shadow;
    adminShadowValueEl.textContent = t.shadow.toFixed(2);
    adminSpreadEl.value = t.spread;
    adminSpreadValueEl.textContent = `${t.spread}px`;
  }

  function findItemAnywhere(itemId) {
    for (const slotId of Object.keys(state.items)) {
      for (const item of state.items[slotId] || []) {
        if (item.id === itemId) return item;
        const companion = (item.companions || []).find((c) => c.id === itemId);
        if (companion) return companion;
      }
    }
    return null;
  }

  // True if the selected item is currently equipped via MOLLE attachment
  // (any instance) — its position comes from the row/slide picker, not
  // drag, and its scale is relative to the parent, so a scale change needs
  // a full re-render rather than a single-element style patch.
  function isMolleSelected() {
    const layer = equippedLayers().find((l) => l.item.id === state.selectedItemId);
    return !!(layer && layer.molle);
  }

  // Dragging/scaling always act on the *selected* layer (picked from the
  // list above), never "whichever layer is under the cursor" — every layer
  // spans the full stage box, so z-order would otherwise make anything but
  // the topmost item unreachable.
  stageEl.addEventListener("mousedown", (e) => {
    if (!state.adminMode || !state.selectedItemId || isMolleSelected()) return;
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
      if (isMolleSelected()) {
        renderStage(); // scale is shared across every instance of this pouch
      } else {
        updateLayerStyle(itemId);
      }
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
  adminSpreadEl.addEventListener("input", () => {
    applyNumericEdit("spread", adminSpreadEl.value);
    adminSpreadValueEl.textContent = `${adminSpreadEl.value}px`;
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

  // ---------- Named presets (local to this browser) ----------

  const STORAGE_PRESETS = "loadoutCreator.presets";
  const presetListEl = document.getElementById("preset-list");

  function loadPresets() {
    return safeParse(localStorage.getItem(STORAGE_PRESETS)) || {};
  }

  function persistPresets(presets) {
    localStorage.setItem(STORAGE_PRESETS, JSON.stringify(presets));
  }

  // Replaces the whole loadout with `newSelection`, re-validating it against
  // the slots that actually exist — used by both presets and shared codes,
  // since either could be stale (an old preset referencing a slot that's
  // since been removed, a code from a build with different items).
  function applySelection(newSelection) {
    const sanitized = {};
    RENDER_ORDER.forEach((slotId) => {
      if (slotId === "base") return;
      const raw = newSelection ? newSelection[slotId] : undefined;
      sanitized[slotId] = SLOT_TYPE_BY_ID[slotId] === "multi" ? (Array.isArray(raw) ? raw : []) : typeof raw === "string" ? raw : null;
    });
    state.selection = sanitized;
    state.placing = null;
    state.selectedItemId = null;
    persistSelection();
    renderSlots();
    renderStage();
    refreshAdminPanel();
  }

  function renderPresetList() {
    const presets = loadPresets();
    const names = Object.keys(presets);
    presetListEl.innerHTML = "";
    if (names.length === 0) {
      const empty = document.createElement("p");
      empty.className = "slot-empty";
      empty.textContent = "No saved presets yet.";
      presetListEl.appendChild(empty);
      return;
    }
    names.forEach((name) => {
      const row = document.createElement("div");
      row.className = "preset-row";
      const loadBtn = document.createElement("button");
      loadBtn.className = "preset-load-btn";
      loadBtn.textContent = name;
      loadBtn.title = `Load "${name}"`;
      loadBtn.addEventListener("click", () => applySelection(presets[name]));
      const delBtn = document.createElement("button");
      delBtn.className = "preset-delete-btn";
      delBtn.textContent = "×";
      delBtn.title = "Delete preset";
      delBtn.addEventListener("click", () => {
        const all = loadPresets();
        delete all[name];
        persistPresets(all);
        renderPresetList();
      });
      row.appendChild(loadBtn);
      row.appendChild(delBtn);
      presetListEl.appendChild(row);
    });
  }

  document.getElementById("save-preset-btn").addEventListener("click", () => {
    const name = (prompt("Name this preset:") || "").trim();
    if (!name) return;
    const presets = loadPresets();
    presets[name] = state.selection;
    persistPresets(presets);
    renderPresetList();
  });

  // ---------- Shareable loadout codes ----------
  // The code is just the selection, base64url-encoded — nothing about
  // calibration (that's site-wide already) or which vest/view is active.

  function encodeSelection(selection) {
    const json = JSON.stringify(selection);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeSelectionCode(code) {
    try {
      let b64 = code.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (e) {
      return null;
    }
  }

  // Accepts either a bare code or a full share URL someone pasted.
  function extractCode(input) {
    const trimmed = input.trim();
    try {
      const url = new URL(trimmed);
      const fromUrl = url.searchParams.get("loadout");
      if (fromUrl) return fromUrl;
    } catch (e) {
      // not a URL — treat the whole thing as the code
    }
    return trimmed;
  }

  const shareStatusEl = document.getElementById("share-status");

  document.getElementById("share-btn").addEventListener("click", () => {
    const code = encodeSelection(state.selection);
    const url = `${location.origin}${location.pathname}?loadout=${code}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        shareStatusEl.textContent = "Link copied to clipboard.";
      })
      .catch(() => {
        shareStatusEl.textContent = url; // clipboard blocked — show it so it can be copied by hand
      });
  });

  document.getElementById("import-code-btn").addEventListener("click", () => {
    const input = document.getElementById("import-code-input");
    const code = extractCode(input.value);
    if (!code) return;
    const decoded = decodeSelectionCode(code);
    if (!decoded) {
      shareStatusEl.textContent = "That code doesn't look valid.";
      return;
    }
    applySelection(decoded);
    input.value = "";
    shareStatusEl.textContent = "Loadout loaded.";
  });

  // ---------- Export as image ----------
  // Reuses the exact same style-computation functions the stage itself
  // uses (layerStyle/molleLayerStyle/peekLayerStyle), just parsed back out
  // of their CSS text instead of applied to a DOM element, so the export
  // can never visually drift from what's actually on screen.

  const imageCache = new Map();

  function loadImageCached(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    imageCache.set(src, promise);
    return promise;
  }

  function parseLayerStyle(cssText) {
    const m = cssText.match(/translate\(([-\d.]+)%,\s*([-\d.]+)%\)\s*scale\(([-\d.]+)\)/);
    const filterMatch = cssText.match(/filter:\s*([^;]+);?/);
    return {
      x: m ? parseFloat(m[1]) : 0,
      y: m ? parseFloat(m[2]) : 0,
      scale: m ? parseFloat(m[3]) : 1,
      filter: filterMatch ? filterMatch[1] : "none",
    };
  }

  // Same math as the CSS: an object-fit:contain image, scaled/translated
  // about the box's own center — see molleLayerStyle's derivation.
  function computeDestRect(boxW, boxH, xPct, yPct, scale, naturalW, naturalH) {
    const boxAspect = boxW / boxH;
    const imgAspect = naturalW / naturalH;
    const containW = imgAspect > boxAspect ? boxW : boxH * imgAspect;
    const containH = imgAspect > boxAspect ? boxW / imgAspect : boxH;
    const rx = (boxW - containW) / 2;
    const ry = (boxH - containH) / 2;
    const cx = boxW / 2;
    const cy = boxH / 2;
    const tx = (xPct / 100) * boxW;
    const ty = (yPct / 100) * boxH;
    return {
      destW: containW * scale,
      destH: containH * scale,
      destX: cx + (rx - cx) * scale + tx,
      destY: cy + (ry - cy) * scale + ty,
    };
  }

  // Gathers the same layer list renderStage() would, for an arbitrary view
  // (not necessarily the one currently on screen) — done by borrowing
  // state.view briefly so the existing style functions (which read it
  // internally) compute for that view without needing their own
  // refactor.
  function layersForExport(view) {
    const previousView = state.view;
    state.view = view;
    const out = [];
    if (view === "front") {
      equippedLayers()
        .filter(({ item }) => item.peekBehindBody && item.srcBack)
        .forEach(({ item }) => {
          out.push({ src: item.srcBack, styleText: peekLayerStyle(item.transformKey || item.id) });
        });
    }
    equippedLayers().forEach(({ item, molle }) => {
      const src = view === "rear" ? item.srcBack : item.src;
      if (!src) return;
      const styleText =
        molle && molle.parentItem
          ? molleLayerStyle(item, view, molle.parentItem, molle.row, molle.slide, molle.jitter)
          : layerStyle(item.transformKey || item.id, view);
      out.push({ src, styleText });
    });
    state.view = previousView;
    return out;
  }

  async function drawViewInto(ctx, view, offsetX, offsetY, w, h) {
    const layers = layersForExport(view);
    for (const layer of layers) {
      let img;
      try {
        img = await loadImageCached(layer.src);
      } catch (e) {
        continue; // skip a layer whose image failed to load rather than aborting the whole export
      }
      const { x, y, scale, filter } = parseLayerStyle(layer.styleText);
      const rect = computeDestRect(w, h, x, y, scale, img.naturalWidth, img.naturalHeight);
      ctx.save();
      ctx.filter = filter;
      ctx.drawImage(img, offsetX + rect.destX, offsetY + rect.destY, rect.destW, rect.destH);
      ctx.restore();
    }
  }

  document.getElementById("export-image-btn").addEventListener("click", async () => {
    const btn = document.getElementById("export-image-btn");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Exporting…";
    try {
      const REGION_W = 600;
      const REGION_H = 532;
      const GAP = 24;
      const canvas = document.createElement("canvas");
      canvas.width = REGION_W * 2 + GAP;
      canvas.height = REGION_H;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#16181d";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await drawViewInto(ctx, "front", 0, 0, REGION_W, REGION_H);
      await drawViewInto(ctx, "rear", REGION_W + GAP, 0, REGION_W, REGION_H);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "loadout.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });

  renderGroupNav();
  renderSlots();
  setView(state.view);
  applyViewTransform();
  renderPresetList();

  // A shared link takes priority over whatever's in localStorage — opening
  // one should show exactly that build.
  (function loadFromUrlIfPresent() {
    const code = new URLSearchParams(location.search).get("loadout");
    if (!code) return;
    const decoded = decodeSelectionCode(code);
    if (decoded) applySelection(decoded);
  })();
})();
