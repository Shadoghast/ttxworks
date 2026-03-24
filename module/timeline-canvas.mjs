/**
 * TimelineCanvas — the TTXWorks interactive timeline map window.
 *
 * Built as a standard Foundry Application (compatible with v12 and v13).
 * Rendering pipeline:
 *   render(true)  → opens/re-draws the HTML shell (toolbar, canvas el, SVG, help bar)
 *   refresh()     → re-draws SVG nodes + SVG connections without touching the DOM shell
 *                   (called on actor/connection data changes; debounced to 100 ms)
 *
 * Phase 3: full SVG rendering for nodes and connections.
 *   Nodes   → <g class="tl-node"> elements inside <g class="svg-world">
 *   Conns   → <g class="tl-connection-group"> + <path> inside <g class="svg-world">
 *   Background dot grid pans via CSS background-position on the wrap element.
 */

import { TimelineManager } from "./timeline-manager.mjs";

// ── SVG namespace constant ───────────────────────────────────────────────────
const NS = "http://www.w3.org/2000/svg";

// ── Node geometry constants ──────────────────────────────────────────────────
const EVENT_RADIUS   = 42;          // circle radius for event nodes
const ACTION_W       = 144;         // rounded-rect width for action nodes
const ACTION_H       = 64;          // rounded-rect height
const ACTION_RX      = 9;           // corner radius

// ── Canvas interaction modes ─────────────────────────────────────────────────
export const TLMode = Object.freeze({
  NORMAL:           "normal",
  CREATING_EVENT:   "creating-event",
  CREATING_ACTION:  "creating-action",
  CONNECTING:       "connecting",
  ADDING_WAYPOINT:  "adding-waypoint",
  ADDING_TEXT:      "adding-text"
});

// ── TimelineCanvas ────────────────────────────────────────────────────────────
export class TimelineCanvas extends Application {

  constructor(options = {}) {
    super(options);

    /** @type {{ panX: number, panY: number, zoom: number, mode: string, selectedId: string|null, expandedId: string|null, connectSourceId: string|null }} */
    this._state = {
      panX:            0,
      panY:            0,
      zoom:            1,
      mode:            TLMode.NORMAL,
      selectedId:      null,
      expandedId:      null,
      connectSourceId: null
    };

    /** PIXI Application instance — not used in Phase 3 (SVG-only rendering) */
    this._pixi = null;

    /** Debounce timer for refresh() */
    this._refreshTimer = null;

    /** Bound hook handlers (stored so we can remove them on close) */
    this._hookIds = [];

    /**
     * Auto-layout positions for actors whose canvasX/Y are null.
     * Keyed by actorId, values are {x, y}.
     * Cleared of entries whenever the actor gains a saved position.
     * @type {Map<string, {x:number, y:number}>}
     */
    this._autoPositions = new Map();

    /**
     * Live drag position override — prevents stale saved coords being used
     * while the user is mid-drag.
     * @type {Map<string, {x:number, y:number}>}
     */
    this._dragOverride = new Map();

    /**
     * Active drag state set by _attachNodeListeners.
     * @type {{ actorId:string, startScreenX:number, startScreenY:number, startWorldX:number, startWorldY:number, moved:boolean }|null}
     */
    this._dragState = null;
  }

  // ── Application options ───────────────────────────────────────────────────

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:          "ttxworks-timeline",
      title:       "TTXWorks — Timeline Map",
      template:    "systems/ttxworks/templates/timeline/timeline-app.hbs",
      classes:     ["ttxworks", "timeline-app"],
      width:       1100,
      height:      720,
      resizable:   true,
      scrollY:     []
    });
  }

  // ── getData (template context) ────────────────────────────────────────────

  getData() {
    return {
      mode:      this._state.mode,
      zoom:      Math.round(this._state.zoom * 100),
      nodeCount: this._getTimelineActors().length,
      connCount: TimelineManager.getConnections().length
    };
  }

  // ── Rendering lifecycle ───────────────────────────────────────────────────

  /** @override — called after the HTML is injected into the DOM */
  activateListeners(html) {
    super.activateListeners(html);

    // Toolbar controls
    html.find(".tl-zoom-in").on("click",    () => this._adjustZoom(0.1));
    html.find(".tl-zoom-out").on("click",   () => this._adjustZoom(-0.1));
    html.find(".tl-zoom-reset").on("click", () => this._resetZoom());
    html.find(".tl-fit").on("click",        () => this._fitToView());

    // Mode indicator (click to cancel back to normal)
    html.find(".tl-mode-indicator").on("click", () => this._setMode(TLMode.NORMAL));

    // Canvas-wrap: pan and pointer events
    const wrap = html.find(".timeline-canvas-wrap")[0];
    if (wrap) {
      wrap.addEventListener("pointerdown", this._onPointerDown.bind(this));
      wrap.addEventListener("pointermove", this._onPointerMove.bind(this));
      wrap.addEventListener("pointerup",   this._onPointerUp.bind(this));
      wrap.addEventListener("wheel",       this._onWheel.bind(this), { passive: false });
    }

    // Keyboard shortcuts — scoped to this window element
    const el = html[0].closest(".app") ?? html[0];
    el.setAttribute("tabindex", "0");
    el.addEventListener("keydown", this._onKeyDown.bind(this));
    el.focus();

    // No PIXI init needed — background handled by CSS dot grid
    this._initPIXI(html);

    // Initial draw
    this._scheduleRefresh();
  }

  /** @override */
  async close(options = {}) {
    this._teardownHooks();
    this._destroyPIXI();
    return super.close(options);
  }

  // ── PIXI (background only — SVG handles nodes and connections) ────────────

  /**
   * Phase 3: background is provided by the CSS radial-gradient dot grid on
   * .timeline-canvas-wrap, so no PIXI initialisation is required.
   * The canvas element remains in the DOM for potential future use (e.g.
   * particle effects, heat-maps) but has pointer-events:none and is inert.
   */
  _initPIXI(_html) {
    // Intentionally empty in Phase 3.
  }

  _destroyPIXI() {
    if (this._pixi) {
      this._pixi.destroy(true);
      this._pixi = null;
    }
  }

  // ── refresh (debounced redraw) ────────────────────────────────────────────

  /** Schedule a debounced refresh (100 ms window). */
  _scheduleRefresh() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = null;
      this.refresh();
    }, 100);
  }

  /** Re-draw SVG nodes and connections. */
  refresh() {
    if (!this.rendered) return;
    this._updateInfoBar();
    this._drawConnections();
    this._drawNodes();
  }

  _updateInfoBar() {
    const el = this.element?.find?.(".tl-info-bar");
    if (!el?.length) return;
    const actors = this._getTimelineActors();
    const conns  = TimelineManager.getConnections();
    el.text(`${actors.length} nodes · ${conns.length} connections · ${Math.round(this._state.zoom * 100)}%`);
  }

  // ── Node drawing ──────────────────────────────────────────────────────────

  /**
   * Render all visible timeline actors as SVG <g> nodes inside g.svg-world.
   * Fully recreates node elements on each call (simple and correct at exercise scale).
   */
  _drawNodes() {
    const svgWorld = this.element?.find?.("g.svg-world")[0];
    if (!svgWorld) return;

    // Remove existing nodes
    svgWorld.querySelectorAll(".tl-node").forEach(el => el.remove());

    const actors = this._getTimelineActors();

    // Clean up stale auto-positions for actors that now have saved coords
    for (const actor of actors) {
      if (actor.system.canvasX != null && this._autoPositions.has(actor.id)) {
        this._autoPositions.delete(actor.id);
      }
    }

    // Compute positions for still-unpositioned actors
    this._ensureAutoLayout(actors);

    for (const actor of actors) {
      if (actor.system.visible === false) continue;
      svgWorld.appendChild(this._createNodeElement(actor));
    }
  }

  /**
   * Build an SVG <g> element representing one timeline actor.
   * @param {Actor} actor
   * @returns {SVGGElement}
   */
  _createNodeElement(actor) {
    const pos       = this._getNodePosition(actor);
    const isAction  = actor.type === "action";
    const isSelected = actor.id === this._state.selectedId;

    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", `tl-node tl-${actor.type}${isSelected ? " selected" : ""}`);
    g.dataset.actorId = actor.id;
    g.setAttribute("transform", `translate(${pos.x},${pos.y})`);

    // ── Shape ────────────────────────────────────────────────────────────────
    if (isAction) {
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x",      -ACTION_W / 2);
      rect.setAttribute("y",      -ACTION_H / 2);
      rect.setAttribute("width",   ACTION_W);
      rect.setAttribute("height",  ACTION_H);
      rect.setAttribute("rx",      ACTION_RX);
      rect.setAttribute("class",  "node-shape");
      g.appendChild(rect);
    } else {
      const circle = document.createElementNS(NS, "circle");
      circle.setAttribute("r",     EVENT_RADIUS);
      circle.setAttribute("class", "node-shape");
      g.appendChild(circle);
    }

    // ── Text labels ──────────────────────────────────────────────────────────
    const nameY  = isAction ? -14 : -8;
    const dtY    = isAction ?   2 : 10;
    const extraY = isAction ?  18 : null;

    const nameEl = document.createElementNS(NS, "text");
    nameEl.setAttribute("class",            "node-name");
    nameEl.setAttribute("text-anchor",      "middle");
    nameEl.setAttribute("dominant-baseline","middle");
    nameEl.setAttribute("y", nameY);
    nameEl.textContent = this._truncate(actor.name, 18);
    g.appendChild(nameEl);

    const dtEl = document.createElementNS(NS, "text");
    dtEl.setAttribute("class",            "node-datetime");
    dtEl.setAttribute("text-anchor",      "middle");
    dtEl.setAttribute("dominant-baseline","middle");
    dtEl.setAttribute("y", dtY);
    dtEl.textContent = this._truncate(actor.system.dateTime ?? "", 16);
    g.appendChild(dtEl);

    // Actions get a TN% or outcome line
    if (isAction && extraY != null) {
      const resolved = actor.system.resolved;
      const outcome  = actor.system.outcome;
      const tn       = actor.system.targetNumber ?? 50;

      const extraEl = document.createElementNS(NS, "text");
      if (resolved && outcome) {
        extraEl.setAttribute("class", `node-tn outcome-${outcome}`);
        extraEl.textContent = outcome.replace(/-/g, " ");
      } else {
        extraEl.setAttribute("class", "node-tn");
        extraEl.textContent = `TN ${tn}%`;
      }
      extraEl.setAttribute("text-anchor",      "middle");
      extraEl.setAttribute("dominant-baseline","middle");
      extraEl.setAttribute("y", extraY);
      g.appendChild(extraEl);
    }

    // ── Interaction ──────────────────────────────────────────────────────────
    this._attachNodeListeners(g, actor);

    return g;
  }

  // ── Connection drawing ────────────────────────────────────────────────────

  /**
   * Render all connections as SVG paths inside g.svg-world, below nodes.
   * Fully recreates connection elements on each call.
   */
  _drawConnections() {
    const svgWorld = this.element?.find?.("g.svg-world")[0];
    if (!svgWorld) return;

    svgWorld.querySelectorAll(".tl-connection-group").forEach(el => el.remove());

    const connections = TimelineManager.getConnections();
    for (const conn of connections) {
      const source = game.actors.get(conn.sourceId);
      const target = game.actors.get(conn.targetId);
      if (!source || !target) continue;

      const grp = this._createConnectionElement(conn, source, target);

      // Insert before the first node so connections appear beneath nodes
      const firstNode = svgWorld.querySelector(".tl-node");
      if (firstNode) svgWorld.insertBefore(grp, firstNode);
      else           svgWorld.appendChild(grp);
    }
  }

  /**
   * Build an SVG <g> element for one connection (bezier path + optional label).
   * @param {object} conn      Connection record from TimelineManager
   * @param {Actor}  source
   * @param {Actor}  target
   * @returns {SVGGElement}
   */
  _createConnectionElement(conn, source, target) {
    const sp = this._getNodePosition(source);
    const tp = this._getNodePosition(target);

    // ── Bezier control points ────────────────────────────────────────────────
    // Horizontal-bias curve: control points pull horizontally from each node.
    const dx       = tp.x - sp.x;
    const dy       = tp.y - sp.y;
    const dist     = Math.sqrt(dx * dx + dy * dy) || 1;
    const cpOffset = Math.max(80, dist * 0.45);

    const c1x = sp.x + cpOffset;
    const c1y = sp.y;
    const c2x = tp.x - cpOffset;
    const c2y = tp.y;

    // Shorten endpoint so arrow rests on node edge, not inside it
    const endOffset = target.type === "event" ? EVENT_RADIUS + 2
                                              : Math.hypot(ACTION_W / 2, ACTION_H / 2) * 0.5 + 4;
    // Direction at curve end (approx: c2 → target center)
    const endDx   = tp.x - c2x;
    const endDy   = tp.y - c2y;
    const endDist = Math.sqrt(endDx * endDx + endDy * endDy) || 1;
    const ex = tp.x - (endDx / endDist) * endOffset;
    const ey = tp.y - (endDy / endDist) * endOffset;

    const isSelected = conn.id === this._state.selectedId;

    const grp = document.createElementNS(NS, "g");
    grp.setAttribute("class", "tl-connection-group");
    grp.dataset.connId = conn.id;

    // ── Path ─────────────────────────────────────────────────────────────────
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", `M ${sp.x},${sp.y} C ${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`);
    path.setAttribute("class", `tl-connection${isSelected ? " selected" : ""}`);
    path.setAttribute("marker-end", "url(#ttx-arrow)");

    if (conn.isParallel) {
      path.setAttribute("stroke-dasharray", "8 4");
    }

    grp.appendChild(path);

    // ── Duration / label text ─────────────────────────────────────────────────
    if (conn.label || conn.duration) {
      const labelText = [
        conn.label,
        conn.duration ? `(${conn.duration}${conn.timeScale ? " " + conn.timeScale : ""})` : ""
      ].filter(Boolean).join(" ");

      const lbl = document.createElementNS(NS, "text");
      lbl.setAttribute("class",        "tl-conn-label");
      lbl.setAttribute("x",            (sp.x + tp.x) / 2);
      lbl.setAttribute("y",            (sp.y + tp.y) / 2 - 10);
      lbl.setAttribute("text-anchor",  "middle");
      lbl.textContent = labelText;
      grp.appendChild(lbl);
    }

    // ── Click handler ─────────────────────────────────────────────────────────
    path.addEventListener("click", (e) => {
      e.stopPropagation();
      this._selectConnection(conn.id);
    });

    return grp;
  }

  // ── Node position helpers ─────────────────────────────────────────────────

  /**
   * Return the world-space position of an actor, using:
   *   1. A live drag override (while dragging)
   *   2. The saved system.canvasX/Y (if set)
   *   3. A computed auto-layout position
   * @param {Actor} actor
   * @returns {{ x: number, y: number }}
   */
  _getNodePosition(actor) {
    if (this._dragOverride.has(actor.id)) return this._dragOverride.get(actor.id);
    if (actor.system.canvasX != null && actor.system.canvasY != null) {
      return { x: actor.system.canvasX, y: actor.system.canvasY };
    }
    return this._autoPositions.get(actor.id) ?? { x: 200, y: 200 };
  }

  /**
   * Assign auto-layout positions to actors whose canvasX/Y are null,
   * if they don't already have an auto-position assigned.
   * Sorts by dateTime then name; lays out in a grid.
   * @param {Actor[]} actors
   */
  _ensureAutoLayout(actors) {
    const unpositioned = actors.filter(
      a => a.system.canvasX == null && !this._autoPositions.has(a.id)
    );
    if (unpositioned.length === 0) return;

    // Sort by dateTime, then name
    unpositioned.sort((a, b) => {
      const dtCmp = (a.system.dateTime ?? "").localeCompare(b.system.dateTime ?? "");
      return dtCmp !== 0 ? dtCmp : a.name.localeCompare(b.name);
    });

    // Determine starting index to avoid collisions with already-positioned nodes
    const startIndex = this._autoPositions.size;
    const cols = Math.max(1, Math.ceil(Math.sqrt(unpositioned.length + startIndex)));

    unpositioned.forEach((actor, localIdx) => {
      const i   = startIndex + localIdx;
      const col = i % cols;
      const row = Math.floor(i / cols);
      this._autoPositions.set(actor.id, {
        x: 120 + col * 210,
        y: 120 + row * 150
      });
    });
  }

  // ── Node interaction ──────────────────────────────────────────────────────

  /**
   * Attach pointer and double-click listeners to a node <g> element.
   * Handles: drag (move + save), single-click (select + property card),
   * double-click (open sheet), and CONNECTING mode completion.
   * @param {SVGGElement} el
   * @param {Actor} actor
   */
  _attachNodeListeners(el, actor) {
    // ── Pointer down: start drag or complete connection ──────────────────────
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      const mode = this._state.mode;

      if (mode === TLMode.CONNECTING) {
        e.preventDefault();
        this._completeConnection(actor.id);
        return;
      }

      if (mode === TLMode.NORMAL) {
        const pos = this._getNodePosition(actor);
        this._dragState = {
          actorId:      actor.id,
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startWorldX:  pos.x,
          startWorldY:  pos.y,
          moved:        false
        };
        el.setPointerCapture(e.pointerId);
      }
    });

    // ── Pointer move: update drag ────────────────────────────────────────────
    el.addEventListener("pointermove", (e) => {
      if (!this._dragState || this._dragState.actorId !== actor.id) return;

      const dx = (e.clientX - this._dragState.startScreenX) / this._state.zoom;
      const dy = (e.clientY - this._dragState.startScreenY) / this._state.zoom;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._dragState.moved = true;

      if (this._dragState.moved) {
        const nx = this._dragState.startWorldX + dx;
        const ny = this._dragState.startWorldY + dy;

        // Update position override (used by _drawConnections)
        this._dragOverride.set(actor.id, { x: nx, y: ny });

        // Move this node directly (skip full refresh for performance)
        el.setAttribute("transform", `translate(${nx},${ny})`);

        // Redraw connections to follow the moving node
        this._drawConnections();
      }
    });

    // ── Pointer up: save position or treat as click ──────────────────────────
    el.addEventListener("pointerup", async (e) => {
      if (!this._dragState || this._dragState.actorId !== actor.id) return;

      const ds = this._dragState;
      this._dragState = null;
      this._dragOverride.delete(actor.id);

      if (ds.moved) {
        // Save final position
        const savedX = Math.round(ds.startWorldX + (e.clientX - ds.startScreenX) / this._state.zoom);
        const savedY = Math.round(ds.startWorldY + (e.clientY - ds.startScreenY) / this._state.zoom);

        await actor.update({
          "system.canvasX": savedX,
          "system.canvasY": savedY
        });
        // Note: updateActor hook triggers _scheduleRefresh automatically
      } else {
        // Click: select and show property card
        this._selectNode(actor.id, e);
      }
    });

    // ── Double-click: open sheet ─────────────────────────────────────────────
    el.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this._dragState = null;
      actor.sheet.render(true);
    });
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  /**
   * Select a node: highlight it in the SVG and show a property card.
   * Clicking the same node again deselects it.
   * @param {string} actorId
   * @param {PointerEvent} event
   */
  _selectNode(actorId, event) {
    const alreadySelected = this._state.selectedId === actorId;

    this._state.selectedId = alreadySelected ? null : actorId;
    this._hidePropertyCards();

    // Update .selected class on all nodes
    this.element?.find?.("g.tl-node").each((_, el) => {
      el.classList.toggle("selected", el.dataset.actorId === this._state.selectedId);
    });

    if (this._state.selectedId) {
      const actor = game.actors.get(actorId);
      if (actor) this._showPropertyCard(actor, event);
    }
  }

  /**
   * Select a connection by id (highlights its path).
   * @param {string} connId
   */
  _selectConnection(connId) {
    const alreadySelected = this._state.selectedId === connId;
    this._state.selectedId = alreadySelected ? null : connId;
    this._hidePropertyCards();

    this.element?.find?.("svg .tl-connection").each((_, el) => {
      const grp = el.closest(".tl-connection-group");
      el.classList.toggle("selected", grp?.dataset?.connId === this._state.selectedId);
    });
  }

  // ── Property cards ────────────────────────────────────────────────────────

  /**
   * Inject a property card for the given actor into .timeline-property-cards.
   * @param {Actor} actor
   * @param {PointerEvent} event  Used to position the card near the node
   */
  _showPropertyCard(actor, event) {
    const container = this.element?.find?.(".timeline-property-cards")[0];
    if (!container) return;

    container.innerHTML = "";

    const pos  = this._getNodePosition(actor);
    const wrap = this.element.find(".timeline-canvas-wrap")[0];
    if (!wrap) return;

    // Convert world coords → screen coords relative to wrap
    const screenX = pos.x * this._state.zoom + this._state.panX;
    const screenY = pos.y * this._state.zoom + this._state.panY;

    const isAction = actor.type === "action";
    const rawDesc  = actor.system.description?.replace(/<[^>]+>/g, "").trim() ?? "";
    const desc     = rawDesc.length > 120 ? rawDesc.slice(0, 118) + "…" : rawDesc;

    const card = document.createElement("div");
    card.className = "tl-property-card";

    let outcomeHtml = "";
    if (isAction && actor.system.resolved && actor.system.outcome) {
      const oc = actor.system.outcome;
      outcomeHtml = `<span class="outcome-badge outcome-${oc}">${oc.replace(/-/g, " ")}</span>`;
    }

    card.innerHTML = `
      <div class="card-name">${actor.name}</div>
      <div class="card-datetime">${actor.system.dateTime ?? ""}</div>
      ${desc ? `<div class="card-description">${desc}</div>` : ""}
      ${isAction ? `
        <div class="card-actor-tn">
          <span>TN ${actor.system.targetNumber ?? 50}%</span>
          ${outcomeHtml}
        </div>` : ""}
      <div style="margin-top:6px; display:flex; gap:5px;">
        <button type="button" class="card-open-btn ttxworks-btn small">Open Sheet</button>
        <button type="button" class="card-close-btn ttxworks-btn small">✕</button>
      </div>
    `;

    // Position card to the right of the node (clamp to viewport)
    const cardW = 220;
    const wrapW = wrap.clientWidth;
    let left = screenX + (isAction ? ACTION_W / 2 + 10 : EVENT_RADIUS + 10);
    if (left + cardW > wrapW - 8) left = screenX - cardW - (isAction ? ACTION_W / 2 + 10 : EVENT_RADIUS + 10);
    const top = Math.max(4, screenY - 40);

    card.style.left = `${left}px`;
    card.style.top  = `${top}px`;

    card.querySelector(".card-open-btn").addEventListener("click", () => actor.sheet.render(true));
    card.querySelector(".card-close-btn").addEventListener("click", () => {
      this._state.selectedId = null;
      this._hidePropertyCards();
      this.element?.find?.("g.tl-node.selected").each((_, el) => el.classList.remove("selected"));
    });

    container.appendChild(card);
  }

  /** Remove all property cards from the overlay. */
  _hidePropertyCards() {
    const container = this.element?.find?.(".timeline-property-cards")[0];
    if (container) container.innerHTML = "";
  }

  // ── Connection completion ─────────────────────────────────────────────────

  /**
   * Finalise a connection being built in CONNECTING mode.
   * @param {string} targetId  The actor id the user clicked on
   */
  async _completeConnection(targetId) {
    const sourceId = this._state.connectSourceId;
    this._setMode(TLMode.NORMAL);

    if (!sourceId || sourceId === targetId) return;

    // Prevent duplicates
    const existing = TimelineManager.getConnectionsFor(sourceId);
    if (existing.some(c => c.sourceId === sourceId && c.targetId === targetId)) {
      ui.notifications.warn("A connection between these nodes already exists.");
      return;
    }

    await TimelineManager.addConnection({ sourceId, targetId });
    ui.notifications.info("Connection created.");
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  _onKeyDown(event) {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;

    switch (event.key.toLowerCase()) {
      case "e":
        event.stopPropagation();
        this._setMode(TLMode.CREATING_EVENT);
        break;
      case "a":
        event.stopPropagation();
        this._setMode(TLMode.CREATING_ACTION);
        break;
      case "c":
        event.stopPropagation();
        if (this._state.selectedId && game.actors.get(this._state.selectedId)) {
          this._startConnection(this._state.selectedId);
        } else {
          ui.notifications.info("Select an Event or Action first, then press C to connect.");
        }
        break;
      case "w":
        event.stopPropagation();
        // Phase 5: waypoint editing
        break;
      case "t":
        event.stopPropagation();
        this._setMode(TLMode.ADDING_TEXT);
        break;
      case "escape":
        event.stopPropagation();
        this._setMode(TLMode.NORMAL);
        break;
      case "delete":
      case "backspace":
        event.stopPropagation();
        this._deleteSelected();
        break;
    }
  }

  // ── Pan & zoom ────────────────────────────────────────────────────────────

  _panState = null;

  _onPointerDown(event) {
    if (event.button !== 0) return;

    const mode   = this._state.mode;
    const target = event.target;
    const isBackground = target.classList.contains("timeline-canvas-wrap")
                      || target.tagName === "CANVAS"
                      || target.tagName === "svg"
                      || target.tagName === "SVG"
                      || target.tagName === "g"
                      || target.classList.contains("svg-world");

    if (!isBackground) return;

    if (mode === TLMode.NORMAL) {
      // Background pan
      this._panState = {
        startX:  event.clientX,
        startY:  event.clientY,
        originX: this._state.panX,
        originY: this._state.panY,
        moved:   false
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    // In CREATE/CONNECTING modes, we act on pointerup (click semantics)
  }

  _onPointerMove(event) {
    if (!this._panState) return;
    const dx = event.clientX - this._panState.startX;
    const dy = event.clientY - this._panState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._panState.moved = true;
    this._state.panX = this._panState.originX + dx;
    this._state.panY = this._panState.originY + dy;
    this._applyTransform();
  }

  _onPointerUp(event) {
    if (this._panState) {
      const wasPan = this._panState.moved;
      this._panState = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);

      if (!wasPan && this._state.mode === TLMode.NORMAL) {
        // Background click in NORMAL mode → deselect everything
        this._state.selectedId = null;
        this._hidePropertyCards();
        this.element?.find?.("g.tl-node.selected").each((_, el) => el.classList.remove("selected"));
        this.element?.find?.("svg .tl-connection.selected").each((_, el) => el.classList.remove("selected"));
      }
      return;
    }

    // Background click in CREATE or CONNECTING mode (no pointer capture was set)
    if (event.button === 0) {
      const mode = this._state.mode;

      if (mode === TLMode.CREATING_EVENT || mode === TLMode.CREATING_ACTION) {
        const wrap  = event.currentTarget;
        const rect  = wrap.getBoundingClientRect();
        const worldX = Math.round((event.clientX - rect.left  - this._state.panX) / this._state.zoom);
        const worldY = Math.round((event.clientY - rect.top   - this._state.panY) / this._state.zoom);
        const type   = mode === TLMode.CREATING_EVENT ? "event" : "action";
        this._setMode(TLMode.NORMAL);
        this.showCreateDialog(type, worldX, worldY);
      }
    }
  }

  _onWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    this._adjustZoom(delta, event.clientX, event.clientY);
  }

  /**
   * Adjust zoom by delta.
   * If clientX/clientY are provided, zoom toward that screen point so the
   * world point under the cursor remains stationary.
   * @param {number}  delta
   * @param {number=} clientX
   * @param {number=} clientY
   */
  _adjustZoom(delta, clientX, clientY) {
    const prevZoom = this._state.zoom;
    const newZoom  = Math.max(0.2, Math.min(3, prevZoom + delta));

    if (clientX != null && clientY != null) {
      const wrap = this.element?.find?.(".timeline-canvas-wrap")[0];
      if (wrap) {
        const rect   = wrap.getBoundingClientRect();
        const cx     = clientX - rect.left;
        const cy     = clientY - rect.top;
        // World point currently under the cursor
        const worldX = (cx - this._state.panX) / prevZoom;
        const worldY = (cy - this._state.panY) / prevZoom;
        // After zoom, adjust pan so worldX/Y stays under cursor
        this._state.panX = cx - worldX * newZoom;
        this._state.panY = cy - worldY * newZoom;
      }
    }

    this._state.zoom = newZoom;
    this._applyTransform();
    this._updateInfoBar();
  }

  _resetZoom() {
    this._state.zoom = 1;
    this._state.panX = 0;
    this._state.panY = 0;
    this._applyTransform();
    this._updateInfoBar();
  }

  /**
   * Fit all visible nodes into the current viewport.
   * Calculates the bounding box of all node positions and sets pan/zoom accordingly.
   */
  _fitToView() {
    const actors = this._getTimelineActors().filter(a => a.system.visible !== false);
    if (actors.length === 0) { this._resetZoom(); return; }

    const wrap = this.element?.find?.(".timeline-canvas-wrap")[0];
    if (!wrap) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const padding = 80;

    for (const actor of actors) {
      const { x, y } = this._getNodePosition(actor);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;

    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;
    const viewW  = wrap.clientWidth  || 800;
    const viewH  = wrap.clientHeight || 500;

    const zoom = Math.max(0.2, Math.min(2, Math.min(viewW / worldW, viewH / worldH)));

    this._state.zoom = zoom;
    this._state.panX = (viewW - worldW * zoom) / 2 - minX * zoom;
    this._state.panY = (viewH - worldH * zoom) / 2 - minY * zoom;

    this._applyTransform();
    this._updateInfoBar();
  }

  /** Apply current pan/zoom to the SVG world group and shift the background grid. */
  _applyTransform() {
    // SVG world group
    const svgWorld = this.element?.find?.("g.svg-world")[0];
    if (svgWorld) {
      svgWorld.setAttribute("transform",
        `translate(${this._state.panX}, ${this._state.panY}) scale(${this._state.zoom})`
      );
    }

    // Shift the CSS dot-grid with pan so it feels "attached" to the world
    const wrap = this.element?.find?.(".timeline-canvas-wrap")[0];
    if (wrap) {
      const bpx = (this._state.panX % 40).toFixed(1);
      const bpy = (this._state.panY % 40).toFixed(1);
      wrap.style.backgroundPosition = `${bpx}px ${bpy}px`;
    }

    // PIXI world container (preserved for future use)
    if (this._pixi?.stage) {
      const world = this._pixi.stage.getChildByName?.("world");
      if (world) {
        world.x = this._state.panX;
        world.y = this._state.panY;
        world.scale.set(this._state.zoom);
      }
    }
  }

  // ── Mode management ───────────────────────────────────────────────────────

  _setMode(mode) {
    this._state.mode             = mode;
    this._state.connectSourceId  = null;

    const indicator = this.element?.find?.(".tl-mode-indicator");
    if (!indicator?.length) return;

    const labels = {
      [TLMode.NORMAL]:          "",
      [TLMode.CREATING_EVENT]:  "Click canvas to place Event",
      [TLMode.CREATING_ACTION]: "Click canvas to place Action",
      [TLMode.CONNECTING]:      "Click target node to connect — Esc to cancel",
      [TLMode.ADDING_WAYPOINT]: "Click a Connection to add a Waypoint",
      [TLMode.ADDING_TEXT]:     "Click to place Text annotation"
    };

    const label = labels[mode] ?? "";
    indicator.text(label).toggleClass("active", mode !== TLMode.NORMAL);

    const wrap = this.element?.find?.(".timeline-canvas-wrap")[0];
    if (wrap) {
      wrap.style.cursor = mode === TLMode.NORMAL ? "default" : "crosshair";
    }
  }

  _startConnection(sourceId) {
    this._state.connectSourceId = sourceId;
    this._setMode(TLMode.CONNECTING);
    const actor     = game.actors.get(sourceId);
    const indicator = this.element?.find?.(".tl-mode-indicator");
    if (indicator?.length && actor) {
      indicator.text(`Connecting from "${actor.name}" — click target node`).addClass("active");
    }
  }

  // ── Delete selected ───────────────────────────────────────────────────────

  async _deleteSelected() {
    const id = this._state.selectedId;
    if (!id) return;

    // Check if it's an actor or a connection
    const actor = game.actors.get(id);
    if (actor && (actor.type === "event" || actor.type === "action")) {
      const confirmed = await Dialog.confirm({
        title:   "Delete Node",
        content: `<p>Delete "<strong>${actor.name}</strong>" and all its connections?</p>`
      });
      if (confirmed) {
        this._state.selectedId = null;
        this._hidePropertyCards();
        await actor.delete();
      }
      return;
    }

    // Check if it's a connection
    const conn = TimelineManager.getConnection(id);
    if (conn) {
      const src = game.actors.get(conn.sourceId);
      const tgt = game.actors.get(conn.targetId);
      const confirmed = await Dialog.confirm({
        title:   "Delete Connection",
        content: `<p>Delete the connection from "<strong>${src?.name ?? conn.sourceId}</strong>" to "<strong>${tgt?.name ?? conn.targetId}</strong>"?</p>`
      });
      if (confirmed) {
        this._state.selectedId = null;
        await TimelineManager.deleteConnection(id);
      }
    }
  }

  // ── Node creation dialogs ─────────────────────────────────────────────────

  /**
   * Show a dialog to create an Event or Action at the given canvas position.
   * @param {"event"|"action"} type
   * @param {number} x  World-space X
   * @param {number} y  World-space Y
   */
  async showCreateDialog(type, x = 0, y = 0) {
    const isAction  = type === "action";
    const typeLabel = isAction ? "Action" : "Event";

    const content = `
      <form class="ttxworks-create-node-dialog">
        <div class="form-group">
          <label>Date / Time <span class="required">*</span></label>
          <input type="text" name="dateTime" placeholder="e.g. 2024-03-15 09:34 UTC" required/>
        </div>
        <div class="form-group">
          <label>Name <span class="required">*</span></label>
          <input type="text" name="name" placeholder="${typeLabel} name" required/>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="3" placeholder="Optional short description..."></textarea>
        </div>
        ${isAction ? `
        <div class="form-group">
          <label>Target Number (%)</label>
          <input type="number" name="targetNumber" value="50" min="1" max="100"/>
        </div>` : ""}
      </form>`;

    return new Promise(resolve => {
      new Dialog({
        title:   `New ${typeLabel}`,
        content,
        buttons: {
          create: {
            icon:  '<i class="fas fa-plus"></i>',
            label: "Create",
            callback: async html => {
              const form     = html[0].querySelector("form");
              const dateTime = form.dateTime.value.trim();
              const name     = form.name.value.trim();

              if (!dateTime || !name) {
                ui.notifications.warn("Date/Time and Name are required.");
                resolve(null);
                return;
              }

              const systemData = { dateTime, canvasX: x, canvasY: y };
              if (isAction) {
                systemData.targetNumber = parseInt(form.targetNumber?.value ?? 50);
              }

              const actor = await Actor.create({ name, type, system: systemData });
              resolve(actor);
            }
          },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "create"
      }).render(true);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _getTimelineActors() {
    return game.actors.filter(a => a.type === "event" || a.type === "action");
  }

  /**
   * Truncate a string to maxLen characters, appending "…" if needed.
   * @param {string} str
   * @param {number} maxLen
   * @returns {string}
   */
  _truncate(str, maxLen) {
    if (!str) return "";
    return str.length > maxLen ? str.slice(0, maxLen - 1) + "\u2026" : str;
  }

  // ── Hook registration / teardown ──────────────────────────────────────────

  _registerHooks() {
    this._hookIds.push(
      Hooks.on("createActor", (a)  => { if (this._isTimelineActor(a))  this._scheduleRefresh(); }),
      Hooks.on("updateActor", (a)  => { if (this._isTimelineActor(a))  this._scheduleRefresh(); }),
      Hooks.on("deleteActor", (a)  => { if (this._isTimelineActor(a))  this._scheduleRefresh(); }),
      Hooks.on("ttxworks.connectionsChanged", () => this._scheduleRefresh())
    );
  }

  _teardownHooks() {
    for (const id of this._hookIds) Hooks.off(id);
    this._hookIds = [];
  }

  _isTimelineActor(actor) {
    return actor.type === "event" || actor.type === "action";
  }

  // ── render override — register hooks on first open ────────────────────────

  /** @override */
  async _render(force, options) {
    await super._render(force, options);
    if (force && this._hookIds.length === 0) {
      this._registerHooks();
    }
  }
}
