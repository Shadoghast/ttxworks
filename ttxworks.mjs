/**
 * TTXWorks — A Narrative Framework for Tabletop Exercises
 * Foundry VTT System v0.2.0
 */

import {
  IndividualData, TeamData, AdversaryData, NodeData,
  EventData, ActionData,
  SkillData, AssetData, ClockData, EffectData
} from "./module/data-models.mjs";

import { TTXWorksActor, TTXWorksItem } from "./module/documents.mjs";
import { TimelineManager }            from "./module/timeline-manager.mjs";
import { TimelineCanvas, TLMode }     from "./module/timeline-canvas.mjs";

import { IndividualSheet } from "./module/sheets/individual-sheet.mjs";
import { TeamSheet }       from "./module/sheets/team-sheet.mjs";
import { AdversarySheet }  from "./module/sheets/adversary-sheet.mjs";
import { NodeSheet }       from "./module/sheets/node-sheet.mjs";
import { EventSheet }      from "./module/sheets/event-sheet.mjs";
import { ActionSheet }     from "./module/sheets/action-sheet.mjs";
import { SkillSheet }      from "./module/sheets/skill-sheet.mjs";
import { AssetSheet }      from "./module/sheets/asset-sheet.mjs";
import { ClockSheet }      from "./module/sheets/clock-sheet.mjs";
import { EffectSheet }     from "./module/sheets/effect-sheet.mjs";

/* ============================================================
   INIT
   ============================================================ */

// ── Exercise Mode constants ────────────────────────────────────────────────
//
// TIMELINE_TYPES — the actor types that exist in Timeline Mode.
//   Events and Actions are the only actors the GM creates on the canvas.
//
// DETAIL_TYPES — the actor types that exist in Detail Mode.
//   These are the full character-sheet actors (Individual, Team, Adversary, Node)
//   used when running a rich, character-driven exercise with Focus/Stress tracking.
//
// Both sets live in system.json so Foundry knows about them; we just hide whichever
// half isn't relevant to the current mode so the GM's UI stays uncluttered.

const TIMELINE_TYPES = ["event", "action"];
const DETAIL_TYPES   = ["individual", "team", "adversary", "node"];

Hooks.once("init", function () {
  console.log("TTXWorks | Initializing system...");

  // Store system reference
  game.ttxworks = { TTXWorksActor, TTXWorksItem, TimelineManager, TimelineCanvas };

  // ── Exercise Mode Setting ─────────────────────────────────────────────────
  //
  // This world-level setting controls which actor types are visible throughout
  // the UI.  It appears in Configure Settings → System Settings.
  //
  // "timeline" — GM works on the Timeline Map; only Events and Actions exist.
  // "detail"   — Full character-sheet mode; Individual, Team, Adversary, Node.
  //
  // The onChange callback re-renders the Actors sidebar so the change is
  // immediately visible without a page reload.
  game.settings.register("ttxworks", "exerciseMode", {
    name:  "TTXWORKS.SettingExerciseModeLabel",
    hint:  "TTXWORKS.SettingExerciseModeHint",
    scope: "world",       // stored per-world, GM-only to change
    config: true,         // shows up in the Configure Settings dialog automatically
    type:  String,
    choices: {
      timeline: "Timeline Mode — Events & Actions",
      detail:   "Detail Mode — Individuals, Teams, Adversaries & Nodes"
    },
    default:  "timeline",
    onChange: () => {
      // Refresh the Actors sidebar so hidden/shown entries update instantly.
      ui.actors?.render();
    }
  });

  // Document classes
  CONFIG.Actor.documentClass = TTXWorksActor;
  CONFIG.Item.documentClass  = TTXWorksItem;

  // Data models
  CONFIG.Actor.dataModels = {
    individual: IndividualData,
    team:       TeamData,
    adversary:  AdversaryData,
    node:       NodeData,
    event:      EventData,
    action:     ActionData
  };

  CONFIG.Item.dataModels = {
    skill:  SkillData,
    asset:  AssetData,
    clock:  ClockData,
    effect: EffectData
  };

  // Initiative
  CONFIG.Combat.initiative = { formula: "1d100", decimals: 0 };

  // ── Actor Sheets ──────────────────────────────────────────
  Actors.unregisterSheet("core", ActorSheet);

  Actors.registerSheet("ttxworks", IndividualSheet, {
    types: ["individual"], makeDefault: true,
    label: "TTXWORKS.SheetIndividual"
  });
  Actors.registerSheet("ttxworks", TeamSheet, {
    types: ["team"], makeDefault: true,
    label: "TTXWORKS.SheetTeam"
  });
  Actors.registerSheet("ttxworks", AdversarySheet, {
    types: ["adversary"], makeDefault: true,
    label: "TTXWORKS.SheetAdversary"
  });
  Actors.registerSheet("ttxworks", NodeSheet, {
    types: ["node"], makeDefault: true,
    label: "TTXWORKS.SheetNode"
  });
  Actors.registerSheet("ttxworks", EventSheet, {
    types: ["event"], makeDefault: true,
    label: "TTXWORKS.SheetEvent"
  });
  Actors.registerSheet("ttxworks", ActionSheet, {
    types: ["action"], makeDefault: true,
    label: "TTXWORKS.SheetAction"
  });

  // ── Item Sheets ───────────────────────────────────────────
  Items.unregisterSheet("core", ItemSheet);

  Items.registerSheet("ttxworks", SkillSheet, {
    types: ["skill"], makeDefault: true,
    label: "TTXWORKS.SheetSkill"
  });
  Items.registerSheet("ttxworks", AssetSheet, {
    types: ["asset"], makeDefault: true,
    label: "TTXWORKS.SheetAsset"
  });
  Items.registerSheet("ttxworks", ClockSheet, {
    types: ["clock"], makeDefault: true,
    label: "TTXWORKS.SheetClock"
  });
  Items.registerSheet("ttxworks", EffectSheet, {
    types: ["effect"], makeDefault: true,
    label: "TTXWORKS.SheetEffect"
  });

  // ── Keybindings ───────────────────────────────────────────
  // We register all Timeline Map keyboard shortcuts here using Foundry's native
  // keybinding API instead of raw addEventListener() calls. Benefits:
  //   • Keys appear in Configure Controls — users can rebind them
  //   • PRIORITY precedence prevents conflicts with other modules
  //   • Returning true consumes the event so it doesn't bubble further
  //   • Works globally — no need for the canvas element to have DOM focus
  //
  // Each binding guards with isTimelineOpen() so the keys are silent when
  // the Timeline Map window is closed.

  /** Returns true only when the Timeline canvas window is currently rendered. */
  const isTimelineOpen = () => !!game.ttxworks?.timelineCanvas?.rendered;

  // E — enter "place Event" mode; next canvas click drops a new Event node
  game.keybindings.register("ttxworks", "createEvent", {
    name:       "TTXWORKS.Keybinding.CreateEvent",
    hint:       "TTXWORKS.Keybinding.CreateEventHint",
    editable:   [{ key: "KeyE" }],
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
    onDown: () => {
      if (!isTimelineOpen()) return false;
      game.ttxworks.timelineCanvas._setMode(TLMode.CREATING_EVENT);
      return true; // returning true consumes the event — other modules won't see it
    }
  });

  // A — enter "place Action" mode; next canvas click drops a new Action node
  game.keybindings.register("ttxworks", "createAction", {
    name:       "TTXWORKS.Keybinding.CreateAction",
    hint:       "TTXWORKS.Keybinding.CreateActionHint",
    editable:   [{ key: "KeyA" }],
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
    onDown: () => {
      if (!isTimelineOpen()) return false;
      game.ttxworks.timelineCanvas._setMode(TLMode.CREATING_ACTION);
      return true;
    }
  });

  // C — begin drawing a connection arrow from the currently selected node
  game.keybindings.register("ttxworks", "connectNodes", {
    name:       "TTXWORKS.Keybinding.Connect",
    hint:       "TTXWORKS.Keybinding.ConnectHint",
    editable:   [{ key: "KeyC" }],
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
    onDown: () => {
      if (!isTimelineOpen()) return false;
      const tl = game.ttxworks.timelineCanvas;
      const selectedId = tl._state?.selectedId;
      if (selectedId && game.actors.get(selectedId)) {
        tl._startConnection(selectedId);
      } else {
        ui.notifications.info("Select an Event or Action first, then press C to connect.");
      }
      return true;
    }
  });

  // T — enter text-label placement mode (reserved for Phase 5)
  game.keybindings.register("ttxworks", "addText", {
    name:       "TTXWORKS.Keybinding.AddText",
    hint:       "TTXWORKS.Keybinding.AddTextHint",
    editable:   [{ key: "KeyT" }],
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
    onDown: () => {
      if (!isTimelineOpen()) return false;
      game.ttxworks.timelineCanvas._setMode(TLMode.ADDING_TEXT);
      return true;
    }
  });

  // Escape — return to normal pointer mode from any active placement/connect mode.
  // Marked uneditable so users can't accidentally clear this safety-valve key.
  game.keybindings.register("ttxworks", "cancelMode", {
    name:        "TTXWORKS.Keybinding.Cancel",
    hint:        "TTXWORKS.Keybinding.CancelHint",
    uneditable:  [{ key: "Escape" }],
    precedence:  CONST.KEYBINDING_PRECEDENCE.PRIORITY,
    onDown: () => {
      if (!isTimelineOpen()) return false;
      game.ttxworks.timelineCanvas._setMode(TLMode.NORMAL);
      return true;
    }
  });

  // Delete / Backspace — remove the selected node or connection arrow
  game.keybindings.register("ttxworks", "deleteSelected", {
    name:       "TTXWORKS.Keybinding.Delete",
    hint:       "TTXWORKS.Keybinding.DeleteHint",
    editable:   [{ key: "Delete" }, { key: "Backspace" }],
    precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY,
    onDown: () => {
      if (!isTimelineOpen()) return false;
      game.ttxworks.timelineCanvas._deleteSelected();
      return true;
    }
  });

  // ── Handlebars Helpers ────────────────────────────────────
  _registerHandlebarsHelpers();

  // ── Preload Templates ─────────────────────────────────────
  loadTemplates([
    "systems/ttxworks/templates/actor/individual-sheet.hbs",
    "systems/ttxworks/templates/actor/team-sheet.hbs",
    "systems/ttxworks/templates/actor/adversary-sheet.hbs",
    "systems/ttxworks/templates/actor/node-sheet.hbs",
    "systems/ttxworks/templates/item/skill-sheet.hbs",
    "systems/ttxworks/templates/item/asset-sheet.hbs",
    "systems/ttxworks/templates/item/clock-sheet.hbs",
    "systems/ttxworks/templates/item/effect-sheet.hbs",
    // NOTE: clock-widget, focus-stress-bar, and item-list are CSS class names
    // used inline in templates — they are NOT Handlebars partials, so no files exist.
    "systems/ttxworks/templates/actor/event-sheet.hbs",
    "systems/ttxworks/templates/actor/action-sheet.hbs",
    "systems/ttxworks/templates/timeline/timeline-app.hbs"
  ]);

  console.log("TTXWorks | System initialized.");
});

/* ============================================================
   READY
   ============================================================ */

Hooks.once("ready", async function () {
  console.log("TTXWorks | Ready.");

  // Initialise TimelineManager (creates the Journal Entry if absent, registers hooks)
  await TimelineManager.ensureJournal();
  TimelineManager.registerHooks();

  // Instantiate the singleton canvas (does not open it)
  game.ttxworks.timelineCanvas = new TimelineCanvas();

  // Socket handler for multi-client canvas sync
  game.socket.on("system.ttxworks", data => {
    if (data?.type === "refreshTimeline") {
      game.ttxworks.timelineCanvas?._scheduleRefresh?.();
    }
  });

  console.log("TTXWorks | TimelineManager ready.");
});

// ── Scene Controls ─────────────────────────────────────────────────────────
//
// Adds a "TTXWorks" group to the left-hand Scene Controls toolbar with two tools:
//
//   • Open Timeline Map — renders the TimelineCanvas application window.
//   • Toggle Mode       — flips between Timeline Mode and Detail Mode in one click,
//                         so the GM doesn't have to open Configure Settings mid-exercise.
//
// The toggle button label and icon update to reflect the CURRENT mode so the GM
// always knows which mode is active before clicking.

Hooks.on("getSceneControlButtons", controls => {
  // Read current mode (may be undefined during very early init; fall back to "timeline")
  const mode       = game.settings?.get("ttxworks", "exerciseMode") ?? "timeline";
  const isTimeline = mode === "timeline";

  // The two toolbar buttons are the same regardless of Foundry version;
  // only the container format differs between V12 (array) and V13 (object).
  const toolsArray = [
    {
      name:    "open-timeline",
      title:   "Open Timeline Map",
      icon:    "fas fa-project-diagram",
      button:  true,
      onClick: () => game.ttxworks.timelineCanvas?.render(true)
    },
    {
      // Shows current mode; clicking switches to the opposite mode.
      name:    "toggle-mode",
      title:   isTimeline
                 ? "Switch to Detail Mode (Individuals / Teams)"
                 : "Switch to Timeline Mode (Events / Actions)",
      icon:    isTimeline ? "fas fa-users" : "fas fa-stream",
      button:  true,
      onClick: async () => {
        const current = game.settings.get("ttxworks", "exerciseMode");
        const next    = current === "timeline" ? "detail" : "timeline";
        await game.settings.set("ttxworks", "exerciseMode", next);
        // Re-render Scene Controls so the toggle icon/label refreshes.
        ui.controls.render();
        ui.notifications.info(
          next === "timeline"
            ? "TTXWorks: Switched to Timeline Mode — Events & Actions"
            : "TTXWorks: Switched to Detail Mode — Individuals, Teams, Adversaries & Nodes"
        );
      }
    }
  ];

  // Foundry V12 passes controls as a flat Array; V13 changed it to a plain Object.
  // We detect which format we have and write accordingly so the system works on both.
  if (Array.isArray(controls)) {
    // V12 — append a new control group to the array
    controls.push({
      name:    "ttxworks-timeline",
      title:   "TTXWorks",
      icon:    "fas fa-project-diagram",
      layer:   "controls",
      visible: true,
      tools:   toolsArray
    });
  } else {
    // V13 — assign to a named key; tools must also be an object keyed by name
    const toolsObj = {};
    for (const t of toolsArray) toolsObj[t.name] = t;
    controls["ttxworks-timeline"] = {
      name:    "ttxworks-timeline",
      title:   "TTXWorks",
      icon:    "fas fa-project-diagram",
      layer:   "controls",
      visible: true,
      tools:   toolsObj
    };
  }
});

// ── Actor-Creation Dialog Filter ───────────────────────────────────────────
//
// Foundry shows a "Create Actor" dialog with a <select> of all registered actor
// types.  We intercept that dialog here and remove the options that don't belong
// to the current mode, keeping the list short and unambiguous.
//
// We identify the Create Actor dialog by checking for the type <select> — this
// is safer than matching on the dialog title (which may be localised).

Hooks.on("renderDialog", (dialog, html) => {
  // V12 passes a jQuery object; V13 passes a plain HTMLElement.
  // Normalise to a plain element so the same code works on both versions.
  const root = html instanceof HTMLElement ? html : (html[0] ?? html);

  const typeSelect = root.querySelector('select[name="type"]');
  if (!typeSelect) return;                  // not the Create Actor dialog

  const mode     = game.settings?.get("ttxworks", "exerciseMode") ?? "timeline";
  const hideList = mode === "timeline" ? DETAIL_TYPES : TIMELINE_TYPES;

  hideList.forEach(t => {
    const opt = typeSelect.querySelector(`option[value="${t}"]`);
    if (opt) opt.remove();
  });

  // If only one option remains after filtering, auto-select it so the GM
  // doesn't have to make a redundant choice.
  const remaining = typeSelect.querySelectorAll("option");
  if (remaining.length === 1) typeSelect.value = remaining[0].value;
});

// ── Actors Sidebar Filter ──────────────────────────────────────────────────
//
// After the Actors directory renders, hide sidebar entries whose actor type
// belongs to the inactive mode.  This keeps the list visually tidy — the actors
// still exist in the world and can be found via search; they're just collapsed
// out of the normal view so they don't confuse participants.
//
// We use CSS display:none rather than removing DOM nodes so Foundry's own
// drag/drop and search handlers remain intact.

Hooks.on("renderActorDirectory", (app, html) => {
  const mode     = game.settings?.get("ttxworks", "exerciseMode") ?? "timeline";
  const hideList = mode === "timeline" ? DETAIL_TYPES : TIMELINE_TYPES;

  // V12 passes a jQuery object; V13 passes a plain HTMLElement.
  // Normalise to a plain element so the same code works on both versions.
  const root = html instanceof HTMLElement ? html : (html[0] ?? html);

  // Each actor entry carries data-document-id; look up the actor to get its type
  // and hide it if it belongs to the inactive mode.
  root.querySelectorAll(".directory-item.actor").forEach(el => {
    const id    = el.dataset.documentId;
    const actor = game.actors?.get(id);
    if (actor && hideList.includes(actor.type)) {
      el.style.display = "none";
    }
  });
});

/* ============================================================
   HANDLEBARS HELPERS
   ============================================================ */

function _registerHandlebarsHelpers() {
  // Repeat N times
  Handlebars.registerHelper("times", function (n, block) {
    let out = "";
    for (let i = 0; i < n; i++) out += block.fn(i);
    return out;
  });

  Handlebars.registerHelper("lt",  (a, b) => a < b);
  Handlebars.registerHelper("lte", (a, b) => a <= b);
  Handlebars.registerHelper("gt",  (a, b) => a > b);
  Handlebars.registerHelper("gte", (a, b) => a >= b);
  Handlebars.registerHelper("eq",  (a, b) => a === b);
  Handlebars.registerHelper("neq", (a, b) => a !== b);
  Handlebars.registerHelper("add", (a, b) => a + b);
  Handlebars.registerHelper("sub", (a, b) => a - b);

  // Clock segment array helper
  // Returns an array of { index, filled } for each segment
  Handlebars.registerHelper("clockSegmentArray", function (total, filled) {
    const arr = [];
    for (let i = 0; i < total; i++) arr.push({ index: i, filled: i < filled });
    return arr;
  });

  // Localise an asset status for display class
  Handlebars.registerHelper("assetStatusClass", function (status) {
    return `asset-status-${status}`;
  });

  // Node status → CSS class
  Handlebars.registerHelper("nodeStatusClass", function (status) {
    const map = {
      operational: "status-operational",
      degraded:    "status-degraded",
      compromised: "status-compromised",
      offline:     "status-offline"
    };
    return map[status] ?? "";
  });

  // Pips display for focus/stress
  Handlebars.registerHelper("pips", function (value, max, options) {
    const filled = Math.min(value, max);
    let out = "";
    for (let i = 0; i < max; i++) {
      const cls = i < filled ? "pip filled" : "pip empty";
      out += `<span class="${cls}" data-index="${i}"></span>`;
    }
    return new Handlebars.SafeString(out);
  });

  // Capitalize first letter
  Handlebars.registerHelper("capitalize", (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
}
