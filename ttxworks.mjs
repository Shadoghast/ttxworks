/**
 * TTXWorks — A Narrative Framework for Tabletop Exercises
 * Foundry VTT System v0.1.0
 */

import {
  IndividualData, TeamData, AdversaryData, NodeData,
  SkillData, AssetData, ClockData, EffectData
} from "./module/data-models.mjs";

import { TTXWorksActor, TTXWorksItem } from "./module/documents.mjs";

import { IndividualSheet } from "./module/sheets/individual-sheet.mjs";
import { TeamSheet }       from "./module/sheets/team-sheet.mjs";
import { AdversarySheet }  from "./module/sheets/adversary-sheet.mjs";
import { NodeSheet }       from "./module/sheets/node-sheet.mjs";
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
  game.ttxworks = { TTXWorksActor, TTXWorksItem };

  // Document classes
  CONFIG.Actor.documentClass = TTXWorksActor;
  CONFIG.Item.documentClass  = TTXWorksItem;

  // Data models
  CONFIG.Actor.dataModels = {
    individual: IndividualData,
    team:       TeamData,
    adversary:  AdversaryData,
    node:       NodeData
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
    "systems/ttxworks/templates/partials/item-list.hbs"
  ]);

  console.log("TTXWorks | System initialized.");
});

/* ============================================================
   READY
   ============================================================ */

Hooks.once("ready", function () {
  console.log("TTXWorks | Ready.");
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
