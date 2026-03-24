export class EventSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ttxworks", "sheet", "actor", "event"],
      template: "systems/ttxworks/templates/actor/event-sheet.hbs",
      width: 560,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "details" }],
      scrollY: [".sheet-body"]
    });
  }

  getData() {
    const context = super.getData();
    context.system = this.actor.system;
    return context;
  }
}
