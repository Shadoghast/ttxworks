export class TeamSheet extends ActorSheet {

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
    context.assetStatuses = ["ready", "compromised", "reduced", "unavailable", "unknown"];
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".btn-roll-action").on("click", () => this.actor.rollAction());
    html.find(".focus-pip").on("click", this._onFocusPipClick.bind(this));
    html.find(".stress-pip").on("click", this._onStressPipClick.bind(this));
    html.find(".add-objective").on("click", async () => {
      const objectives = [...(this.actor.system.objectives ?? []), "New Objective"];
      await this.actor.update({ "system.objectives": objectives });
    });
    html.find(".add-restriction").on("click", async () => {
      const restrictions = [...(this.actor.system.restrictions ?? []), "New Restriction"];
      await this.actor.update({ "system.restrictions": restrictions });
    });
    html.find(".delete-objective").on("click", async ev => {
      const idx = parseInt(ev.currentTarget.dataset.index);
      const objectives = [...(this.actor.system.objectives ?? [])];
      objectives.splice(idx, 1);
      await this.actor.update({ "system.objectives": objectives });
    });
    html.find(".delete-restriction").on("click", async ev => {
      const idx = parseInt(ev.currentTarget.dataset.index);
      const restrictions = [...(this.actor.system.restrictions ?? [])];
      restrictions.splice(idx, 1);
      await this.actor.update({ "system.restrictions": restrictions });
    });
    html.find(".item-edit").on("click", ev => this._getItem(ev)?.sheet.render(true));
    html.find(".item-delete").on("click", ev => this._getItem(ev)?.delete());
    html.find(".item-create").on("click", async ev => {
      const type = ev.currentTarget.dataset.type ?? "skill";
      await Item.create({ name: `New ${type.capitalize()}`, type }, { parent: this.actor });
    });
    html.find(".asset-status-badge").on("click", async ev => {
      const item = this._getItem(ev);
      if (!item) return;
      const statuses = ["ready", "compromised", "reduced", "unavailable", "unknown"];
      const next = statuses[(statuses.indexOf(item.system.status) + 1) % statuses.length];
      await item.update({ "system.status": next });
    });
    html.find(".clock-advance").on("click", ev => this._getItem(ev)?.advanceClock(1));
    html.find(".clock-retreat").on("click", ev => this._getItem(ev)?.retreatClock(1));
  }

  _getItem(ev) {
    const li = ev.currentTarget.closest("[data-item-id]");
    return li ? this.actor.items.get(li.dataset.itemId) : null;
  }

  async _onFocusPipClick(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const cur = this.actor.system.focus.value;
    await this.actor.update({ "system.focus.value": Math.max(0, Math.min(this.actor.system.focus.max, idx < cur ? idx : idx + 1)) });
  }

  async _onStressPipClick(ev) {
    const idx = parseInt(ev.currentTarget.dataset.index);
    const cur = this.actor.system.stress.value;
    await this.actor.update({ "system.stress.value": Math.max(0, Math.min(10, idx < cur ? idx : idx + 1)) });
  }
}
