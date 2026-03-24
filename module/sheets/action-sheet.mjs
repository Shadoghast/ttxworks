/**
 * ActionSheet — Actor sheet for the "action" actor type.
 *
 * An Action represents a response decision made by a participant during the
 * exercise — e.g., "IR Team isolates compromised endpoint", "CISO briefs CEO".
 * It lives on the Timeline Map alongside Events, connected by arrows that show
 * the causal chain of the scenario.
 *
 * Key differences from an Event:
 *   - An Action has a Target Number (TN%) — the difficulty of the attempt.
 *   - An Action links to an Individual or Team actor via `system.actorRef`.
 *     That actor's skills, assets, and Focus pool are used when rolling dice.
 *   - An Action can be marked Resolved with an outcome (Critical Success →
 *     Critical Failure), which is then displayed on the timeline node.
 *
 * The GM typically creates Actions on behalf of participants or in response to
 * declared intentions during Phase 3 (Execution) of the exercise.
 */
export class ActionSheet extends ActorSheet {

  /** @override — configure sheet dimensions, template path, and tab behaviour */
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

  /**
   * @override
   * Prepare template context data.
   *
   * In addition to the standard actor data, we inject:
   *   - `actorOptions`  — list of all Individual/Team actors for the "linked
   *                       actor" dropdown. Adversary and Node actors are
   *                       excluded because they don't make Action Rolls.
   *   - `linkedActor`   — the resolved Actor object for the current actorRef,
   *                       so the template can display its name without a
   *                       lookup helper.
   *   - `outcomeChoices`— the ordered set of outcome values shown in the
   *                       outcome select dropdown once an Action is resolved.
   */
  getData() {
    const context = super.getData();
    context.system = this.actor.system;

    // Build actor options list for the actorRef dropdown (individuals + teams only)
    context.actorOptions = game.actors
      .filter(a => a.type === "individual" || a.type === "team")
      .map(a => ({ id: a.id, name: a.name, type: a.type }));

    // Resolve the linked actor object for display in the sheet header.
    // actorRef stores just the actor ID (a string), so we do the lookup here
    // rather than in the template. Falls back to null if the actor was deleted.
    context.linkedActor = this.actor.system.actorRef
      ? game.actors.get(this.actor.system.actorRef) ?? null
      : null;

    // Outcome choices shown in the dropdown. The empty string represents
    // "not yet resolved" and is the default value for new Actions.
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

  /** @override — wire up interactive controls after the HTML is rendered */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Clicking the linked actor's name chip opens their sheet directly,
    // so the GM can inspect their Skills, Assets, and Focus without closing
    // the Action sheet.
    html.find(".linked-actor-open").on("click", () => {
      const actor = game.actors.get(this.actor.system.actorRef);
      if (actor) actor.sheet.render(true);
    });

    // The Roll button opens the full Action Roll dialog on the *linked* actor,
    // not on the Action itself. This is intentional: dice, Focus, and Stress
    // all belong to the Individual or Team doing the work.
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
