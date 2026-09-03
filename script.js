// Loadout Creator — app logic
// Items come from DEFAULT_ITEMS in data/items.js only — there is no
// in-app uploader for now. Only the player's current selection (which
// items are equipped) is persisted, in localStorage.

(function () {
  "use strict";

  const STORAGE_SELECTION = "loadoutCreator.selection";
  const STORAGE_ACTIVE_GROUP = "loadoutCreator.activeGroup";
  const STORAGE_VIEW = "loadoutCreator.view";

  const SLOT_TYPE_BY_ID = {};
  GROUPS.forEach((group) => {
    group.slots.forEach((slot) => {
      SLOT_TYPE_BY_ID[slot.id] = slot.type;
    });
  });

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
    items: DEFAULT_ITEMS || {},
    selection: loadSelection(),
    activeGroup: localStorage.getItem(STORAGE_ACTIVE_GROUP) || GROUPS[0].id,
    view: localStorage.getItem(STORAGE_VIEW) === "rear" ? "rear" : "front",
  };

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

  function resetLoadout() {
    if (!confirm("Clear the whole loadout?")) return;
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
