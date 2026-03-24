/**
 * EventSheet — Actor sheet for the "event" actor type.
 *
 * An Event represents a discrete moment on the Timeline Map: something that
 * happened (or is happening) that the participants need to understand or
 * respond to. Examples: "Initial phishing email sent", "Ransomware detonates",
 * "Power restored to Building A".
 *
 * Events are purely informational — they have a date/time, a description, and
 * connection points to other Events and Actions, but they do not roll dice or
 * hold Focus/Stress. Those live on Individual and Team actors.
 *
 * This sheet is intentionally minimal. All the interesting UI logic lives in
 * the event-sheet.hbs template (tabs: Details, Connections, Description).
 */
export class EventSheet extends ActorSheet {

  /** @override — configure sheet dimensions, template path, and tab behaviour */
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

  /**
   * @override
   * Prepare template context data.
   *
   * We explicitly attach `context.system` so that the Handlebars template can
   * reference `{{system.dateTime}}`, `{{system.description}}`, etc. directly
   * rather than going through the longer `{{actor.system.*}}` path.
   *
   * No additional processing is needed for Events — they have no embedded
   * items, no pip trackers, and no computed display state beyond what the
   * data model already provides.
   */
  getData() {
    const context = super.getData();
    context.system = this.actor.system;
    return context;
  }
}
