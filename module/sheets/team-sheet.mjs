/**
 * TeamSheet — Actor sheet for the "team" actor type.
 *
 * A Team represents a functional group in the exercise — e.g., "SOC Team",
 * "Incident Response Team", "IT Department". One participant speaks for the
 * whole team. Key differences from an Individual:
 *
 *   - Focus pool starts at max 10 (vs. 5 for Individuals) because a team
 *     represents multiple people's combined capacity to prepare and respond.
 *   - Skills on a Team are typically aggregated from all member roles, so
 *     a team sheet may carry more skills than any one Individual.
 *   - Stress and Burned Out work identically (threshold: 6).
 *
 * This sheet is structurally identical to IndividualSheet. The differences
 * are cosmetic (label "Designation" instead of "Role") and in max Focus.
 * Both share the same pip-toggle logic for Focus and Stress.
 */
export class TeamSheet extends ActorSheet {

  /** @override — configure sheet dimensions, template path, and tab behaviour */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ttxworks", "sheet", "actor", "team"],
      template: "systems/ttxworks/templates/actor/team-sheet.hbs",
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
   * Identical to IndividualSheet.getData() — see that file for full notes.
   * Items are separated by type so the template can iterate them cleanly.
   * Computed states (isBurnedOut, isFocusEmpty, stressPenalty) and the
   * ordered assetStatuses list are also attached for template convenience.
   */
  getData() {
    const context = super.getData();
    context.system  = this.actor.system;
    context.skills  = this.actor.items.filter(i => i.type === "skill");
    context.assets  = this.actor.items.filter(i => i.type === "asset");
    context.clocks  = this.actor.items.filter(i => i.type === "clock");
    context.effects = this.actor.items.filter(i => i.type === "effect");
    context.isBurnedOut  = this.actor.system.isBurnedOut;
    context.isFocusEmpty = this.actor.system.isFocusEmpty;
    context.stressPenalty = this.actor.system.stressPenalty;

    // Ordered list used by the asset status badge click-to-cycle handler
    context.assetStatuses = ["ready", "compromised", "reduced", "unavailable", "unknown"];
    return context;
  }

  /**
   * @override
   * Attach all DOM event listeners after the sheet HTML is rendered.
   *
   * Listeners are registered only when the sheet is editable (i.e., the
   * current user has Owner or GM permission). Observer-level users can
   * view the sheet but not modify it.
   */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Action Roll — opens the full roll dialog for this team
    html.find(".btn-roll-action").on("click", () => this.actor.rollAction());

    // Focus / Stress pip toggles (click to set — see _onFocusPipClick)
    html.find(".focus-pip").on("click", this._onFocusPipClick.bind(this));
    html.find(".stress-pip").on("click", this._onStressPipClick.bind(this));

    // Objective list — add a blank placeholder, then the GM types over it
    html.find(".add-objective").on("click", async () => {
      const objectives = [...(this.actor.system.objectives ?? []), "New Objective"];
      await this.actor.update({ "system.objectives": objectives });
    });

    // Restriction list — same pattern as objectives
    html.find(".add-restriction").on("click", async () => {
      const restrictions = [...(this.actor.system.restrictions ?? []), "New Restriction"];
      await this.actor.update({ "system.restrictions": restrictions });
    });

    // Delete an objective by its array index (stored in data-index)
    html.find(".delete-objective").on("click", async ev => {
      const idx = parseInt(ev.currentTarget.dataset.index);
      const objectives = [...(this.actor.system.objectives ?? [])];
      objectives.splice(idx, 1);
      await this.actor.update({ "system.objectives": objectives });
    });

    // Delete a restriction by its array index
    html.find(".delete-restriction").on("click", async ev => {
      const idx = parseInt(ev.currentTarget.dataset.index);
      const restrictions = [...(this.actor.system.restrictions ?? [])];
      restrictions.splice(idx, 1);
      await this.actor.update({ "system.restrictions": restrictions });
    });

    // Embedded item controls — edit opens the item's own sheet; delete removes it
    html.find(".item-edit").on("click", ev => this._getItem(ev)?.sheet.render(true));
    html.find(".item-delete").on("click", ev => this._getItem(ev)?.delete());

    // Create a new embedded item of the type specified by data-type on the button
    html.find(".item-create").on("click", async ev => {
      const type = ev.currentTarget.dataset.type ?? "skill";
      await Item.create({ name: `New ${type.capitalize()}`, type }, { parent: this.actor });
    });

    // Asset status badge — click to cycle: Ready → Compromised → Reduced →
    // Unavailable → Unknown → Ready. Lets the GM reflect tool degradation
    // in real time during the exercise.
    html.find(".asset-status-badge").on("click", async ev => {
      const item = this._getItem(ev);
      if (!item) return;
      const statuses = ["ready", "compromised", "reduced", "unavailable", "unknown"];
      const next = statuses[(statuses.indexOf(item.system.status) + 1) % statuses.length];
      await item.update({ "system.status": next });
    });

    // Clock controls — fill or unfill one segment of a clock pie
    html.find(".clock-advance").on("click", ev => this._getItem(ev)?.advanceClock(1));
    html.find(".clock-retreat").on("click", ev => this._getItem(ev)?.retreatClock(1));
  }

  /**
   * Resolve an embedded item from a click event.
   *
   * Every item row in the template carries `data-item-id` on its container
   * element. This helper walks up the DOM to find that container and returns
   * the matching Item document from this actor's embedded collection.
   *
   * @param {Event} ev  Click event from any control inside an item row
   * @returns {Item|null}
   */
  _getItem(ev) {
    const li = ev.currentTarget.closest("[data-item-id]");
    return li ? this.actor.items.get(li.dataset.itemId) : null;
  }

  /**
   * Handle a click on a Focus pip.
   *
   * The pip UI is a "click to set" toggle:
   *   - Click a pip BELOW the current value → set Focus to that index (decrease)
   *   - Click a pip AT or ABOVE the current value → set Focus to index + 1 (increase)
   *
   * Result is clamped to [0, focus.max]. For teams, focus.max defaults to 10.
   *
   * @param {Event} ev  The element must carry `data-index`
   */
  async _onFocusPipClick(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const cur = this.actor.system.focus.value;
    await this.actor.update({ "system.focus.value": Math.max(0, Math.min(this.actor.system.focus.max, idx < cur ? idx : idx + 1)) });
  }

  /**
   * Handle a click on a Stress pip.
   *
   * Uses the same toggle mechanic as Focus pips (see _onFocusPipClick).
   * Stress max is 6 (Burned Out threshold) stored in stress.max.
   *
   * @param {Event} ev  The element must carry `data-index`
   */
  async _onStressPipClick(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const cur = this.actor.system.stress.value;
    await this.actor.update({ "system.stress.value": Math.max(0, Math.min(this.actor.system.stress.max ?? 6, idx < cur ? idx : idx + 1)) });
  }
}
