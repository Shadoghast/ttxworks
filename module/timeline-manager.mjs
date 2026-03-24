/**
 * TimelineManager — singleton for all Timeline connection CRUD.
 *
 * Connections are stored as flags on a dedicated GM-only Journal Entry.
 * Each connection shape: { id, sourceId, targetId, timeScale, duration, label, isParallel, waypoints }
 *
 * TimelineManager is the single write path. When a connection is added or removed
 * it also keeps each actor's system.predecessors / system.followers arrays in sync.
 */

export class TimelineManager {
  static JOURNAL_NAME = "TTXWorks Timeline";
  static FLAG_SCOPE   = "ttxworks";
  static FLAG_KEY     = "connections";

  // ── Journal helpers ──────────────────────────────────────────

  static get journal() {
    return game.journal.find(j => j.name === TimelineManager.JOURNAL_NAME) ?? null;
  }

  static async ensureJournal() {
    if (TimelineManager.journal) return TimelineManager.journal;
    console.log("TTXWorks | Creating Timeline Journal Entry...");
    return JournalEntry.create({
      name: TimelineManager.JOURNAL_NAME,
      ownership: { default: 0 }   // GM only
    });
  }

  // ── Connection read ──────────────────────────────────────────

  static getConnections() {
    const j = TimelineManager.journal;
    if (!j) return [];
    return j.getFlag(TimelineManager.FLAG_SCOPE, TimelineManager.FLAG_KEY) ?? [];
  }

  static getConnection(id) {
    return TimelineManager.getConnections().find(c => c.id === id) ?? null;
  }

  static getConnectionsFor(actorId) {
    return TimelineManager.getConnections().filter(
      c => c.sourceId === actorId || c.targetId === actorId
    );
  }

  // ── Connection write ─────────────────────────────────────────

  /**
   * Add a new connection between two nodes.
   * @param {{ sourceId, targetId, timeScale?, duration?, label?, isParallel?, waypoints? }} data
   * @returns {Promise<object>} The created connection record.
   */
  static async addConnection(data) {
    const j = await TimelineManager.ensureJournal();
    const connections = TimelineManager.getConnections();

    const conn = {
      id:         foundry.utils.randomID(),
      sourceId:   data.sourceId,
      targetId:   data.targetId,
      timeScale:  data.timeScale  ?? "hours",
      duration:   data.duration   ?? "",
      label:      data.label      ?? "",
      isParallel: data.isParallel ?? false,
      waypoints:  data.waypoints  ?? []
    };

    connections.push(conn);
    await j.setFlag(TimelineManager.FLAG_SCOPE, TimelineManager.FLAG_KEY, connections);
    await TimelineManager._syncActorArrays(conn.sourceId, conn.targetId, "add");

    Hooks.callAll("ttxworks.connectionsChanged", { action: "add", connection: conn });
    return conn;
  }

  /**
   * Update an existing connection by id.
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<object|null>}
   */
  static async updateConnection(id, updates) {
    const j = await TimelineManager.ensureJournal();
    const connections = TimelineManager.getConnections();
    const idx = connections.findIndex(c => c.id === id);
    if (idx === -1) {
      console.warn(`TTXWorks | updateConnection: no connection with id "${id}"`);
      return null;
    }

    connections[idx] = foundry.utils.mergeObject(connections[idx], updates);
    await j.setFlag(TimelineManager.FLAG_SCOPE, TimelineManager.FLAG_KEY, connections);

    Hooks.callAll("ttxworks.connectionsChanged", { action: "update", connection: connections[idx] });
    return connections[idx];
  }

  /**
   * Delete a connection by id.
   * @param {string} id
   */
  static async deleteConnection(id) {
    const j = await TimelineManager.ensureJournal();
    const connections = TimelineManager.getConnections();
    const conn = connections.find(c => c.id === id);
    if (!conn) return;

    const remaining = connections.filter(c => c.id !== id);
    await j.setFlag(TimelineManager.FLAG_SCOPE, TimelineManager.FLAG_KEY, remaining);
    await TimelineManager._syncActorArrays(conn.sourceId, conn.targetId, "remove");

    Hooks.callAll("ttxworks.connectionsChanged", { action: "delete", connection: conn });
  }

  /**
   * Delete all connections that reference a given actor id (called on actor delete).
   * @param {string} actorId
   */
  static async deleteConnectionsFor(actorId) {
    const orphans = TimelineManager.getConnectionsFor(actorId);
    for (const conn of orphans) {
      await TimelineManager.deleteConnection(conn.id);
    }
  }

  // ── Actor array sync ─────────────────────────────────────────

  /**
   * Keep system.predecessors / system.followers on both actors in sync
   * with the connection records. TimelineManager is the single write path.
   * @param {string} sourceId
   * @param {string} targetId
   * @param {"add"|"remove"} action
   */
  static async _syncActorArrays(sourceId, targetId, action) {
    const source = game.actors.get(sourceId);
    const target = game.actors.get(targetId);

    const sourceIsTimeline = source?.type === "event" || source?.type === "action";
    const targetIsTimeline = target?.type === "event" || target?.type === "action";
    if (!sourceIsTimeline || !targetIsTimeline) return;

    if (action === "add") {
      const followers = [...(source.system.followers ?? [])];
      if (!followers.includes(targetId)) {
        followers.push(targetId);
        await source.update({ "system.followers": followers });
      }
      const predecessors = [...(target.system.predecessors ?? [])];
      if (!predecessors.includes(sourceId)) {
        predecessors.push(sourceId);
        await target.update({ "system.predecessors": predecessors });
      }
    } else {
      const followers = (source.system.followers ?? []).filter(id => id !== targetId);
      await source.update({ "system.followers": followers });
      const predecessors = (target.system.predecessors ?? []).filter(id => id !== sourceId);
      await target.update({ "system.predecessors": predecessors });
    }
  }

  // ── Hook listeners ───────────────────────────────────────────

  /**
   * Register the deleteActor hook to clean up orphaned connections automatically.
   * Called once from ttxworks.mjs ready hook.
   */
  static registerHooks() {
    Hooks.on("deleteActor", actor => {
      if (actor.type !== "event" && actor.type !== "action") return;
      TimelineManager.deleteConnectionsFor(actor.id);
    });
  }
}
