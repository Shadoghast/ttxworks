export class EffectSheet extends ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ttxworks", "sheet", "item", "effect"],
      template: "systems/ttxworks/templates/item/effect-sheet.hbs",
      width: 460,
      height: 380
    });
  }

  getData() {
    const context = super.getData();
    context.system = this.item.system;
    context.durationChoices = ["permanent", "rounds", "until-cleared"];
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
  }
}
