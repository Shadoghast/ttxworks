/**
 * IndividualSheet — Actor sheet for the "individual" actor type.
 *
 * An Individual represents one participant in the exercise — a single
 * stakeholder or player persona (e.g., "CISO", "Incident Commander",
 * "Database Administrator"). Each Individual has their own:
 *
 *   - Focus pool (max 5) — a resource spent to boost rolls or resist
 *     consequences. Reaching 0 means they are "Focus Empty" and cannot
 *     spend Focus to improve dice rolls (though they can still spend it
 *     to resist consequences or activate Contingencies).
 *   - Stress track (max 6 = Burned Out) — each Stress point applies a
 *     -10% TN penalty to all Action Rolls. At 6 Stress they are Burned Out.
 *   - Skills and Assets — embedded items that modify roll outcomes.
 *   - Clocks and Effects — tracking timers and persistent modifiers.
 *
 * See TeamSheet for the nearly-identical group counterpart (Focus max 10).
 */
export class IndividualSheet extends ActorSheet {

  /** @override — configure sheet dimensions, template path, and tab behaviour */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ttxworks", "sheet", "actor", "individual"],
      template: "systems/ttxworks/templates/actor/individual-sheet.hbs",
      width: 740,
      height: 640,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }],
      scrollY: [".sheet-body"]
    });
  }

  /**
   * @override
   * Prepare template context data.
   *
   * Foundry's default getData() provides `actor`, `data`, `items`, etc.
   * We add several convenience properties so the template can read them
   * directly without complex helper calls:
   *
   *   - `system`        — shortcut to actor.system (the typed data model)
   *   - `skills/assets/clocks/effects` — items separated by type for
   *                       easier iteration in the template
   *   - `isBurnedOut`   — true when stress >= 6; drives CSS state on sheet
   *   - `isFocusEmpty`  — true when focus.value <= 0; drives CSS state
   *   - `stressPenalty` — current TN penalty in % (stress * 10); shown in
   *                       the roll dialog
   *   - `assetStatuses` — ordered list used to build status dropdowns
   */
  getData() {
    const context = super.getData();
    const actor = this.actor;
    context.system = actor.system;
    context.skills  = actor.items.filter(i => i.type === "skill");
    context.assets  = actor.items.filter(i => i.type === "asset");
    context.clocks  = actor.items.filter(i => i.type === "clock");
    context.effects = actor.items.filter(i => i.type === "effect");
    context.isBurnedOut = actor.system.isBurnedOut;
    context.isFocusEmpty = actor.system.isFocusEmpty;
    context.stressPenalty = actor.system.stressPenalty;

    // Asset status choices — order matters: clicking cycles forward through
    // this list (see _onCycleAssetStatus).
    context.assetStatuses = ["ready", "compromised", "reduced", "unavailable", "unknown"];
    return context;
  }

  /**
   * @override
   * Attach all DOM event listeners after the sheet HTML is rendered.
   *
   * We guard with `if (!this.isEditable) return` so that players who have
   * only Observer permission can view the sheet but cannot change anything.
   */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Action Roll — opens the full roll dialog (see TTXWorksActor.rollAction)
    html.find(".btn-roll-action").on("click", () => this.actor.rollAction());

    // Focus pips — clicking a filled pip decreases Focus; clicking an empty
    // pip increases it. See _onFocusPipClick for the toggle logic.
    html.find(".focus-pip").on("click", this._onFocusPipClick.bind(this));

    // Stress pips — same toggle mechanic as Focus pips.
    html.find(".stress-pip").on("click", this._onStressPipClick.bind(this));

    // Objective / Restriction list management
    html.find(".add-objective").on("click", this._onAddObjective.bind(this));
    html.find(".add-restriction").on("click", this._onAddRestriction.bind(this));
    html.find(".delete-objective").on("click", this._onDeleteObjective.bind(this));
    html.find(".delete-restriction").on("click", this._onDeleteRestriction.bind(this));

    // Embedded item controls (Skills, Assets, Clocks, Effects)
    html.find(".item-edit").on("click", ev => {
      const item = this._getItemFromEvent(ev);
      item?.sheet.render(true);
    });
    html.find(".item-delete").on("click", ev => {
      const item = this._getItemFromEvent(ev);
      item?.delete();
    });
    html.find(".item-create").on("click", this._onItemCreate.bind(this));

    // Asset status cycle — clicking the badge advances to the next status
    html.find(".asset-status-badge").on("click", this._onCycleAssetStatus.bind(this));

    // Clock advance / retreat buttons (fill or empty one segment)
    html.find(".clock-advance").on("click", this._onClockAdvance.bind(this));
    html.find(".clock-retreat").on("click", this._onClockRetreat.bind(this));
  }

  /**
   * Resolve an embedded item from a click event.
   *
   * Embedded items (Skills, Assets, etc.) are rendered inside a list element
   * that carries a `data-item-id` attribute. This helper walks up the DOM
   * from the clicked element to find that container and returns the matching
   * Item document.
   *
   * @param {Event} ev  The click event from any control inside an item row
   * @returns {Item|null}
   */
  _getItemFromEvent(ev) {
    const li = ev.currentTarget.closest("[data-item-id]");
    return li ? this.actor.items.get(li.dataset.itemId) : null;
  }

  /**
   * Handle a click on a Focus pip.
   *
   * The pip UI works as a "click to set" toggle:
   *   - Clicking a pip BELOW the current value sets Focus to that pip's index
   *     (i.e., decreases it).
   *   - Clicking the pip AT or ABOVE the current value sets Focus to that
   *     index + 1 (i.e., increases it by advancing past the clicked pip).
   *
   * Example: current Focus = 3
   *   Click pip[1] → idx=1 < 3 → newVal = 1  (decrease to 1)
   *   Click pip[3] → idx=3 >= 3 → newVal = 4  (increase to 4)
   *
   * The result is clamped to [0, focus.max] to prevent over/underflow.
   *
   * @param {Event} ev  Click event; the element must have `data-index`
   */
  async _onFocusPipClick(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const current = this.actor.system.focus.value;
    const newVal = (idx < current) ? idx : idx + 1;
    await this.actor.update({ "system.focus.value": Math.max(0, Math.min(this.actor.system.focus.max, newVal)) });
  }

  /**
   * Handle a click on a Stress pip.
   *
   * Uses the same toggle mechanic as Focus pips (see _onFocusPipClick).
   * Stress max is 6 per the rules; the data model stores this as stress.max.
   *
   * @param {Event} ev  Click event; the element must have `data-index`
   */
  async _onStressPipClick(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const current = this.actor.system.stress.value;
    const newVal = (idx < current) ? idx : idx + 1;
    await this.actor.update({ "system.stress.value": Math.max(0, Math.min(this.actor.system.stress.max ?? 6, newVal)) });
  }

  /** Append a placeholder "New Objective" entry to the objectives array. */
  async _onAddObjective() {
    const objectives = [...(this.actor.system.objectives ?? []), "New Objective"];
    await this.actor.update({ "system.objectives": objectives });
  }

  /** Append a placeholder "New Restriction" entry to the restrictions array. */
  async _onAddRestriction() {
    const restrictions = [...(this.actor.system.restrictions ?? []), "New Restriction"];
    await this.actor.update({ "system.restrictions": restrictions });
  }

  /**
   * Remove an objective by its position in the array.
   * @param {Event} ev  The element must carry `data-index`
   */
  async _onDeleteObjective(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const objectives = [...(this.actor.system.objectives ?? [])];
    objectives.splice(idx, 1);
    await this.actor.update({ "system.objectives": objectives });
  }

  /**
   * Remove a restriction by its position in the array.
   * @param {Event} ev  The element must carry `data-index`
   */
  async _onDeleteRestriction(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const restrictions = [...(this.actor.system.restrictions ?? [])];
    restrictions.splice(idx, 1);
    await this.actor.update({ "system.restrictions": restrictions });
  }

  /**
   * Create a new embedded item of the given type on this actor.
   *
   * The button that triggers this must carry `data-type` (e.g. "skill",
   * "asset", "clock"). Foundry's Item.create with a `parent` option
   * automatically embeds the item inside the actor document.
   *
   * @param {Event} ev  The element must carry `data-type`
   */
  async _onItemCreate(ev) {
    const type = ev.currentTarget.dataset.type ?? "skill";
    await Item.create({ name: `New ${type.capitalize()}`, type }, { parent: this.actor });
  }

  /**
   * Cycle an Asset's status forward through the status list on each click.
   *
   * Asset statuses in order: Ready → Compromised → Reduced → Unavailable →
   * Unknown → (back to Ready). The GM uses this during the exercise to
   * reflect real-time changes to tool availability (e.g., the adversary
   * disables the SIEM → set SIEM to Compromised).
   *
   * @param {Event} ev  Must be inside an element with `data-item-id`
   */
  async _onCycleAssetStatus(ev) {
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    const statuses = ["ready", "compromised", "reduced", "unavailable", "unknown"];
    const idx = statuses.indexOf(item.system.status);
    const next = statuses[(idx + 1) % statuses.length];
    await item.update({ "system.status": next });
  }

  /**
   * Advance a Clock by one segment (fill one slice of the pie).
   * When a Clock fills completely, a narrative consequence triggers.
   * @param {Event} ev  Must be inside an element with `data-item-id`
   */
  async _onClockAdvance(ev) {
    const item = this._getItemFromEvent(ev);
    await item?.advanceClock(1);
  }

  /**
   * Retreat a Clock by one segment (unfill one slice of the pie).
   * Used when a consequence is avoided or a roll partially undoes progress.
   * @param {Event} ev  Must be inside an element with `data-item-id`
   */
  async _onClockRetreat(ev) {
    const item = this._getItemFromEvent(ev);
    await item?.retreatClock(1);
  }

  /**
   * @override
   * Restrict which item types can be dropped onto this sheet.
   *
   * Foundry's default behaviour allows any item type to be dropped.
   * We limit it to the four types that make sense on a participant sheet.
   * Attempting to drop anything else (e.g., an actor) is silently ignored.
   */
  async _onDropItemCreate(itemData) {
    // Allow dropping skills/assets/clocks/effects onto actor
    if (!["skill", "asset", "clock", "effect"].includes(itemData.type)) return;
    return super._onDropItemCreate(itemData);
  }
}
