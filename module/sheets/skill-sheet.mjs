export class SkillSheet extends ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ttxworks", "sheet", "item", "skill"],
      template: "systems/ttxworks/templates/item/skill-sheet.hbs",
      width: 480,
      height: 400
    });
  }

  getData() {
    const context = super.getData();
    context.system = this.item.system;
    context.skillCategories = [
      "Security Operations (SecOps)",
      "Threat Intelligence & Hunting",
      "Engineering & Architecture",
      "IT & Systems Administration",
      "Governance, Risk & Compliance (GRC)",
      "Leadership & Communication",
      "Emergency Management & Logistics",
      "Physical & Personnel Security"
    ];
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
  }
}
