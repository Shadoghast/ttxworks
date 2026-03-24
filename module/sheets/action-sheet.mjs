export class ActionSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ttxworks", "sheet", "actor", "action"],
      template: "systems/ttxworks/templates/actor/action-sheet.hbs",
      width: 580,
      height: 520,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "details" }],
      scrollY: [".sheet-body"]
    });
  }

  getData() {
    const context = super.getData();
    context.system = this.actor.system;

    // Build actor options list for the actorRef dropdown (individuals + teams only)
    context.actorOptions = game.actors
      .filter(a => a.type === "individual" || a.type === "team")
      .map(a => ({ id: a.id, name: a.name, type: a.type }));

    // Resolve linked actor for display
    context.linkedActor = this.actor.system.actorRef
      ? game.actors.get(this.actor.system.actorRef) ?? null
      : null;

    context.outcomeChoices = {
      "":                 "— Unresolved —",
      "critical-success": "Critical Success",
      "success":          "Full Success",
      "complication":     "Complication",
      "failure":          "Failure",
      "critical-failure": "Critical Failure"
    };

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Open linked actor's sheet
    html.find(".linked-actor-open").on("click", () => {
      const actor = game.actors.get(this.actor.system.actorRef);
      if (actor) actor.sheet.render(true);
    });

    // Roll using linked actor
    html.find(".action-roll-btn").on("click", () => {
      const actor = game.actors.get(this.actor.system.actorRef);
      if (!actor) {
        ui.notifications.warn("No linked actor set. Assign an Individual or Team first.");
        return;
      }
      actor.rollAction();
    });
  }
}
