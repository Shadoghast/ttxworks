export class NodeSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ttxworks", "sheet", "actor", "node"],
      template: "systems/ttxworks/templates/actor/node-sheet.hbs",
      width: 600,
      height: 520,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "status" }],
      scrollY: [".sheet-body"]
    });
  }

  getData() {
    const context = super.getData();
    context.system  = this.actor.system;
    context.effects = this.actor.items.filter(i => i.type === "effect");
    context.nodeStatuses = ["operational", "degraded", "compromised", "offline"];
    context.statusLabels = {
      operational: "Operational",
      degraded:    "Degraded",
      compromised: "Compromised",
      offline:     "Offline"
    };
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Quick status buttons
    html.find(".node-status-btn").on("click", async ev => {
      const status = ev.currentTarget.dataset.status;
      await this.actor.update({ "system.status": status });
    });

    html.find(".item-edit").on("click", ev => this._getItem(ev)?.sheet.render(true));
    html.find(".item-delete").on("click", ev => this._getItem(ev)?.delete());
    html.find(".item-create").on("click", async ev => {
      const type = ev.currentTarget.dataset.type ?? "effect";
      await Item.create({ name: `New ${type.capitalize()}`, type }, { parent: this.actor });
    });
  }

  _getItem(ev) {
    const li = ev.currentTarget.closest("[data-item-id]");
    return li ? this.actor.items.get(li.dataset.itemId) : null;
  }
}
