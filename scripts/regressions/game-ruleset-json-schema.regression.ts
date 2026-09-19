/**
 * The published JSON Schema for ruleset authors (`docs/extending/ruleset.schema.json`) is generated
 * from the shared zod schema. This pins that the committed file is current, so an editor never
 * flags a key the Engine accepts or misses one it refuses. Needs the shared package built, which
 * `pnpm regression:node` does first.
 *
 * It also pins that every shipped example is a file the schema describes: each one imports cleanly,
 * and the published schema carries a member for each resolution kind they are written in. A schema
 * that is current but has quietly lost a kind would put a red squiggle under a correct file, which
 * is exactly the help an author would learn to ignore.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RULESET_RESOLUTION_KINDS, parseRulesetDefinition } from "../../packages/shared/src/index.js";

const script = fileURLToPath(new URL("../generate-ruleset-schema.mjs", import.meta.url));
const result = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });
assert.equal(
  result.status,
  0,
  `${result.error ?? ""}${result.stdout ?? ""}${result.stderr ?? ""}\nRun: pnpm ruleset:schema`,
);

// ── Every shipped example is a file this schema describes ──
{
  const read = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"));

  for (const path of [
    "../../docs/development/ruleset-5e-2014.example.json",
    "../../docs/examples/rulesets/ember-roads.json",
    "../../docs/examples/rulesets/gravewatch.json",
  ]) {
    const parsed = parseRulesetDefinition(read(path));
    assert.ok(parsed.ok, `${path} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  }

  // One example per resolution kind, so neither is left without a file an author can copy.
  const kinds = ["../../docs/examples/rulesets/ember-roads.json", "../../docs/examples/rulesets/gravewatch.json"].map(
    (path) => read(path).resolution.kind,
  );
  assert.deepEqual(kinds, ["dice-sum", "dice-pool"]);

  // And the published schema offers a member for every kind the Engine knows, so an editor can
  // read a pool ruleset as well as it reads a summed one.
  const schema = read("../../docs/extending/ruleset.schema.json");
  const members = (schema.properties?.resolution?.anyOf ?? []) as Array<{ properties?: { kind?: { const?: string } } }>;
  assert.deepEqual(
    members.map((member) => member.properties?.kind?.const),
    [...RULESET_RESOLUTION_KINDS],
  );
}

console.info("game ruleset JSON Schema regression passed.");
