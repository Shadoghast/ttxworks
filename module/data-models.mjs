/**
 * TTXWorks Data Models
 *
 * This file defines the data schema for every Actor and Item type in the system.
 * Each class extends Foundry's TypeDataModel, which gives us:
 *   - Automatic data validation on save
 *   - Default values when a new actor/item is created
 *   - A clean `actor.system` object with typed fields (not raw database objects)
 *
 * ── How TypeDataModel works ───────────────────────────────────────────────────
 * defineSchema() returns an object of field definitions. Foundry reads this to
 * know what fields exist, what types they are, and what their defaults are.
 * When you access `actor.system.focus`, Foundry has already validated and cast
 * the raw database value to the type specified here.
 *
 * Computed properties (getters) are derived values that don't need to be stored
 * in the database — they are recalculated from stored fields each time they're
 * accessed. For example, `isBurnedOut` is always `stress.value >= 6`; there is
 * no need to store a separate boolean for it.
 *
 * ── Why are some fields nullable? ────────────────────────────────────────────
 * Fields like `canvasX / canvasY` are nullable (initial: null) because they are
 * intentionally unset until the user places the node on the canvas. The canvas
 * code uses null as a signal to assign an auto-layout position.
 * Fields like `actorRef` on ActionData are nullable because an Action might not
 * have a linked actor yet when first created.
 */

const { fields } = foundry.data;

// ============================================================
// ACTOR DATA MODELS
// ============================================================

/**
 * IndividualData — schema for the "individual" actor type.
 *
 * An Individual represents a single participant persona (e.g., "CISO",
 * "Incident Commander"). They have a personal Focus pool (max 5) and their
 * own Stress track. Each point of Stress applies -10% to their roll TNs.
 */
export class IndividualData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      role: new fields.StringField({ required: true, blank: true, initial: "" }),
      objectives: new fields.ArrayField(new fields.StringField({ blank: true })),
      restrictions: new fields.ArrayField(new fields.StringField({ blank: true })),
      focus: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 5 }),
        max: new fields.NumberField({ required: true, integer: true, min: 1, initial: 5 })
      }),
      stress: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new fields.NumberField({ required: true, integer: true, initial: 6 })
      }),
      status: new fields.StringField({ required: true, initial: "normal" }),
      biography: new fields.HTMLField({ required: false, blank: true, initial: "" })
    };
  }

  get isBurnedOut() { return this.stress.value >= 6; }
  get isFocusEmpty() { return this.focus.value <= 0; }

  /** Computed TN penalty from stress (-10% per point) */
  get stressPenalty() { return this.stress.value * 10; }
}

/**
 * TeamData — schema for the "team" actor type.
 *
 * A Team represents a functional group (e.g., "SOC Team", "IT Department").
 * Structurally identical to IndividualData but Focus max starts at 10
 * to reflect the combined capacity of multiple people.
 */
export class TeamData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      designation: new fields.StringField({ required: true, blank: true, initial: "" }),
      objectives: new fields.ArrayField(new fields.StringField({ blank: true })),
      restrictions: new fields.ArrayField(new fields.StringField({ blank: true })),
      focus: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new fields.NumberField({ required: true, integer: true, min: 1, initial: 10 })
      }),
      stress: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new fields.NumberField({ required: true, integer: true, initial: 6 })
      }),
      status: new fields.StringField({ required: true, initial: "normal" }),
      biography: new fields.HTMLField({ required: false, blank: true, initial: "" })
    };
  }

  get isBurnedOut() { return this.stress.value >= 6; }
  get isFocusEmpty() { return this.focus.value <= 0; }
  get stressPenalty() { return this.stress.value * 10; }
}

/**
 * AdversaryData — schema for the "adversary" actor type.
 *
 * The Adversary is the Red Team / threat actor. Their sheet is GM-only.
 * They do not roll dice using the standard Focus/Stress system; instead
 * the GM narrates adversary actions and advances Clocks accordingly.
 * The objectives field is HTML so the GM can write rich notes.
 */
export class AdversaryData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      threatProfile: new fields.StringField({ required: true, blank: true, initial: "" }),
      objectives: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      notes: new fields.HTMLField({ required: false, blank: true, initial: "" })
    };
  }
}

/**
 * NodeData — schema for the "node" actor type.
 *
 * A Node is any targetable asset in the scenario that is not a person or team:
 * a server, a database, a network segment, a building, a business process.
 * Nodes have a status (Operational → Offline) and health state descriptions
 * that explain in plain business language what each status means for that
 * specific asset (e.g., "Degraded = ERP is read-only, no transactions").
 */
export class NodeData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      status: new fields.StringField({ required: true, initial: "operational" }),
      healthStates: new fields.SchemaField({
        operational: new fields.StringField({ blank: true, initial: "" }),
        degraded: new fields.StringField({ blank: true, initial: "" }),
        compromised: new fields.StringField({ blank: true, initial: "" }),
        offline: new fields.StringField({ blank: true, initial: "" })
      })
    };
  }

  get statusColor() {
    const map = { operational: "green", degraded: "yellow", compromised: "red", offline: "black" };
    return map[this.status] ?? "gray";
  }
}

/**
 * EventData — schema for the "event" actor type.
 *
 * An Event is an occurrence on the Timeline Map — something that happened
 * (or is happening) that participants need to understand or respond to.
 * Events are purely informational; they don't roll dice.
 *
 * canvasX/Y store the node's position on the timeline canvas. They are
 * null until the user first drags or places the node.
 *
 * predecessors/followers are arrays of actor IDs. They are kept in sync
 * with the connection records in TimelineManager by _syncActorArrays().
 * They exist so templates can display connection info without a separate
 * lookup, but TimelineManager's connection records are the source of truth.
 */
export class EventData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      dateTime:     new fields.StringField({ required: true, blank: false, initial: "" }),
      description:  new fields.HTMLField({ required: false, blank: true, initial: "" }),
      predecessors: new fields.ArrayField(new fields.StringField({ blank: false })),
      followers:    new fields.ArrayField(new fields.StringField({ blank: false })),
      visible:      new fields.BooleanField({ required: true, initial: true }),
      canvasX:      new fields.NumberField({ required: false, nullable: true, initial: null }),
      canvasY:      new fields.NumberField({ required: false, nullable: true, initial: null })
    };
  }
}

/**
 * ActionData — schema for the "action" actor type.
 *
 * An Action represents a response decision on the Timeline Map — something a
 * participant attempted during the exercise. Unlike Events, Actions have:
 *
 *   - actorRef: links to an Individual or Team who makes the roll. Stored as
 *               an actor ID (string). Null until explicitly set.
 *   - targetNumber: the TN% for this specific action (default 50%).
 *   - resolved / outcome: once the dice are rolled, resolved is set to true
 *               and outcome holds the result string (e.g. "critical-success").
 *               The timeline node then displays the outcome badge.
 */
export class ActionData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      dateTime:      new fields.StringField({ required: true, blank: false, initial: "" }),
      description:   new fields.HTMLField({ required: false, blank: true, initial: "" }),
      predecessors:  new fields.ArrayField(new fields.StringField({ blank: false })),
      followers:     new fields.ArrayField(new fields.StringField({ blank: false })),
      visible:       new fields.BooleanField({ required: true, initial: true }),
      canvasX:       new fields.NumberField({ required: false, nullable: true, initial: null }),
      canvasY:       new fields.NumberField({ required: false, nullable: true, initial: null }),
      actorRef:      new fields.StringField({ required: false, blank: true, nullable: true, initial: null }),
      targetNumber:  new fields.NumberField({ required: true, integer: true, min: 1, max: 100, initial: 50 }),
      resolved:      new fields.BooleanField({ required: true, initial: false }),
      outcome:       new fields.StringField({ required: false, blank: true, nullable: true, initial: null })
    };
  }

  get isResolved() { return this.resolved === true; }

  get outcomeClass() {
    const map = {
      "critical-success": "outcome-critical-success",
      "success":          "outcome-success",
      "complication":     "outcome-complication",
      "failure":          "outcome-failure",
      "critical-failure": "outcome-critical-failure"
    };
    return map[this.outcome] ?? "outcome-unresolved";
  }
}

// ============================================================
// ITEM DATA MODELS
// ============================================================

/**
 * SkillData — schema for the "skill" item type.
 *
 * Skills are capabilities possessed by an Individual or Team. They are static
 * for the duration of a scenario (set in Phase 0, not changed mid-exercise).
 * When a skill is directly relevant to an action, it grants +10% TN (the
 * `bonus` field, defaulting to 10).
 */
export class SkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      category: new fields.StringField({ required: true, blank: true, initial: "" }),
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      bonus: new fields.NumberField({ required: true, integer: true, initial: 10 })
    };
  }
}

/**
 * AssetData — schema for the "asset" item type.
 *
 * Assets are pieces of hardware, software, services, or policies that provide
 * mechanical benefits during the exercise. Key concepts:
 *
 *   - status: the GM changes this mid-exercise to reflect real events (e.g.,
 *             the adversary compromises the SIEM → set status to "compromised").
 *             "ready" and "reduced" mean the asset is usable; others are not.
 *   - usesPerScenario: null means the asset is passive (always-on). A number
 *             means it has a limited-use ability (tracked by usesRemaining).
 *   - focusCostToActivate: some active abilities cost Focus to trigger.
 *   - bonus: the TN modifier this asset grants when used (+10 is typical).
 */
export class AssetData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      category: new fields.StringField({ required: true, initial: "hardware" }),
      sourceDomain: new fields.StringField({ required: false, blank: true, initial: "" }),
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      status: new fields.StringField({ required: true, initial: "ready" }),
      bonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      usesPerScenario: new fields.NumberField({ required: false, integer: true, nullable: true, initial: null }),
      usesRemaining: new fields.NumberField({ required: false, integer: true, nullable: true, initial: null }),
      focusCostToActivate: new fields.NumberField({ required: false, integer: true, nullable: true, initial: null })
    };
  }

  get isPassive() { return this.usesPerScenario === null; }
  get isAvailable() { return this.status === "ready" || this.status === "reduced"; }
}

/**
 * ClockData — schema for the "clock" item type.
 *
 * A Clock is a segmented progress tracker (4, 6, or 8 slices) used to
 * represent escalating threats or timed objectives. The GM fills segments
 * as the scenario progresses. When filled >= segments, the clock is full
 * and a narrative consequence triggers (described in the `consequence` field).
 *
 * Clocks are typically embedded items on an actor (individual, team, or
 * adversary), but can also exist as standalone items for global threats.
 */
export class ClockData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      segments: new fields.NumberField({ required: true, integer: true, initial: 6 }),
      filled: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      owner: new fields.StringField({ required: false, blank: true, nullable: true, initial: null }),
      consequence: new fields.StringField({ required: false, blank: true, initial: "" })
    };
  }

  get isFull() { return this.filled >= this.segments; }
  get progress() { return Math.round((this.filled / this.segments) * 100); }
}

/**
 * EffectData — schema for the "effect" item type.
 *
 * An Effect is a lasting narrative modifier on an actor — a persistent
 * condition that changes how that actor performs (positively or negatively).
 * Examples: "Obfuscation" (+15% to adversary stealth actions), "Network
 * Isolated" (-20% to all remote access actions), "Burned Out" (narrative only).
 *
 * modifier is a signed integer added to TN calculations (+10 helps, -10 hurts).
 * duration controls when the effect expires: permanent until removed by the GM,
 * for a fixed number of rounds, or until a specific narrative condition is met.
 */
export class EffectData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      source: new fields.StringField({ required: false, blank: true, initial: "" }),
      modifier: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      description: new fields.StringField({ required: false, blank: true, initial: "" }),
      duration: new fields.StringField({ required: true, initial: "permanent" }),
      durationRounds: new fields.NumberField({ required: false, integer: true, nullable: true, initial: null })
    };
  }
}
