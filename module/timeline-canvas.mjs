/**
 * TimelineCanvas — the TTXWorks interactive timeline map window.
 *
 * Built as a standard Foundry Application (compatible with v12 and v13).
 * Rendering pipeline:
 *   render(true)  → opens/re-draws the HTML shell (toolbar, canvas el, SVG, help bar)
 *   refresh()     → re-draws PIXI nodes + SVG connections without touching the DOM shell
 *                   (called on actor/connection data changes; debounced to 100 ms)
 *
 * PIXI rendering (node shapes) is initialised in _initPIXI() — Phase 3.
 * SVG connection drawing lives in _drawConnections() — Phase 3.
 */

import { TimelineManager } from "./timeline-manager.mjs";

// ── Canvas interaction modes ────────────────────────────────────────────────
export const TLMode = Object.freeze({
  NORMAL:           "normal",
  CREATING_EVENT:   "creating-event",
  CREATING_ACTION:  "creating-action",
  CONNECTING:       "connecting",
  ADDING_WAYPOINT:  "adding-waypoint",
  ADDING_TEXT:      "adding-text"
});

// ── TimelineCanvas ───────────────────────────────────────────────────────────
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

    /** PIXI Application instance — initialised in _initPIXI() (Phase 3) */
    this._pixi = null;

    /** Debounce timer for refresh() */
    this._refreshTimer = null;

    /** Bound hook handlers (stored so we can remove them on close) */
    this._hookIds = [];
  }

  // ── Application options ────────────────────────────────────────────────────

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

  // ── getData (template context) ─────────────────────────────────────────────

  getData() {
    return {
      mode:      this._state.mode,
      zoom:      Math.round(this._state.zoom * 100),
      nodeCount: this._getTimelineActors().length,
      connCount: TimelineManager.getConnections().length
    };
  }

  // ── Rendering lifecycle ────────────────────────────────────────────────────

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

    // Initialise PIXI on the canvas element (Phase 3 fills this in)
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

  // ── PIXI (stub — filled in Phase 3) ───────────────────────────────────────

  _initPIXI(html) {
    // Phase 3: initialise PIXI.Application on html.find("canvas.timeline-canvas")[0]
    // For now, the canvas element exists but is inert.
  }

  _destroyPIXI() {
    if (this._pixi) {
      this._pixi.destroy(true);
      this._pixi = null;
    }
  }

  // ── refresh (debounced redraw) ─────────────────────────────────────────────

  /** Schedule a debounced refresh (100 ms window). */
  _scheduleRefresh() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = null;
      this.refresh();
    }, 100);
  }

  /**
   * Re-draw PIXI nodes and SVG connections.
   * Phase 2: updates the info bar. Phase 3: full PIXI + SVG redraw.
   */
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

  // ── Node drawing (stub — filled in Phase 3) ───────────────────────────────

  _drawNodes() {
    // Phase 3: iterate this._getTimelineActors() and render PIXI shapes
  }

  // ── Connection drawing (stub — filled in Phase 3) ─────────────────────────

  _drawConnections() {
    // Phase 3: read TimelineManager.getConnections() and draw SVG paths
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  _onKeyDown(event) {
    // Ignore if focus is on a text input / textarea inside the app
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
        if (this._state.selectedId) {
          this._startConnection(this._state.selectedId);
        } else {
          ui.notifications.info("Select an Event or Action first, then press C to connect.");
        }
        break;
      case "w":
        event.stopPropagation();
        // Phase 5: waypoint on selected connection
        break;
      case "t":
        event.stopPropagation();
        this._setMode(TLMode.ADDING_TEXT);
        break;
      case "escape":
        event.stopPropagation();
        this._setMode(TLMode.NORMAL);
        break;
    }
  }

  // ── Pan & zoom ─────────────────────────────────────────────────────────────

  _panState = null;

  _onPointerDown(event) {
    // Left-button drag on background = pan; handled by mode in Phase 3
    if (event.button === 0 && this._state.mode === TLMode.NORMAL) {
      const target = event.target;
      const isBackground = target.classList.contains("timeline-canvas-wrap")
                        || target.tagName === "CANVAS"
                        || target.tagName === "svg"
                        || target.tagName === "SVG";
      if (isBackground) {
        this._panState = { startX: event.clientX, startY: event.clientY,
                           originX: this._state.panX, originY: this._state.panY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
  }

  _onPointerMove(event) {
    if (!this._panState) return;
    const dx = event.clientX - this._panState.startX;
    const dy = event.clientY - this._panState.startY;
    this._state.panX = this._panState.originX + dx;
    this._state.panY = this._panState.originY + dy;
    this._applyTransform();
  }

  _onPointerUp(event) {
    if (this._panState) {
      this._panState = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  }

  _onWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    this._adjustZoom(delta, event.clientX, event.clientY);
  }

  _adjustZoom(delta, originX, originY) {
    const prevZoom = this._state.zoom;
    this._state.zoom = Math.max(0.2, Math.min(3, prevZoom + delta));
    // TODO Phase 3: zoom toward cursor (adjust pan to keep origin stable)
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

  _fitToView() {
    // Phase 3: calculate bounding box of all nodes, set pan+zoom to fit
    this._resetZoom();
  }

  /** Apply current pan/zoom to the world layer (PIXI stage + SVG group). */
  _applyTransform() {
    // PIXI world container
    if (this._pixi?.stage) {
      const world = this._pixi.stage.getChildByName?.("world");
      if (world) {
        world.x = this._state.panX;
        world.y = this._state.panY;
        world.scale.set(this._state.zoom);
      }
    }

    // SVG world group
    const svgWorld = this.element?.find?.("g.svg-world")[0];
    if (svgWorld) {
      svgWorld.setAttribute("transform",
        `translate(${this._state.panX}, ${this._state.panY}) scale(${this._state.zoom})`
      );
    }
  }

  // ── Mode management ────────────────────────────────────────────────────────

  _setMode(mode) {
    this._state.mode = mode;
    this._state.connectSourceId = null;

    const indicator = this.element?.find?.(".tl-mode-indicator");
    if (!indicator?.length) return;

    const labels = {
      [TLMode.NORMAL]:          "",
      [TLMode.CREATING_EVENT]:  "Click to place Event",
      [TLMode.CREATING_ACTION]: "Click to place Action",
      [TLMode.CONNECTING]:      "Click target node to connect — Esc to cancel",
      [TLMode.ADDING_WAYPOINT]: "Click a Connection to add a Waypoint",
      [TLMode.ADDING_TEXT]:     "Click to place Text annotation"
    };

    const label = labels[mode] ?? "";
    indicator.text(label).toggleClass("active", mode !== TLMode.NORMAL);

    // Update cursor
    const wrap = this.element?.find?.(".timeline-canvas-wrap")[0];
    if (wrap) {
      wrap.style.cursor = mode === TLMode.NORMAL ? "default" : "crosshair";
    }
  }

  _startConnection(sourceId) {
    this._state.connectSourceId = sourceId;
    this._setMode(TLMode.CONNECTING);
    const actor = game.actors.get(sourceId);
    const indicator = this.element?.find?.(".tl-mode-indicator");
    if (indicator?.length && actor) {
      indicator.text(`Connecting from "${actor.name}" — click target node`).addClass("active");
    }
  }

  // ── Node creation dialogs ──────────────────────────────────────────────────

  /**
   * Show a dialog to create an Event or Action at the given canvas position.
   * @param {"event"|"action"} type
   * @param {number} x  Canvas-space X
   * @param {number} y  Canvas-space Y
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
              const form = html[0].querySelector("form");
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

              const actor = await Actor.create({
                name,
                type,
                system: systemData
              });

              resolve(actor);
            }
          },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "create"
      }).render(true);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _getTimelineActors() {
    return game.actors.filter(a => a.type === "event" || a.type === "action");
  }

  // ── Hook registration / teardown ───────────────────────────────────────────

  _registerHooks() {
    this._hookIds.push(
      Hooks.on("createActor",       (a)    => { if (this._isTimelineActor(a))  this._scheduleRefresh(); }),
      Hooks.on("updateActor",       (a)    => { if (this._isTimelineActor(a))  this._scheduleRefresh(); }),
      Hooks.on("deleteActor",       (a)    => { if (this._isTimelineActor(a))  this._scheduleRefresh(); }),
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
