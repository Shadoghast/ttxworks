/**
 * TTXWorks — A Narrative Framework for Tabletop Exercises
 * Foundry VTT System v0.1.0
 */

import {
  IndividualData, TeamData, AdversaryData, NodeData,
  EventData, ActionData,
  SkillData, AssetData, ClockData, EffectData
} from "./module/data-models.mjs";

import { TTXWorksActor, TTXWorksItem } from "./module/documents.mjs";
import { TimelineManager }            from "./module/timeline-manager.mjs";
import { TimelineCanvas }             from "./module/timeline-canvas.mjs";

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

Hooks.once("init", function () {
  console.log("TTXWorks | Initializing system...");

  // Store system reference
  game.ttxworks = { TTXWorksActor, TTXWorksItem, TimelineManager, TimelineCanvas };

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
    "systems/ttxworks/templates/partials/clock-widget.hbs",
    "systems/ttxworks/templates/partials/focus-stress-bar.hbs",
    "systems/ttxworks/templates/partials/item-list.hbs",
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

Hooks.on("getSceneControlButtons", controls => {
  controls.push({
    name:    "ttxworks-timeline",
    title:   "TTXWorks Timeline Map",
    icon:    "fas fa-project-diagram",
    layer:   "controls",
    visible: true,
    tools: [
      {
        name:    "open-timeline",
        title:   "Open Timeline Map",
        icon:    "fas fa-project-diagram",
        button:  true,
        onClick: () => game.ttxworks.timelineCanvas?.render(true)
      }
    ]
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
