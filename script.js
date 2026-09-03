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

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 0.1;

  const SLOT_TYPE_BY_ID = {};
  GROUPS.forEach((group) => {
    group.slots.forEach((slot) => {
      SLOT_TYPE_BY_ID[slot.id] = slot.type;
    });
  });

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

  function toggleSelect(slotId, itemId) {
    const type = SLOT_TYPE_BY_ID[slotId];
    if (type === "multi") {
      const current = state.selection[slotId] || [];
      state.selection[slotId] = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
    } else {
      state.selection[slotId] = state.selection[slotId] === itemId ? null : itemId;
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

  function getTransform(itemId, view) {
    const t = state.transforms[itemId] && state.transforms[itemId][view];
    return t ? { x: t.x || 0, y: t.y || 0, scale: t.scale || 1 } : { x: 0, y: 0, scale: 1 };
  }

  function setTransform(itemId, view, patch) {
    if (!state.transforms[itemId]) state.transforms[itemId] = {};
    state.transforms[itemId][view] = { ...getTransform(itemId, view), ...patch };
  }

  function resetTransform(itemId) {
    if (state.transforms[itemId]) delete state.transforms[itemId][state.view];
  }

  function layerStyle(itemId, view) {
    const t = getTransform(itemId, view);
    return `transform: translate(${t.x}%, ${t.y}%) scale(${t.scale});`;
  }

  function updateLayerStyle(itemId) {
    const el = stageContentEl.querySelector(`.layer[data-item-id="${itemId}"]`);
    if (el) el.style.cssText = layerStyle(itemId, state.view);
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
        tile.querySelector("img").src = item.src;
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

  function renderStage() {
    stageContentEl.innerHTML = "";
    stageEl.classList.toggle("admin", state.adminMode);
    stageEl.classList.toggle("has-selection", state.adminMode && !!state.selectedItemId);

    const layers = equippedLayers();

    layers.forEach(({ item, slotId }) => {
      const src = state.view === "rear" ? item.srcBack : item.src;
      if (!src) return; // no art for this view — skip rather than show the wrong side

      const img = document.createElement("img");
      img.className = "layer";
      img.src = src;
      img.alt = item.name;
      img.dataset.itemId = item.id;
      img.dataset.slot = slotId;
      img.style.cssText = layerStyle(item.id, state.view);
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

  // ---------- Zoom (locked across every layer) ----------

  function applyZoom() {
    stageContentEl.style.transform = `scale(${state.zoom})`;
    document.getElementById("zoom-level").textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function setZoom(zoom) {
    state.zoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
    persistZoom();
    applyZoom();
  }

  document.getElementById("zoom-in").addEventListener("click", () => setZoom(state.zoom + ZOOM_STEP));
  document.getElementById("zoom-out").addEventListener("click", () => setZoom(state.zoom - ZOOM_STEP));

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
    const fields = [adminXEl, adminYEl, adminScaleEl, adminResetItemBtn];
    if (!item) {
      adminItemNameEl.textContent = "—";
      fields.forEach((el) => (el.disabled = true));
      adminXEl.value = "";
      adminYEl.value = "";
      adminScaleEl.value = "";
      return;
    }
    const t = getTransform(item.id, state.view);
    adminItemNameEl.textContent = `${item.name} (${state.view})`;
    fields.forEach((el) => (el.disabled = false));
    adminXEl.value = t.x;
    adminYEl.value = t.y;
    adminScaleEl.value = t.scale;
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
    const stageRect = stageEl.getBoundingClientRect();
    const start = getTransform(itemId, state.view);
    const startX = e.clientX;
    const startY = e.clientY;

    function onMove(ev) {
      const dxPct = ((ev.clientX - startX) / stageRect.width) * 100 / state.zoom;
      const dyPct = ((ev.clientY - startY) / stageRect.height) * 100 / state.zoom;
      setTransform(itemId, state.view, { x: start.x + dxPct, y: start.y + dyPct });
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
      const current = getTransform(itemId, state.view);
      const next = clamp(current.scale - Math.sign(e.deltaY) * 0.02, 0.05, 10);
      setTransform(itemId, state.view, { scale: next });
      updateLayerStyle(itemId);
      refreshAdminPanel();
    },
    { passive: false }
  );

  function applyNumericEdit(field, value) {
    if (!state.selectedItemId) return;
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    setTransform(state.selectedItemId, state.view, { [field]: num });
    renderStage();
  }

  adminXEl.addEventListener("input", () => applyNumericEdit("x", adminXEl.value));
  adminYEl.addEventListener("input", () => applyNumericEdit("y", adminYEl.value));
  adminScaleEl.addEventListener("input", () => applyNumericEdit("scale", adminScaleEl.value));

  adminResetItemBtn.addEventListener("click", () => {
    if (!state.selectedItemId) return;
    resetTransform(state.selectedItemId);
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
  applyZoom();
})();
