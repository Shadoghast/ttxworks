/**
 * TTXWorks Data Models
 * TypeDataModel subclasses for all Actor and Item types.
 */

const { fields } = foundry.data;

// ============================================================
// ACTOR DATA MODELS
// ============================================================

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

export class AdversaryData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      threatProfile: new fields.StringField({ required: true, blank: true, initial: "" }),
      objectives: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      notes: new fields.HTMLField({ required: false, blank: true, initial: "" })
    };
  }
}

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

// ============================================================
// ITEM DATA MODELS
// ============================================================

export class SkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      category: new fields.StringField({ required: true, blank: true, initial: "" }),
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      bonus: new fields.NumberField({ required: true, integer: true, initial: 10 })
    };
  }
}

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
