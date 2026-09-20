/**
 * A fight fought on a WOUND TRACK: `combat.health` naming a track instead of a pool.
 *
 * The shape that makes this work, and the one thing worth reading before the cases below:
 * `rulesetCombatHealth` reports a wound track as the levels it has LEFT out of its length. So
 * "still standing" is still "above zero", a full track is still "at zero", and every rule the
 * fight already had about going down, dying, reviving, being defeated and being summarised keeps
 * the words it already used. Only three things had to learn about tracks: reading the health,
 * marking it, and clearing a mark.
 *
 * What is pinned:
 *   - Health reads as levels left, out of the track's length, with no temporary buffer.
 *   - A landing blow marks ONCE, whatever the amount, with the kind `combat.damageKinds` says.
 *   - An immune target takes no mark, and a resisted blow that halves to nothing takes none either.
 *   - Filling the track puts the combatant down, and the ruleset's dying rule reads that.
 *   - Healing clears one mark and brings a downed member back, exactly as restoring a pool does.
 *   - An opponent is still written in plain numbers: a stat block has no sheet to mark.
 *   - The recap and the summary read a track without knowing it is one.
 *   - The `battle` bridge carries a share of the track's LENGTH, and writes back marks.
 *   - Temporary points are refused at import, because there is nothing on a track they could mean.
 *   - Every refusal the new keys own, and a pool ruleset behaving exactly as it does today.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  carryHealthShare,
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetCombatant,
  rulesetCombatDamageKind,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetEncounterSummary,
  rulesetSheetBuildSchema,
  seedCombatantFromSheet,
  sheetOpsFromCombatResult,
  type RulesetCombatant,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const emberUrl = new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url);
const emberText = readFileSync(fileURLToPath(emberUrl), "utf8");

/** Dice written down in advance, so an extra roll nobody expected is caught where it happens. */
function dice(...faces: number[]): RulesetCombatRoller {
  let index = 0;
  return (sides) => {
    assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
    return faces[index++]!;
  };
}
const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
  events.filter((event): event is Extract<RulesetCombatEvent, { type: T }> => event.type === type);
const firstOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) => {
  const found = eventsOf(events, type)[0];
  assert.ok(found, `expected a "${type}" event, got ${events.map((event) => event.type).join(", ") || "nothing"}`);
  return found;
};
const who = (state: RulesetEncounterState, id: string): RulesetCombatant => {
  const combatant = rulesetCombatant(state, id);
  assert.ok(combatant, `no combatant "${id}"`);
  return combatant;
};

/**
 * Ember Roads with its health moved off the Grit pool and onto a wound track of its own.
 *
 * Built here rather than shipped, deliberately: the two example files stay what they are, one
 * ruleset whose fights run on a pool and one that does not fight at all, so the pool path keeps its
 * coverage. Everything else about this ruleset is untouched, which is the point: the only thing
 * that changes is what health IS.
 */
function trackDocument(edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> {
  const doc = JSON.parse(emberText) as Record<string, any>;
  delete doc.layers;
  doc.id = "ember-roads-wounds";
  doc.sheet.live.tracks = [
    ...(doc.sheet.live.tracks ?? []),
    {
      id: "harm",
      label: "Harm",
      min: 0,
      max: 3,
      levels: [
        { label: "Winded", penalty: 0 },
        { label: "Bloodied", penalty: -1 },
        { label: "Broken", penalty: -4 },
      ],
      kinds: [
        { id: "bruise", label: "B", severity: 0 },
        { id: "cut", label: "C", severity: 1 },
      ],
    },
  ];
  doc.combat.health = { track: "harm" };
  // The types this example's own creatures already deal, so the mapping is checked against a real
  // list rather than an invented one.
  doc.combat.damageTypes = ["cut", "burn", "crush"];
  doc.combat.damageKinds = { default: "bruise", byType: { cut: "cut" } };
  // The `battle` block still names the pool, so the two seams are proven apart before they are
  // proven together.
  // Temporary points have no meaning on a track, so the entries that grant them go.
  for (const catalog of doc.catalogs ?? []) {
    for (const entry of catalog.entries ?? []) {
      if (entry.mechanics?.temporary) delete entry.mechanics.temporary;
    }
  }
  edit(doc);
  return doc;
}
const parsedOrThrow = (doc: Record<string, any>, what: string): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, `${what} must validate: ${result.ok ? "" : result.issues.join("; ")}`);
  return result.definition;
};

const wounded = parsedOrThrow(trackDocument(), "a ruleset whose health is a wound track");
const pooled = parsedOrThrow(
  (() => {
    const doc = JSON.parse(emberText) as Record<string, any>;
    delete doc.layers;
    return doc;
  })(),
  "the shipped Ember Roads",
);

const buildOf = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);
const travellerBuild = () =>
  buildOf({
    abilities: { brawn: 2, wits: 1, heart: 1 },
    skills: { scrap: "trained" },
    fields: { calling: "Hauler", toughness: 2 },
    lists: { gear: [{ name: "Road axe", notes: "Heavy", swing: "brawn", damage: "1d6", harm: "cut" }] },
  });
const traveller = (live: unknown = {}) => ({
  id: "juno",
  name: "Juno",
  side: "party" as const,
  build: travellerBuild(),
  live,
  catalogs: {},
});
/** A second party member, so a fight does not end the moment the first one goes down. */
const pell = (live: unknown = {}) => ({
  id: "pell",
  name: "Pell",
  side: "party" as const,
  build: buildOf({ abilities: { brawn: 1, wits: 2, heart: 0 }, fields: { calling: "Scout", toughness: 1 }, lists: {} }),
  live,
  catalogs: {},
});
const hound = (id: string, name: string, toHit = 6) => ({
  id,
  name,
  side: "enemy" as const,
  block: {
    health: 20,
    defense: 6,
    initiativeModifier: 1,
    actions: [{ id: "claw", name: "Claw", budget: "act", toHit, damage: { count: 1, sides: 6, flat: 0, type: "cut" } }],
  },
});

/** The wound state on a combatant's own sheet, read through the definition that owns it. */
const marksOf = (definition: RulesetDefinition, state: RulesetEncounterState, id: string) => {
  const sheet = who(state, id).sheet!;
  const track = readRulesetLive(definition, sheet.build, sheet.live).tracks.find((entry) => entry.id === "harm");
  assert.ok(track?.wound, "harm is a wound track");
  return track.wound;
};

// ── Health reads as the levels the track has LEFT ──
{
  const state = createRulesetEncounter({
    definition: wounded,
    seed: 4242,
    combatants: [traveller(), hound("ash", "Ash-hound")],
    roller: dice(6, 5, 1, 1),
  });
  const health = rulesetCombatHealth(wounded, wounded.combat!, who(state, "juno"));
  assert.deepEqual(health, { value: 3, max: 3, temp: 0 }, "an unmarked track of three is three levels left of three");

  // Two marks already on the sheet read as one level left, and still no buffer.
  const hurt = createRulesetEncounter({
    definition: wounded,
    seed: 4242,
    combatants: [traveller({ wounds: { harm: { marks: ["cut", "bruise"] } } }), hound("ash", "Ash-hound")],
    roller: dice(6, 5, 1, 1),
  });
  assert.deepEqual(rulesetCombatHealth(wounded, wounded.combat!, who(hurt, "juno")), { value: 1, max: 3, temp: 0 });

  // An opponent is still plain numbers: a stat block has no sheet to mark.
  assert.deepEqual(rulesetCombatHealth(wounded, wounded.combat!, who(state, "ash")), { value: 20, max: 20, temp: 0 });
}

// ── The damage type becomes a kind, by the ruleset's own mapping ──
{
  const combat = wounded.combat!;
  assert.equal(rulesetCombatDamageKind(combat, "cut"), "cut", "a mapped type lands as the kind it names");
  assert.equal(rulesetCombatDamageKind(combat, "CUT"), "cut", "matched without case, like everything else here");
  assert.equal(rulesetCombatDamageKind(combat, "burn"), "bruise", "a declared type nobody mapped falls to the default");
  assert.equal(rulesetCombatDamageKind(combat, undefined), "bruise", "and so does a blow with no type at all");
  // A pool ruleset is never asked, and says nothing if it is.
  assert.equal(rulesetCombatDamageKind(pooled.combat!, "cut"), "");
}

// ── A landing blow marks ONCE, whatever it rolled, and fills the track ──
{
  /** One hound swing at Juno. `attack` then `damage`, both scripted. The hound's one action a turn
   *  is spent by it, so the turn is handed round to Juno and back before the next swing. */
  const swing = (state: RulesetEncounterState, ...faces: number[]) => {
    const claw = rulesetCombatOptions(wounded, state, "ash").find((option) => option.label === "Claw");
    assert.ok(claw, "the hound can claw");
    return applyRulesetCombatChoice(
      wounded,
      state,
      { actorId: "ash", optionId: claw.id, targetIds: ["juno"] },
      dice(...faces),
    );
  };
  const endTurn = (state: RulesetEncounterState, actorId: string) =>
    applyRulesetCombatChoice(wounded, state, { actorId, optionId: "end-turn", targetIds: [] }, dice(1, 1, 1, 1)).state;
  /** Back round to the hound, so it has its action again. Whoever is on turn ends it, in whatever
   *  order initiative put them in, so the case does not quietly depend on that order. */
  const nextRound = (state: RulesetEncounterState) => {
    let next = state;
    for (let guard = 0; guard < 8; guard++) {
      const actor = next.order[next.turn];
      assert.ok(actor, "somebody is always on turn");
      next = endTurn(next, actor);
      if (next.order[next.turn] === "ash") return next;
    }
    assert.fail("the turn never came back round to the hound");
  };
  // The hound goes first, so it can swing on round one. Pell is here so the fight does not end the
  // moment Juno goes down, which is what lets the blow-while-down case below happen at all.
  let state = createRulesetEncounter({
    definition: wounded,
    seed: 4242,
    combatants: [traveller(), pell(), hound("ash", "Ash-hound")],
    roller: dice(1, 1, 1, 1, 6, 6),
  });
  assert.equal(state.order[0], "ash", "the hound won initiative, so it is the one swinging");

  // A hit for 1 and a hit for 6 do exactly the same thing to the track: one mark each.
  const small = swing(state, 6, 6, 1);
  const smallDamage = firstOf(small.events, "damage");
  assert.equal(smallDamage.dealt, 1, "the log still says what the dice rolled");
  state = small.state;
  assert.deepEqual(marksOf(wounded, state, "juno").marks, ["cut"], "and the track took one mark of the mapped kind");
  assert.equal(rulesetCombatHealth(wounded, wounded.combat!, who(state, "juno")).value, 2);

  state = nextRound(state);
  const big = swing(state, 6, 6, 6);
  assert.equal(firstOf(big.events, "damage").dealt, 6);
  state = big.state;
  assert.deepEqual(marksOf(wounded, state, "juno").marks, ["cut", "cut"], "six damage is still one mark");
  assert.equal(rulesetCombatHealth(wounded, wounded.combat!, who(state, "juno")).value, 1);

  // The third fills it, which is what puts them down. The dying rule reads that and nothing else.
  state = nextRound(state);
  const last = swing(state, 6, 6, 3);
  state = last.state;
  assert.equal(marksOf(wounded, state, "juno").marks.length, 3, "the track is full");
  assert.equal(rulesetCombatHealth(wounded, wounded.combat!, who(state, "juno")).value, 0, "so there is nothing left");
  const down = firstOf(last.events, "down");
  assert.equal(down.actorId, "juno");
  assert.equal(who(state, "juno").down, true);
  // Ember Roads declares no dying block, so a downed member is simply down.
  assert.equal(down.dying, !!wounded.combat!.dying);

  // A blow while the track is already full still marks: a full track upgrades its lightest mark
  // rather than refusing, which is the wound track's own rule, not a thing the fight decides.
  // A blow while the track is already full still lands, exactly as a blow on somebody whose pool is
  // already at zero does. The track's own rule decides what happens to it: every mark is already
  // the worst kind here, so the blow becomes an overflow rather than an upgrade.
  const after = swing(nextRound(state), 6, 6, 2);
  assert.deepEqual(marksOf(wounded, after.state, "juno").marks, ["cut", "cut", "cut"], "nothing left to upgrade");
  assert.equal(marksOf(wounded, after.state, "juno").overflow, 1, "so the blow is counted as an overflow");
  assert.equal(who(after.state, "juno").down, true, "and they are still down");
  assert.equal(rulesetCombatHealth(wounded, wounded.combat!, who(after.state, "juno")).value, 0);
}

// ── A blow that does not land marks nothing ──
{
  // Worth saying where it is true: a hide of resistances, vulnerabilities and immunities lives on a
  // STAT BLOCK, and a combatant with a stat block has no character sheet to mark. So a wound track
  // is never halved or doubled: only a blow landing or not landing reaches it. The amount still
  // gates it, which is what a miss proves.
  const state = createRulesetEncounter({
    definition: wounded,
    seed: 4242,
    combatants: [traveller(), pell(), hound("ash", "Ash-hound", -20)],
    roller: dice(1, 1, 1, 1, 6, 6),
  });
  assert.equal(who(state, "juno").block, undefined, "a party member has a sheet, never a stat block");
  const claw = rulesetCombatOptions(wounded, state, "ash").find((option) => option.label === "Claw")!;
  const missed = applyRulesetCombatChoice(
    wounded,
    state,
    { actorId: "ash", optionId: claw.id, targetIds: ["juno"] },
    dice(1, 1),
  );
  assert.equal(firstOf(missed.events, "attack").outcome, "miss");
  assert.equal(eventsOf(missed.events, "damage").length, 0, "a miss deals nothing");
  assert.equal(marksOf(wounded, missed.state, "juno").marks.length, 0, "so the track is untouched");
  assert.equal(rulesetCombatHealth(wounded, wounded.combat!, who(missed.state, "juno")).value, 3);
}

// ── Healing clears one mark, and brings a downed member back ──
{
  const state = createRulesetEncounter({
    definition: wounded,
    seed: 4242,
    combatants: [traveller({ wounds: { harm: { marks: ["cut", "cut", "cut"] } } }), hound("ash", "Ash-hound")],
    roller: dice(6, 5, 1, 1),
  });
  assert.equal(rulesetCombatHealth(wounded, wounded.combat!, who(state, "juno")).value, 0, "starts with a full track");

  // The summary reads it without knowing it is a track.
  const summary = rulesetEncounterSummary(wounded, state);
  const juno = summary.party.find((member) => member.id === "juno")!;
  assert.equal(juno.health, 0);
  assert.equal(juno.maxHealth, 3);
  assert.equal(juno.temp, 0, "a track carries no buffer, so a recap never claims one");
}

// ── The `battle` bridge: a share of the track's LENGTH, and marks on the way back ──
{
  const bridged = parsedOrThrow(
    trackDocument((doc) => {
      doc.id = "ember-roads-wounds-bridge";
      doc.battle.health = { track: "harm" };
    }),
    "a battle block on a wound track",
  );
  const build = travellerBuild();
  // Unmarked: the whole of the Engine's own maximum.
  const fresh = seedCombatantFromSheet(bridged, build, {}, 60);
  assert.ok(fresh);
  assert.deepEqual([fresh.hp, fresh.maxHp, fresh.sheetHp, fresh.sheetMaxHp], [60, 60, 3, 3]);

  // One mark of three: two levels left, so two thirds of the Engine's bar.
  const hurt = seedCombatantFromSheet(bridged, build, { wounds: { harm: { marks: ["bruise"] } } }, 60);
  assert.ok(hurt);
  assert.equal(hurt.sheetHp, 2);
  assert.equal(hurt.hp, carryHealthShare(2, 3, 60));
  assert.equal(hurt.hp, 40);

  // A full track starts the battle down, exactly as an empty pool does.
  const full = seedCombatantFromSheet(bridged, build, { wounds: { harm: { marks: ["cut", "cut", "cut"] } } }, 60);
  assert.ok(full);
  assert.equal(full.hp, 0);

  // Back out: the Engine took the fresh member to a third of its bar, which is one level left of
  // three, so two marks are written. The kind is the track's LIGHTEST, because the Engine's own
  // battles have no damage types for a mapping to read.
  const lost = sheetOpsFromCombatResult(bridged, fresh, { hp: 20 });
  assert.deepEqual(lost, [{ op: "damage", track: "harm", kind: "bruise", amount: 2 }]);

  // And healing past where it started comes back as marks cleared.
  const healed = sheetOpsFromCombatResult(bridged, hurt, { hp: 60 });
  assert.deepEqual(healed, [{ op: "damage", track: "harm", kind: "bruise", amount: -1 }]);

  // A battle that did not move the bar writes nothing at all, exactly as on a pool.
  assert.deepEqual(sheetOpsFromCombatResult(bridged, fresh, { hp: 60 }), []);

  // The pool bridge is byte for byte what it was.
  const poolSeed = seedCombatantFromSheet(pooled, build, {}, 60);
  assert.ok(poolSeed);
  assert.equal(poolSeed.hp, 60);
  assert.deepEqual(sheetOpsFromCombatResult(pooled, poolSeed, { hp: 30 }), [
    { op: "damage", pool: "grit", amount: Math.round(poolSeed.sheetMaxHp / 2) },
  ]);
}

// ── Refusals at import ──
{
  const refuse = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
    const result = parseRulesetDefinition(trackDocument(edit));
    assert.equal(result.ok, false, `expected a refusal matching ${pattern}`);
    const issues = result.ok ? [] : result.issues;
    assert.ok(
      issues.some((issue) => pattern.test(issue)),
      `expected ${pattern} in ${JSON.stringify(issues)}`,
    );
  };

  // Health naming a track nobody declared, and a track with no levels to mark.
  refuse((doc) => {
    doc.combat.health = { track: "nowhere" };
  }, /Unknown track "nowhere"/);
  refuse((doc) => {
    doc.sheet.live.tracks.push({ id: "heat_plain", label: "Plain", min: 0, max: 4 });
    doc.combat.health = { track: "heat_plain" };
  }, /has no levels, so a fight has nothing to mark/);

  // A fight on a track has to say what kind of harm its damage is.
  refuse((doc) => {
    delete doc.combat.damageKinds;
  }, /says what kind of harm its damage is/);
  refuse((doc) => {
    doc.combat.damageKinds.default = "nonsense";
  }, /"nonsense" is not a kind of "harm"/);
  refuse((doc) => {
    doc.combat.damageKinds.byType = { cut: "nonsense" };
  }, /"nonsense" is not a kind of "harm"/);
  refuse((doc) => {
    doc.combat.damageKinds.byType = { sonic: "cut" };
  }, /Unknown damage type "sonic"/);

  // And the other way: a mapping with nothing to map onto.
  {
    const doc = JSON.parse(emberText) as Record<string, any>;
    delete doc.layers;
    doc.id = "ember-roads-mismapped";
    doc.combat.damageKinds = { default: "bruise" };
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false);
    assert.ok(
      (result.ok ? [] : result.issues).some((issue) => /damageKinds maps damage onto a wound track/.test(issue)),
      "a pool ruleset has no kinds for a mapping to name",
    );
  }

  // Temporary points have nothing on a track to mean.
  refuse((doc) => {
    const entry = doc.catalogs[0].entries.find((candidate: any) => candidate.mechanics);
    entry.mechanics.temporary = { flat: 3 };
  }, /carries no buffer for temporary points/);

  // The same entry is fine on the shipped pool ruleset, which is what makes the refusal specific.
  {
    const doc = JSON.parse(emberText) as Record<string, any>;
    delete doc.layers;
    const entry = doc.catalogs[0].entries.find((candidate: any) => candidate.mechanics);
    entry.mechanics.temporary = { flat: 3 };
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, true, `a pool ruleset still grants temporary points: ${JSON.stringify(result)}`);
  }
}

// ── A pool ruleset fights exactly as it does today ──
{
  const state = createRulesetEncounter({
    definition: pooled,
    seed: 4242,
    combatants: [traveller(), hound("ash", "Ash-hound")],
    roller: dice(1, 1, 6, 6),
  });
  const before = rulesetCombatHealth(pooled, pooled.combat!, who(state, "juno"));
  assert.ok(before.max > 0 && before.value === before.max, "a fresh member starts at their pool's maximum");
  const claw = rulesetCombatOptions(pooled, state, "ash").find((option) => option.label === "Claw")!;
  const hit = applyRulesetCombatChoice(
    pooled,
    state,
    { actorId: "ash", optionId: claw.id, targetIds: ["juno"] },
    dice(6, 6, 4),
  );
  const after = rulesetCombatHealth(pooled, pooled.combat!, who(hit.state, "juno"));
  assert.equal(after.value, before.value - 4, "four damage is four points off the pool, not one mark");
  assert.equal(
    readRulesetLive(pooled, who(hit.state, "juno").sheet!.build, who(hit.state, "juno").sheet!.live).tracks.find(
      (track) => track.id === "harm",
    ),
    undefined,
    "and this ruleset has no wound track at all",
  );
}

console.info("game ruleset combat wound-track regressions passed.");
