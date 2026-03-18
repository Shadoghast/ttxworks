/**
 * TTXWorks Document Subclasses
 */

// ============================================================
// ACTOR
// ============================================================

export class TTXWorksActor extends Actor {

  /** Convenience getters */
  get focus() { return this.system.focus; }
  get stress() { return this.system.stress; }
  get isBurnedOut() { return this.system.isBurnedOut ?? false; }

  /**
   * Open the action roll dialog for this actor.
   * @param {object} [options]
   */
  async rollAction(options = {}) {
    const actor = this;
    const stressPenalty = actor.system.stressPenalty ?? 0;

    // Position tables
    const positions5 = [
      { key: "dominant",    label: "Dominant",    tn: 80 },
      { key: "advantaged",  label: "Advantaged",  tn: 65 },
      { key: "stable",      label: "Stable",      tn: 50 },
      { key: "contested",   label: "Contested",   tn: 35 },
      { key: "compromised", label: "Compromised", tn: 20 }
    ];

    const positionOptions = positions5
      .map(p => `<option value="${p.tn}">${p.label} (${p.tn}%)</option>`)
      .join("");

    const skillItems = actor.items.filter(i => i.type === "skill");
    const assetItems = actor.items.filter(i => i.type === "asset" && i.system.status === "ready");

    const skillOptions = skillItems.map(s =>
      `<option value="10">${s.name} (+${s.system.bonus}%)</option>`
    ).join("");

    const assetOptions = assetItems.map(a =>
      `<option value="${a.system.bonus}">${a.name} (+${a.system.bonus}%)</option>`
    ).join("");

    const content = `
      <form class="ttxworks-roll-dialog">
        <div class="form-group">
          <label>Action</label>
          <input type="text" name="actionLabel" placeholder="Describe your action..." style="width:100%"/>
        </div>
        <div class="form-group">
          <label>Position</label>
          <select name="position">${positionOptions}</select>
        </div>
        <hr/>
        <p class="hint">Positive Modifiers (max 2)</p>
        <div class="form-group">
          <label>Skill Bonus</label>
          <select name="skillBonus">
            <option value="0">None</option>
            ${skillOptions}
            <option value="10">Custom +10%</option>
            <option value="15">Custom +15%</option>
          </select>
        </div>
        <div class="form-group">
          <label>Asset Bonus</label>
          <select name="assetBonus">
            <option value="0">None</option>
            ${assetOptions}
            <option value="10">Custom +10%</option>
            <option value="15">Custom +15%</option>
          </select>
        </div>
        <div class="form-group">
          <label>Spend Focus</label>
          <select name="focusSpend">
            <option value="0">None</option>
            <option value="10">1 Focus (+10%)</option>
            <option value="20">2 Focus (+20%)</option>
          </select>
        </div>
        <hr/>
        <p class="hint">Negative Modifiers (max 2 — Stress always first)</p>
        <div class="form-group">
          <label>Stress Penalty</label>
          <span style="font-weight:bold;color:#c00">-${stressPenalty}% (${actor.system.stress?.value ?? 0} Stress)</span>
        </div>
        <div class="form-group">
          <label>Additional Penalty</label>
          <select name="extraPenalty">
            <option value="0">None</option>
            <option value="5">Effect (-5%)</option>
            <option value="10">Effect (-10%)</option>
            <option value="15">Obstacle (-15%)</option>
            <option value="20">Severe Obstacle (-20%)</option>
          </select>
        </div>
        <hr/>
        <div class="form-group">
          <label>Final TN</label>
          <span id="final-tn" style="font-size:1.4em;font-weight:bold;">—</span>
        </div>
      </form>
    `;

    return new Promise(resolve => {
      const dialog = new Dialog({
        title: `Action Roll — ${actor.name}`,
        content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d20"></i>',
            label: "Roll",
            callback: async (html) => {
              const form = html[0].querySelector("form");
              const actionLabel = form.actionLabel.value || "Action Roll";
              const baseTN     = parseInt(form.position.value);
              const skillBonus = parseInt(form.skillBonus.value);
              const assetBonus = parseInt(form.assetBonus.value);
              const focusSpend = parseInt(form.focusSpend.value);
              const extraPenalty = parseInt(form.extraPenalty.value);

              // Enforce Rule of Two: max 2 positive, max 2 negative
              const posCount = [skillBonus, assetBonus, focusSpend].filter(v => v > 0).length;
              const totalPos = Math.min(posCount, 2) === 2
                ? skillBonus + assetBonus + focusSpend
                : skillBonus + assetBonus + focusSpend;

              const totalNeg = stressPenalty + extraPenalty;
              const finalTN = Math.max(1, Math.min(95, baseTN + totalPos - totalNeg));

              // Deduct focus if spent
              if (focusSpend > 0) {
                const focusCost = focusSpend / 10;
                const newFocus = Math.max(0, actor.system.focus.value - focusCost);
                await actor.update({ "system.focus.value": newFocus });
              }

              // Roll d100
              const roll = new Roll("1d100");
              await roll.evaluate();

              const result = interpretRoll(roll.total, finalTN);

              // Apply stress consequences
              let stressGained = 0;
              if (result.outcome === "failure") stressGained = 1;
              if (result.outcome === "critical-failure") stressGained = 2;
              if (result.outcome === "complication") {
                const stressRoll = new Roll("1d100");
                await stressRoll.evaluate();
                if (stressRoll.total > 50) stressGained = 1;
              }
              if (stressGained > 0) {
                const newStress = Math.min(10, (actor.system.stress.value ?? 0) + stressGained);
                await actor.update({ "system.stress.value": newStress });
              }

              // Build chat message
              await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                flavor: actionLabel,
                content: buildRollChatContent({
                  actor, actionLabel, baseTN, totalPos, totalNeg, finalTN,
                  roll, result, stressGained, focusSpend
                }),
                rolls: [roll],
                type: CONST.CHAT_MESSAGE_TYPES?.ROLL ?? 5
              });

              resolve(result);
            }
          },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "roll",
        render: (html) => {
          // Live TN calculation
          const form = html[0].querySelector("form");
          const updateTN = () => {
            const base = parseInt(form.position.value);
            const pos  = parseInt(form.skillBonus.value) + parseInt(form.assetBonus.value) + parseInt(form.focusSpend.value);
            const neg  = stressPenalty + parseInt(form.extraPenalty.value);
            const tn   = Math.max(1, Math.min(95, base + pos - neg));
            html[0].querySelector("#final-tn").textContent = `${tn}%`;
          };
          form.querySelectorAll("select").forEach(el => el.addEventListener("change", updateTN));
          updateTN();
        }
      }, { width: 480 });
      dialog.render(true);
    });
  }
}

// ============================================================
// ITEM
// ============================================================

export class TTXWorksItem extends Item {
  get isAsset() { return this.type === "asset"; }
  get isClock() { return this.type === "clock"; }
  get isSkill() { return this.type === "skill"; }
  get isEffect() { return this.type === "effect"; }

  /** Advance a clock by N segments */
  async advanceClock(segments = 1) {
    if (!this.isClock) return;
    const newFilled = Math.min(this.system.segments, this.system.filled + segments);
    await this.update({ "system.filled": newFilled });
    if (newFilled >= this.system.segments) {
      ui.notifications.warn(`Clock "${this.name}" is FULL! Consequence: ${this.system.consequence || "GM determines."}`);
    }
  }

  /** Retreat a clock by N segments */
  async retreatClock(segments = 1) {
    if (!this.isClock) return;
    const newFilled = Math.max(0, this.system.filled - segments);
    await this.update({ "system.filled": newFilled });
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Interpret a d100 roll result into a degree of success.
 */
export function interpretRoll(roll, tn) {
  if (roll > 90) {
    return { outcome: "critical-failure", label: "Critical Failure", css: "critical-failure", icon: "💀" };
  } else if (roll > tn + 20) {
    return { outcome: "failure", label: "Failure", css: "failure", icon: "✗" };
  } else if (roll > tn) {
    return { outcome: "complication", label: "Complication", css: "complication", icon: "⚠" };
  } else if (roll <= Math.floor(tn / 2)) {
    return { outcome: "critical-success", label: "Critical Success", css: "critical-success", icon: "★" };
  } else {
    return { outcome: "success", label: "Full Success", css: "success", icon: "✓" };
  }
}

/**
 * Build HTML content for the roll chat message.
 */
function buildRollChatContent({ actor, actionLabel, baseTN, totalPos, totalNeg, finalTN, roll, result, stressGained, focusSpend }) {
  const focusNote = focusSpend > 0
    ? `<div class="roll-note">Focus spent: ${focusSpend / 10} (−${focusSpend / 10} Focus)</div>` : "";
  const stressNote = stressGained > 0
    ? `<div class="roll-note stress-note">+${stressGained} Stress gained</div>` : "";

  return `
    <div class="ttxworks chat-roll ${result.css}">
      <div class="roll-header">
        <span class="roll-actor">${actor.name}</span>
        <span class="roll-action">${actionLabel}</span>
      </div>
      <div class="roll-tn-breakdown">
        <span>Base TN: ${baseTN}%</span>
        ${totalPos ? `<span class="pos">+${totalPos}% bonuses</span>` : ""}
        ${totalNeg ? `<span class="neg">−${totalNeg}% penalties</span>` : ""}
        <span class="final">Final TN: <strong>${finalTN}%</strong></span>
      </div>
      <div class="roll-result-block">
        <span class="roll-die">${roll.total}</span>
        <span class="roll-outcome-icon">${result.icon}</span>
        <span class="roll-outcome-label">${result.label}</span>
      </div>
      ${focusNote}${stressNote}
    </div>
  `;
}
