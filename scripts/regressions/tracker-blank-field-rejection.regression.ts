/**
 * A blank/nameless row (e.g. `{}`) can be emitted by a tracker agent when it
 * has nothing to report for a turn. Such a row has no display label and no
 * identity to match against locks or removals — the Roleplay HUD widget
 * crashes on `row.name.split(...)` once one reaches player state. It must be
 * dropped before it enters state, for every "name"-identified tracker group
 * (custom tracker fields, inventory currencies/equipped/inventory, world
 * custom fields) as well as the "characterId"-identified present-characters
 * group.
 */
import assert from "node:assert/strict";
import { resolveTrackerRowsUpdate } from "../../packages/shared/src/utils/tracker-updates.js";

// Legacy array payloads: blank rows are stripped, real rows survive.
const arrayResult = resolveTrackerRowsUpdate(
  [{ name: "Reputation", value: "Trusted" }, {}, { name: "  " }, { value: "orphaned, no name" }],
  [],
);
assert.deepEqual(
  arrayResult,
  [{ name: "Reputation", value: "Trusted" }],
  "blank/whitespace-only/nameless rows are dropped from array payloads",
);

// Explicit { updates, removed } payloads already ignored blank `updates`
// entries (they fail the pre-existing !name early-continue), but confirm
// that guard still holds alongside the new array-path filtering.
const explicitResult = resolveTrackerRowsUpdate(
  { updates: [{ name: "Gold", value: "50" }, {}, { value: "no name" }] },
  [],
);
assert.deepEqual(
  explicitResult,
  [{ name: "Gold", value: "50" }],
  "blank/nameless rows are ignored in explicit update payloads too",
);

// characterId-identified rows (present characters) accept a row identified
// solely by characterId even without a name, but still reject a fully blank row.
const characterArrayResult = resolveTrackerRowsUpdate(
  [{ characterId: "npc-1", name: "Aria" }, {}, { name: "   " }],
  [],
  "characterId",
);
assert.deepEqual(
  characterArrayResult,
  [{ characterId: "npc-1", name: "Aria" }],
  "characterId-identified rows still reject fully blank/nameless entries",
);

// A previously-persisted blank row (e.g. from data written before this fix)
// must not resurrect once passed through as `previous` state either.
const cleanupResult = resolveTrackerRowsUpdate([{ name: "Gold", value: "10" }], [{}, { name: "Gold", value: "5" }]);
assert.deepEqual(cleanupResult, [{ name: "Gold", value: "10" }], "a fresh array payload never reintroduces old blanks");

// A truthy non-string name (e.g. a number reaching this untyped JSON boundary) is kept
// and stringified rather than silently treated as blank and dropped.
const numericNameResult = resolveTrackerRowsUpdate([{ name: 123, value: "gold" }], []);
assert.deepEqual(
  numericNameResult,
  [{ name: "123", value: "gold" }],
  "a truthy non-string name is coerced to text, not treated as blank",
);

// Callers that will merge the result against locks afterward (resolveTrackerGroupUpdate)
// opt out of filtering here, since blank rows must survive until after position-based
// matching resolves — otherwise later rows shift left and can be paired with the wrong
// row. Records still get returned (and coerced), just not filtered.
const deferredResult = resolveTrackerRowsUpdate(
  [{ name: "Reputation", value: "Trusted" }, {}, { name: 7 }],
  [],
  "name",
  () => true,
  { deferIdentityFilter: true },
);
assert.deepEqual(
  deferredResult,
  [{ name: "Reputation", value: "Trusted" }, {}, { name: "7" }],
  "deferIdentityFilter keeps blank rows (and still coerces non-string names) instead of dropping them",
);

console.info("Tracker blank-field rejection: array and explicit-update payloads both drop nameless rows.");
