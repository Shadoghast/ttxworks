export class ClockSheet extends ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ttxworks", "sheet", "item", "clock"],
      template: "systems/ttxworks/templates/item/clock-sheet.hbs",
      width: 420,
      height: 380
    });
  }

  getData() {
    const context = super.getData();
    context.system = this.item.system;
    // Build segment array for display
    context.segmentArray = [];
    for (let i = 0; i < this.item.system.segments; i++) {
      context.segmentArray.push({ index: i, filled: i < this.item.system.filled });
    }
    context.segmentChoices = [4, 6, 8];
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".clock-segment").on("click", async ev => {
      const idx = parseInt(ev.currentTarget.dataset.index);
      const current = this.item.system.filled;
      // Click a filled segment to unfill it, click empty to fill up to it
      const newFilled = (idx < current) ? idx : idx + 1;
      await this.item.update({ "system.filled": Math.max(0, Math.min(this.item.system.segments, newFilled)) });
    });

    html.find(".clock-reset").on("click", () => this.item.update({ "system.filled": 0 }));
    html.find(".clock-fill-all").on("click", () => this.item.update({ "system.filled": this.item.system.segments }));
  }
}
