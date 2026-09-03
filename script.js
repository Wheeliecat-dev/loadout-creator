// Loadout Creator — app logic
// Framework only: no gear is bundled. Items are added at runtime via the
// uploader (persisted in this browser's localStorage) and/or via
// DEFAULT_ITEMS in data/items.js.

(function () {
  "use strict";

  const STORAGE_ITEMS = "loadoutCreator.items";
  const STORAGE_SELECTION = "loadoutCreator.selection";
  const STORAGE_ACTIVE_GROUP = "loadoutCreator.activeGroup";
  const STORAGE_VIEW = "loadoutCreator.view";

  const SLOT_TYPE_BY_ID = {};
  GROUPS.forEach((group) => {
    group.slots.forEach((slot) => {
      SLOT_TYPE_BY_ID[slot.id] = slot.type;
    });
  });

  function loadItems() {
    const stored = safeParse(localStorage.getItem(STORAGE_ITEMS)) || {};
    const merged = {};
    RENDER_ORDER.forEach((slotId) => {
      const defaults = (DEFAULT_ITEMS && DEFAULT_ITEMS[slotId]) || [];
      const custom = stored[slotId] || [];
      merged[slotId] = [...defaults, ...custom];
    });
    return merged;
  }

  function loadSelection() {
    const stored = safeParse(localStorage.getItem(STORAGE_SELECTION)) || {};
    const selection = {};
    RENDER_ORDER.forEach((slotId) => {
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

  const state = {
    items: loadItems(),
    selection: loadSelection(),
    activeGroup: localStorage.getItem(STORAGE_ACTIVE_GROUP) || GROUPS[0].id,
    view: localStorage.getItem(STORAGE_VIEW) === "rear" ? "rear" : "front",
  };

  function persistItems() {
    // Only the user-added items are persisted (defaults live in data/items.js).
    const toSave = {};
    RENDER_ORDER.forEach((slotId) => {
      const defaults = (DEFAULT_ITEMS && DEFAULT_ITEMS[slotId]) || [];
      const defaultIds = new Set(defaults.map((i) => i.id));
      toSave[slotId] = (state.items[slotId] || []).filter((i) => !defaultIds.has(i.id));
    });
    localStorage.setItem(STORAGE_ITEMS, JSON.stringify(toSave));
  }

  function persistSelection() {
    localStorage.setItem(STORAGE_SELECTION, JSON.stringify(state.selection));
  }

  function persistActiveGroup() {
    localStorage.setItem(STORAGE_ACTIVE_GROUP, state.activeGroup);
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
  }

  function addItem(slotId, name, src) {
    const id = `${slotId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item = { id, name, src };
    state.items[slotId] = [...(state.items[slotId] || []), item];
    persistItems();
    renderSlots();
    return item;
  }

  function removeItem(slotId, itemId) {
    state.items[slotId] = (state.items[slotId] || []).filter((i) => i.id !== itemId);
    persistItems();

    const type = SLOT_TYPE_BY_ID[slotId];
    if (type === "multi") {
      state.selection[slotId] = (state.selection[slotId] || []).filter((id) => id !== itemId);
    } else if (state.selection[slotId] === itemId) {
      state.selection[slotId] = null;
    }
    persistSelection();

    renderSlots();
    renderStage();
  }

  function resetLoadout() {
    if (!confirm("Clear the whole loadout? This only clears your selections, not your uploaded items.")) return;
    RENDER_ORDER.forEach((slotId) => {
      state.selection[slotId] = SLOT_TYPE_BY_ID[slotId] === "multi" ? [] : null;
    });
    persistSelection();
    renderStage();
    renderSlots();
  }

  // ---------- Rendering ----------

  const groupNavEl = document.getElementById("group-nav");
  const slotsContainerEl = document.getElementById("slots-container");
  const stageEl = document.getElementById("stage");
  const itemTileTemplate = document.getElementById("item-tile-template");
  const addTileTemplate = document.getElementById("add-tile-template");

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

      (state.items[slot.id] || []).forEach((item) => {
        const tile = itemTileTemplate.content.firstElementChild.cloneNode(true);
        tile.querySelector("img").src = item.src;
        tile.querySelector("img").alt = item.name;
        tile.querySelector(".item-name").textContent = item.name;
        if (isSelected(slot.id, item.id)) tile.classList.add("selected");

        tile.addEventListener("click", (e) => {
          if (e.target.closest(".item-remove")) return;
          toggleSelect(slot.id, item.id);
        });
        tile.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSelect(slot.id, item.id);
          }
        });
        tile.querySelector(".item-remove").addEventListener("click", () => {
          removeItem(slot.id, item.id);
        });

        grid.appendChild(tile);
      });

      slotEl.appendChild(grid);

      const addRow = addTileTemplate.content.firstElementChild.cloneNode(true);
      const fileInput = addRow.querySelector("input[type=file]");
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const name = prompt("Name this item:", file.name.replace(/\.[^.]+$/, "")) || file.name;
        const reader = new FileReader();
        reader.onload = () => addItem(slot.id, name, reader.result);
        reader.readAsDataURL(file);
        fileInput.value = "";
      });
      slotEl.appendChild(addRow);

      slotsContainerEl.appendChild(slotEl);
    });
  }

  function renderStage() {
    stageEl.innerHTML = "";

    let hasBase = false;

    RENDER_ORDER.forEach((slotId) => {
      const type = SLOT_TYPE_BY_ID[slotId];
      const ids = type === "multi" ? state.selection[slotId] || [] : [state.selection[slotId]].filter(Boolean);
      ids.forEach((itemId) => {
        const item = findItem(slotId, itemId);
        if (!item) return;

        const src = state.view === "rear" ? item.srcBack : item.src;
        if (!src) return; // no art for this view — skip rather than show the wrong side

        if (slotId === "base") hasBase = true;
        const img = document.createElement("img");
        img.className = "layer";
        img.src = src;
        img.alt = item.name;
        img.dataset.slot = slotId;
        stageEl.appendChild(img);
      });
    });

    if (!hasBase) {
      const placeholder = document.createElement("div");
      placeholder.className = "base-placeholder";
      placeholder.innerHTML = "No base body yet.<br>Upload one under the <strong>Base</strong> menu.";
      stageEl.appendChild(placeholder);
    }
  }

  function setView(view) {
    state.view = view;
    localStorage.setItem(STORAGE_VIEW, view);
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    renderStage();
  }

  document.getElementById("reset-btn").addEventListener("click", resetLoadout);
  document.getElementById("view-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".view-btn");
    if (btn) setView(btn.dataset.view);
  });

  renderGroupNav();
  renderSlots();
  setView(state.view);
})();
