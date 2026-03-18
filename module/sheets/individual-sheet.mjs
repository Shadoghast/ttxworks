export class IndividualSheet extends ActorSheet {

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

    // Asset status choices for dropdowns
    context.assetStatuses = ["ready", "compromised", "reduced", "unavailable", "unknown"];
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Action Roll
    html.find(".btn-roll-action").on("click", () => this.actor.rollAction());

    // Focus pips
    html.find(".focus-pip").on("click", this._onFocusPipClick.bind(this));

    // Stress pips
    html.find(".stress-pip").on("click", this._onStressPipClick.bind(this));

    // Add objective / restriction
    html.find(".add-objective").on("click", this._onAddObjective.bind(this));
    html.find(".add-restriction").on("click", this._onAddRestriction.bind(this));
    html.find(".delete-objective").on("click", this._onDeleteObjective.bind(this));
    html.find(".delete-restriction").on("click", this._onDeleteRestriction.bind(this));

    // Item controls
    html.find(".item-edit").on("click", ev => {
      const item = this._getItemFromEvent(ev);
      item?.sheet.render(true);
    });
    html.find(".item-delete").on("click", ev => {
      const item = this._getItemFromEvent(ev);
      item?.delete();
    });
    html.find(".item-create").on("click", this._onItemCreate.bind(this));

    // Asset status cycle
    html.find(".asset-status-badge").on("click", this._onCycleAssetStatus.bind(this));

    // Clock controls
    html.find(".clock-advance").on("click", this._onClockAdvance.bind(this));
    html.find(".clock-retreat").on("click", this._onClockRetreat.bind(this));
  }

  _getItemFromEvent(ev) {
    const li = ev.currentTarget.closest("[data-item-id]");
    return li ? this.actor.items.get(li.dataset.itemId) : null;
  }

  async _onFocusPipClick(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const current = this.actor.system.focus.value;
    const newVal = (idx < current) ? idx : idx + 1;
    await this.actor.update({ "system.focus.value": Math.max(0, Math.min(this.actor.system.focus.max, newVal)) });
  }

  async _onStressPipClick(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const current = this.actor.system.stress.value;
    const newVal = (idx < current) ? idx : idx + 1;
    await this.actor.update({ "system.stress.value": Math.max(0, Math.min(10, newVal)) });
  }

  async _onAddObjective() {
    const objectives = [...(this.actor.system.objectives ?? []), "New Objective"];
    await this.actor.update({ "system.objectives": objectives });
  }

  async _onAddRestriction() {
    const restrictions = [...(this.actor.system.restrictions ?? []), "New Restriction"];
    await this.actor.update({ "system.restrictions": restrictions });
  }

  async _onDeleteObjective(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const objectives = [...(this.actor.system.objectives ?? [])];
    objectives.splice(idx, 1);
    await this.actor.update({ "system.objectives": objectives });
  }

  async _onDeleteRestriction(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const restrictions = [...(this.actor.system.restrictions ?? [])];
    restrictions.splice(idx, 1);
    await this.actor.update({ "system.restrictions": restrictions });
  }

  async _onItemCreate(ev) {
    const type = ev.currentTarget.dataset.type ?? "skill";
    await Item.create({ name: `New ${type.capitalize()}`, type }, { parent: this.actor });
  }

  async _onCycleAssetStatus(ev) {
    const item = this._getItemFromEvent(ev);
    if (!item) return;
    const statuses = ["ready", "compromised", "reduced", "unavailable", "unknown"];
    const idx = statuses.indexOf(item.system.status);
    const next = statuses[(idx + 1) % statuses.length];
    await item.update({ "system.status": next });
  }

  async _onClockAdvance(ev) {
    const item = this._getItemFromEvent(ev);
    await item?.advanceClock(1);
  }

  async _onClockRetreat(ev) {
    const item = this._getItemFromEvent(ev);
    await item?.retreatClock(1);
  }

  async _onDropItemCreate(itemData) {
    // Allow dropping skills/assets/clocks/effects onto actor
    if (!["skill", "asset", "clock", "effect"].includes(itemData.type)) return;
    return super._onDropItemCreate(itemData);
  }
}
