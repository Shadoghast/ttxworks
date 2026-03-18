export class AdversarySheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ttxworks", "sheet", "actor", "adversary"],
      template: "systems/ttxworks/templates/actor/adversary-sheet.hbs",
      width: 680,
      height: 580,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "objectives" }],
      scrollY: [".sheet-body"]
    });
  }

  getData() {
    const context = super.getData();
    context.system  = this.actor.system;
    context.clocks  = this.actor.items.filter(i => i.type === "clock");
    context.effects = this.actor.items.filter(i => i.type === "effect");
    // Adversary sheet is GM-only; player-visible data is deliberately minimal
    context.isGM = game.user.isGM;
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".item-edit").on("click", ev => this._getItem(ev)?.sheet.render(true));
    html.find(".item-delete").on("click", ev => this._getItem(ev)?.delete());
    html.find(".item-create").on("click", async ev => {
      const type = ev.currentTarget.dataset.type ?? "clock";
      await Item.create({ name: `New ${type.capitalize()}`, type }, { parent: this.actor });
    });
    html.find(".clock-advance").on("click", ev => this._getItem(ev)?.advanceClock(1));
    html.find(".clock-retreat").on("click", ev => this._getItem(ev)?.retreatClock(1));
  }

  _getItem(ev) {
    const li = ev.currentTarget.closest("[data-item-id]");
    return li ? this.actor.items.get(li.dataset.itemId) : null;
  }
}
