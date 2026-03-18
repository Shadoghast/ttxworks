export class AssetSheet extends ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ttxworks", "sheet", "item", "asset"],
      template: "systems/ttxworks/templates/item/asset-sheet.hbs",
      width: 520,
      height: 480
    });
  }

  getData() {
    const context = super.getData();
    context.system = this.item.system;
    context.assetCategories = ["hardware", "software", "service", "policy"];
    context.assetStatuses   = ["ready", "compromised", "reduced", "unavailable", "unknown"];
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
  }
}
