/**
 * PATCH /:id/game-state is the Custom Tracker widget's own write path
 * (patchPlayerStats("customTrackerFields", fields)), entirely separate from
 * the agent-apply path's resolveTrackerGroupUpdate covered by
 * tracker-blank-field-rejection.regression.ts. Before this fix, a blank or
 * nameless row sent here (a raw API call, an older client, or a future UI
 * bug — never the widget's own "+ Add Field", which always seeds a name)
 * would be persisted verbatim and crash the tracker HUD on the missing
 * `name` (#6549). This pins that the route sanitizes the same way.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-game-state-custom-tracker-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

let app: { close(): Promise<void>; inject(options: Record<string, unknown>): Promise<any> } | null = null;

try {
  const { buildApp } = await import("../../packages/server/src/app.js");
  app = await buildApp();
  await app.ready();

  const created = await app.inject({
    method: "POST",
    url: "/api/chats",
    payload: { name: "Custom tracker sanitization fixture", mode: "roleplay", characterIds: [] },
  });
  assert.equal(created.statusCode, 200);
  const chat = created.json();

  const patch = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/game-state`,
    payload: {
      manual: true,
      playerStats: {
        stats: [],
        attributes: null,
        skills: {},
        inventory: [],
        activeQuests: [],
        status: "",
        customTrackerFields: [{ name: "Reputation", value: "Trusted" }, {}, { name: "  " }, { value: "no name" }],
      },
    },
  });
  assert.equal(patch.statusCode, 200);

  const state = await app.inject({ method: "GET", url: `/api/chats/${chat.id}/game-state` });
  assert.equal(state.statusCode, 200);
  const customTrackerFields = state.json().playerStats.customTrackerFields;
  assert.deepEqual(
    customTrackerFields,
    [{ name: "Reputation", value: "Trusted" }],
    "PATCH /game-state drops blank/nameless customTrackerFields rows the same way the agent-apply path does",
  );
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Game-state custom tracker sanitization: blank/nameless rows dropped through the PATCH route.");
