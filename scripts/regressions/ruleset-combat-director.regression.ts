/**
 * Ruleset combat, slice C3a: the director's third style, driven with no database and no network.
 *
 * What is pinned here:
 *   - ONE ledger. The ruleset fight is a style of the existing director session, and the Engine's
 *     own `party` and `enemies` arrays are kept in step with it after every step, because the
 *     recap, the journal and the client's end-of-battle path read them.
 *   - The server decides what everybody's numbers are. A party member's come off their own sheet,
 *     and one without a sheet is refused by name rather than given Engine numbers. An opponent's
 *     come off a bestiary, off a clamped proposal or off the ruleset's own threat scale, in that
 *     order, and every adjustment is said out loud.
 *   - A refusal changes nothing at all and carries the resolver's own reason in a stable code.
 *   - `continue` resolves exactly one turn of whoever the player is not playing, and stops.
 *   - The picker never spends the same budget twice, never stalls and always ends the turn.
 *   - The view is a PROJECTION: no sheet build, no live blob, no catalogs, no seed.
 *   - The state is plain JSON: a fight carried through a round trip mid-battle continues on the
 *     same dice.
 *   - Nothing is shaped around one game system: every case is proven on the 5e draft AND on Ember
 *     Roads, which rolls two six-sided dice, has one thing to do a turn and no saving throws.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatRoller,
  rulesetSheetBuildSchema,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";
import {
  createCombatDirector,
  type CombatDirectorState,
} from "../../packages/server/src/services/game/combat-director.service.js";
import {
  commandRulesetCombatDirector,
  createRulesetFight,
  directedRulesetView,
  rulesetDirectorStage,
  rulesetFightLiveStates,
  syncRulesetCombatants,
  type RulesetFightOpponent,
} from "../../packages/server/src/services/game/ruleset-combat-director.service.js";
import type { Combatant } from "../../packages/shared/src/types/game.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const variant = (text: string, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  return doc;
};
const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
};
const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");
const emberText = read("../../docs/examples/rulesets/ember-roads.json");
const fiveE = parsedOrThrow(variant(fiveEText), "the 5e example");
const ember = parsedOrThrow(variant(emberText), "the 2d6 example");
const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);
const card = (name: string, sheet: RulesetSheetBuild | null) => ({
  name,
  ...(sheet ? { rulesetSheet: { v: 1, build: sheet } } : {}),
});

// ── The party, on both rulesets ──

const spellEntries = [
  {
    id: "fire-bolt",
    label: "Fire Bolt",
    rows: [{ list: "spells", values: { name: "Fire Bolt", level: 0, prepared: false } }],
    mechanics: { kind: "attack", attackRoll: true, amount: { dice: "1d10" }, damageType: "fire" },
  },
  {
    id: "mending-light",
    label: "Mending Light",
    rows: [{ list: "spells", values: { name: "Mending Light", level: 1, prepared: true } }],
    mechanics: {
      kind: "heal",
      targets: "ally",
      amount: { dice: "1d8", flat: 4 },
      cost: [{ pool: "slots_1", amount: 1 }],
    },
  },
] as unknown as RulesetCatalogEntry[];
const spellRows = spellEntries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row));
const spellCatalogs: RulesetCatalogEntriesById = { spells: spellEntries };

const fighterBuild = () =>
  build({
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    saves: { str_save: "proficient", con_save: "proficient" },
    fields: { level: 7, ac: 18, speed: 30, hp_max: 60 },
    lists: {
      attacks: [
        { name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8", damage_type: "slashing" },
      ],
    },
  });
const wizardBuild = () =>
  build({
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    saves: { int_save: "proficient", wis_save: "proficient" },
    fields: { level: 7, ac: 12, speed: 30, hp_max: 38, spellcasting_ability: "int", slots_max_1: 4 },
    lists: { spells: spellRows },
  });
const fiveECards = [card("Brenna", fighterBuild()), card("Corwin", wizardBuild()), card("Tam", null)];

const emberKnacks = ember.catalogs!.find((catalog) => catalog.id === "knacks")!.entries!;
const emberRowsFor = (list: string, ids: string[]) =>
  ids.flatMap((id) =>
    rowsFromCatalogEntry("knacks", emberKnacks.find((entry) => entry.id === id)!)
      .filter((row) => row.list === list)
      .map((row) => row.row),
  );
const emberPicked = ["road-sense", "last-ember", "coldfire-toss", "hold-the-line"];
const travellerBuild = () =>
  build({
    abilities: { brawn: 2, wits: 1, heart: 1 },
    skills: { scrap: "trained" },
    fields: { calling: "Hauler", toughness: 2 },
    lists: {
      gear: [{ name: "Road axe", notes: "Heavy, and it knows it", swing: "brawn", damage: "1d6", harm: "cut" }],
      knacks: emberRowsFor("knacks", emberPicked),
      tricks: emberRowsFor("tricks", emberPicked),
    },
  });
const pellBuild = () =>
  build({ abilities: { brawn: 1, wits: 2, heart: 0 }, fields: { calling: "Scout", toughness: 1 }, lists: {} });
const emberCards = [card("Juno", travellerBuild()), card("Pell", pellBuild()), card("Wick", null)];
const emberCatalogs: RulesetCatalogEntriesById = { knacks: emberKnacks };

/** Every bestiary of a ruleset, exactly as the route loads them. */
const bestiaryOf = (definition: RulesetDefinition): RulesetCatalogEntriesById =>
  Object.fromEntries(
    (definition.catalogs ?? [])
      .filter((catalog) => catalog.holds === "creatures")
      .map((catalog) => [catalog.id, catalog.entries ?? []]),
  );

// ── Starting a fight the way the route does ──

const engineUnit = (id: string, name: string, side: Combatant["side"]): Combatant => ({
  id,
  name,
  side,
  hp: 30,
  maxHp: 30,
  attack: 8,
  defense: 6,
  speed: 6,
  level: 3,
  skills: [],
});

interface StartInput {
  definition: RulesetDefinition;
  cards: unknown;
  partyCatalogs: RulesetCatalogEntriesById;
  party: Array<{ id: string; name: string }>;
  enemies: RulesetFightOpponent[];
  seed?: number;
  gm?: boolean;
  live?: Record<string, unknown> | null;
}
type Started = { ok: true; state: CombatDirectorState } | { ok: false; error: string };

function start(input: StartInput): Started {
  const built = createRulesetFight({
    definition: input.definition,
    seed: input.seed ?? 7,
    party: input.party,
    enemies: input.enemies,
    cards: input.cards,
    playerName: null,
    live: (input.live ?? null) as never,
    partyCatalogs: input.partyCatalogs,
    bestiary: bestiaryOf(input.definition),
  });
  if (!built.ok) return built;
  const state = createCombatDirector({
    id: "fight",
    anchor: "anchor",
    style: "ruleset",
    party: input.party.map((member) => engineUnit(member.id, member.name, "player")),
    enemies: input.enemies.map((enemy) => engineUnit(enemy.id, enemy.name, "enemy")),
    gm: input.gm ?? false,
    difficulty: "normal",
    seed: input.seed ?? 7,
  });
  state.rulesetFight = built.fight;
  syncRulesetCombatants(input.definition, state);
  state.stage = rulesetDirectorStage(state);
  return { ok: true, state };
}
const started = (input: StartInput): CombatDirectorState => {
  const result = start(input);
  assert.ok(result.ok, `the fight was supposed to start: ${result.ok ? "" : result.error}`);
  return result.state;
};
const refusedStart = (input: StartInput): string => {
  const result = start(input);
  assert.ok(!result.ok, "this fight was supposed to be refused");
  return result.error;
};
const view = (definition: RulesetDefinition, state: CombatDirectorState) => {
  const projected = directedRulesetView(definition, state);
  assert.ok(projected, "a ruleset fight always projects a view");
  return projected;
};
const unitOf = (state: CombatDirectorState, id: string) =>
  [...state.party, ...state.enemies].find((unit) => unit.id === id)!;

const fiveEParty = [
  { id: "brenna", name: "Brenna" },
  { id: "corwin", name: "Corwin" },
];
const emberParty = [
  { id: "juno", name: "Juno" },
  { id: "pell", name: "Pell" },
];

// ── The party comes off the sheets, and a member without one is refused by name ──
{
  const state = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "lurker", name: "Thorn Lurker" }],
  });
  const projected = view(fiveE, state);
  assert.equal(projected.ruleset.id, "5e-2014");
  assert.equal(projected.combatants.find((c) => c.id === "brenna")!.health.max, 60, "the sheet's own maximum, not 30");
  assert.equal(projected.combatants.find((c) => c.id === "brenna")!.defense, 18);
  assert.equal(unitOf(state, "brenna").maxHp, 60, "the Engine's own party array is kept in step");
  assert.equal(unitOf(state, "brenna").hp, 60);

  assert.match(
    refusedStart({
      definition: fiveE,
      cards: fiveECards,
      partyCatalogs: spellCatalogs,
      party: [...fiveEParty, { id: "tam", name: "Tam" }],
      enemies: [{ id: "lurker", name: "Thorn Lurker" }],
    }),
    /^Tam has no ruleset sheet/,
  );

  const rough = started({
    definition: ember,
    cards: emberCards,
    partyCatalogs: emberCatalogs,
    party: emberParty,
    enemies: [{ id: "moth", name: "Cinder Moth" }],
  });
  assert.equal(view(ember, rough).ruleset.id, "ember-roads");
  assert.match(
    refusedStart({
      definition: ember,
      cards: emberCards,
      partyCatalogs: emberCatalogs,
      party: [...emberParty, { id: "wick", name: "Wick" }],
      enemies: [{ id: "moth", name: "Cinder Moth" }],
    }),
    /^Wick has no ruleset sheet/,
  );
}

// ── Where an opponent's numbers come from: a bestiary, a proposal, a tier ──
{
  const byReference = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "a", name: "Something", creature: "creatures/thorn-lurker" }],
  });
  const byName = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "a", name: "Thorn Lurker" }],
  });
  const lurker = (state: CombatDirectorState) => rulesetCombatant(state.rulesetFight!.encounter, "a")!;
  assert.equal(lurker(byReference).defense, lurker(byName).defense, "a reference and a name find the same creature");
  assert.ok(lurker(byName).actions.length > 0);
  assert.deepEqual(byName.rulesetFight!.adjustments, [], "a creature that was written needs no adjusting");

  const clamped = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [
      {
        id: "a",
        name: "Invented Horror",
        tier: "cr_1_4",
        proposed: {
          health: 900,
          defense: 40,
          initiativeModifier: 9,
          tier: "cr_1_4",
          resist: ["fire", "narrative"],
          actions: [
            {
              id: "rend",
              name: "Rend",
              budget: "action",
              toHit: 40,
              damage: { dice: "20d12", flat: 30, type: "slashing" },
            },
          ],
        },
      },
    ],
  });
  const horror = rulesetCombatant(clamped.rulesetFight!.encounter, "a")!;
  assert.equal(horror.health!.max, 22, "health was pulled to the top of the CR 1/4 band");
  assert.equal(horror.defense, 14, "defense is the tier's own, plus the headroom one rung allows");
  assert.ok(
    clamped.rulesetFight!.adjustments.some((line) => line.startsWith("Invented Horror: ")),
    "every clamp says what it changed, named after the opponent it changed",
  );
  assert.ok(
    clamped.rulesetFight!.adjustments.some((line) => /damage type/i.test(line)),
    "a damage type this ruleset does not have is dropped and said out loud",
  );

  const tiered = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "a", name: "Nameless Thing", tier: "cr_2" }],
  });
  const thing = rulesetCombatant(tiered.rulesetFight!.encounter, "a")!;
  assert.equal(thing.block!.tier, "cr_2");
  assert.equal(thing.actions.length, 1, "a tier gives one attack and nothing else");
  assert.ok(
    tiered.rulesetFight!.adjustments.some((line) => line.includes("was built from the numbers of")),
    "an opponent nobody wrote says where its numbers came from",
  );
  const unknownTier = started({
    definition: ember,
    cards: emberCards,
    partyCatalogs: emberCatalogs,
    party: emberParty,
    enemies: [{ id: "a", name: "Road thing", tier: "apocalypse" }],
  });
  assert.equal(rulesetCombatant(unknownTier.rulesetFight!.encounter, "a")!.block!.tier, "stray", "the bottom rung");
  assert.ok(unknownTier.rulesetFight!.adjustments.some((line) => line.includes("apocalypse")));

  // A ruleset with no threat scale and nothing written has nothing to build an opponent out of.
  const scaleless = parsedOrThrow(
    variant(fiveEText, (doc) => {
      delete (doc.combat as Record<string, unknown>).threat;
      delete doc.catalogs;
    }),
    "a ruleset with no threat scale",
  );
  assert.match(
    refusedStart({
      definition: scaleless,
      cards: fiveECards,
      partyCatalogs: {},
      party: fiveEParty,
      enemies: [{ id: "a", name: "Nameless Thing" }],
    }),
    /declares no threat tiers/,
  );
}

// ── One accepted choice, and one refusal that changes nothing ──
for (const setup of [
  {
    what: "5e",
    definition: fiveE,
    cards: fiveECards,
    catalogs: spellCatalogs,
    party: fiveEParty,
    enemy: { id: "lurker", name: "Thorn Lurker" } as RulesetFightOpponent,
  },
  {
    what: "Ember Roads",
    definition: ember,
    cards: emberCards,
    catalogs: emberCatalogs,
    party: emberParty,
    enemy: { id: "moth", name: "Cinder Moth" } as RulesetFightOpponent,
  },
]) {
  const { definition, what } = setup;
  // A seed whose initiative puts a party member first, found by trying a few.
  let state = started({
    definition,
    cards: setup.cards,
    partyCatalogs: setup.catalogs,
    party: setup.party,
    enemies: [setup.enemy],
  });
  for (let seed = 1; seed < 60 && view(definition, state).controller !== "manual"; seed++) {
    state = started({
      definition,
      cards: setup.cards,
      partyCatalogs: setup.catalogs,
      party: setup.party,
      enemies: [setup.enemy],
      seed,
    });
  }
  assert.equal(view(definition, state).controller, "manual", `${what}: a party member opens the fight`);
  assert.equal(state.stage, "action");

  const before = view(definition, state);
  const actorId = before.actorId!;
  assert.ok(before.options?.length, `${what}: a human on turn is offered a menu`);
  const attack = before.options!.find((option) => option.targetIds.includes(setup.enemy.id));
  assert.ok(attack, `${what}: something on the menu can be pointed at the opponent`);

  // A refusal changes nothing at all.
  const frozen = JSON.stringify(state.rulesetFight);
  const badTarget = commandRulesetCombatDirector(definition, state, {
    type: "ruleset",
    optionId: attack.id,
    targetIds: [actorId],
  });
  assert.ok(!badTarget.ok && badTarget.code === "ruleset_combat_bad-target", `${what}: ${JSON.stringify(badTarget)}`);
  assert.equal(JSON.stringify(state.rulesetFight), frozen, `${what}: a refusal leaves the fight untouched`);
  const unknown = commandRulesetCombatDirector(definition, state, {
    type: "ruleset",
    optionId: "nothing-like-this",
    targetIds: [setup.enemy.id],
  });
  assert.ok(!unknown.ok && unknown.code === "ruleset_combat_unknown-option");
  assert.equal(JSON.stringify(state.rulesetFight), frozen);
  // The other two styles' commands are not this style's.
  for (const wrong of [
    { type: "begin", unitId: actorId },
    { type: "classic", action: { type: "defend" } },
  ] as const) {
    const answered = commandRulesetCombatDirector(definition, state, wrong as never);
    assert.ok(!answered.ok && answered.code === "ruleset_combat_wrong_style", `${what}: ${wrong.type} is refused`);
  }

  const seqBefore = state.rulesetFight!.eventSeq;
  const accepted = commandRulesetCombatDirector(definition, state, {
    type: "ruleset",
    optionId: attack.id,
    targetIds: [setup.enemy.id],
  });
  assert.ok(accepted.ok, `${what}: a legal choice is accepted`);
  assert.ok(state.rulesetFight!.eventSeq > seqBefore, `${what}: the step left events behind`);
  const after = view(definition, state);
  const opponent = after.combatants.find((c) => c.id === setup.enemy.id)!;
  assert.equal(unitOf(state, setup.enemy.id).hp, opponent.health.value, `${what}: party and enemies stay in step`);
  assert.equal(unitOf(state, setup.enemy.id).maxHp, opponent.health.max);
  assert.ok(
    after.events.every((entry, index) => index === 0 || entry.seq > after.events[index - 1]!.seq),
    `${what}: the running number only goes up`,
  );

  // The projection is a projection.
  const printed = JSON.stringify(after);
  for (const leak of ['"build"', '"catalogs"', '"live"', '"seed"', '"cursor"', '"sheet"']) {
    assert.ok(!printed.includes(leak), `${what}: the view leaks ${leak}`);
  }
}

// ── `continue` resolves one turn and stops at the human ──
{
  const opponents: RulesetFightOpponent[] = [
    { id: "lurker", name: "Thorn Lurker" },
    { id: "hound", name: "Cinder Hound" },
  ];
  const opening = (seed: number) =>
    started({
      definition: fiveE,
      cards: fiveECards,
      partyCatalogs: spellCatalogs,
      party: fiveEParty,
      enemies: opponents,
      seed,
    });
  // A seed whose initiative puts an opponent first, found by trying a few.
  let state = opening(1);
  for (let seed = 2; seed < 60 && view(fiveE, state).controller === "manual"; seed++) state = opening(seed);
  assert.notEqual(view(fiveE, state).controller, "manual", "an opponent opens this fight");
  assert.equal(rulesetDirectorStage(state), "select");
  let turns = 0;
  while (view(fiveE, state).controller !== "manual" && !state.outcome && turns < 20) {
    const order = state.rulesetFight!.encounter.order;
    const before = state.rulesetFight!.encounter;
    const actorBefore = order[before.turn];
    assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "continue" }).ok);
    turns++;
    assert.notEqual(
      state.rulesetFight!.encounter.order[state.rulesetFight!.encounter.turn],
      actorBefore,
      "one continue resolves exactly one turn and moves on",
    );
  }
  assert.ok(turns > 0, "somebody the player does not play acted first");
  assert.equal(view(fiveE, state).controller, "manual", "and it stopped at the human");
  assert.equal(rulesetDirectorStage(state), "action");
}

// ── A party member handed to the Engine is played by the same picker ──
{
  const state = started({
    definition: ember,
    cards: emberCards,
    partyCatalogs: emberCatalogs,
    party: emberParty,
    enemies: [{ id: "moth", name: "Cinder Moth" }],
    seed: 11,
  });
  for (const member of emberParty) {
    assert.ok(commandRulesetCombatDirector(ember, state, { type: "control", unitId: member.id, controller: "ai" }).ok);
  }
  assert.deepEqual(state.rulesetFight!.controllers, { juno: "ai", pell: "ai" });
  assert.notEqual(view(ember, state).controller, "manual", "nobody is waiting for the player now");
  assert.equal(view(ember, state).options, undefined, "and no menu is sent for a turn the player does not play");
  let guard = 0;
  while (!state.outcome && guard++ < 200) {
    assert.ok(commandRulesetCombatDirector(ember, state, { type: "continue" }).ok);
  }
  assert.ok(state.outcome, "a fight nobody plays still finishes");
  assert.ok(
    commandRulesetCombatDirector(ember, state, { type: "control", unitId: "juno", controller: "manual" }).ok === false,
    "and nothing moves after it is over",
  );
}

// ── The picker never double spends, never stalls and always ends the turn ──
for (const setup of [
  {
    what: "5e",
    definition: fiveE,
    cards: fiveECards,
    catalogs: spellCatalogs,
    party: fiveEParty,
    enemy: "Thorn Lurker",
  },
  {
    what: "Ember Roads",
    definition: ember,
    cards: emberCards,
    catalogs: emberCatalogs,
    party: emberParty,
    enemy: "Cinder Moth",
  },
]) {
  let resolved = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const state = started({
      definition: setup.definition,
      cards: setup.cards,
      partyCatalogs: setup.catalogs,
      party: setup.party,
      enemies: [
        { id: "a", name: setup.enemy },
        { id: "b", name: setup.enemy },
      ],
      seed,
    });
    for (const member of setup.party) {
      commandRulesetCombatDirector(setup.definition, state, { type: "control", unitId: member.id, controller: "ai" });
    }
    for (let turn = 0; turn < 8 && !state.outcome; turn++) {
      const before = state.rulesetFight!.encounter;
      const actor = before.order[before.turn]!;
      const spent = { ...rulesetCombatant(before, actor)!.budgets };
      assert.ok(commandRulesetCombatDirector(setup.definition, state, { type: "continue" }).ok);
      resolved++;
      const events = state.rulesetFight!.events.slice(-40).map((entry) => entry.event);
      assert.ok(
        !events.some((event) => event.type === "refused"),
        `${setup.what} seed ${seed}: the picker chose something the rules refused`,
      );
      for (const [budget, left] of Object.entries(spent)) {
        const now = rulesetCombatant(state.rulesetFight!.encounter, actor)?.budgets[budget];
        if (now === undefined) continue;
        assert.ok(now <= left, `${setup.what}: a budget went up mid-turn`);
      }
      const now = state.rulesetFight!.encounter;
      assert.ok(!!state.outcome || now.order[now.turn] !== actor, `${setup.what} seed ${seed}: the turn never ended`);
    }
  }
  assert.ok(resolved >= 100, `${setup.what}: ${resolved} seeded turns were resolved`);
}

// ── The picker leaves the dying alone, and points an ability at everybody it may take ──
{
  let blows = 0;
  let widest = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const state = started({
      definition: fiveE,
      cards: fiveECards,
      partyCatalogs: spellCatalogs,
      party: fiveEParty,
      enemies: [
        { id: "a", name: "Grave Piper" },
        { id: "b", name: "Thorn Lurker" },
      ],
      seed,
    });
    for (const member of fiveEParty) {
      commandRulesetCombatDirector(fiveE, state, { type: "control", unitId: member.id, controller: "ai" });
    }
    for (let turn = 0; turn < 30 && !state.outcome; turn++) {
      const before = state.rulesetFight!.encounter;
      const actor = rulesetCombatant(before, before.order[before.turn]!)!;
      const downBefore = new Set(before.combatants.filter((entry) => entry.down).map((entry) => entry.id));
      const seen = state.rulesetFight!.eventSeq;
      assert.ok(commandRulesetCombatDirector(fiveE, state, { type: "continue" }).ok);
      if (actor.side !== "enemy") continue;
      const fresh = state.rulesetFight!.events.filter((entry) => entry.seq > seen).map((entry) => entry.event);
      for (const event of fresh) {
        if (event.type !== "attack" && event.type !== "damage") continue;
        blows++;
        assert.ok(
          !downBefore.has(event.targetId),
          `seed ${seed}: ${actor.name} went for ${event.targetId}, who was already down`,
        );
      }
      const saved = new Set(
        fresh.flatMap((event) => (event.type === "save" && event.sourceId === actor.id ? [event.actorId] : [])),
      );
      widest = Math.max(widest, saved.size);
    }
  }
  assert.ok(blows > 50, `${blows} blows from opponents were looked at`);
  assert.equal(widest, 2, "an ability that may take three people took both members of a party of two");
}

// ── Victory, defeat, and the Engine's own summary ──
{
  const win = started({
    definition: ember,
    cards: emberCards,
    partyCatalogs: emberCatalogs,
    party: emberParty,
    enemies: [{ id: "moth", name: "Cinder Moth" }],
    seed: 5,
  });
  for (const member of emberParty) {
    commandRulesetCombatDirector(ember, win, { type: "control", unitId: member.id, controller: "ai" });
  }
  let guard = 0;
  while (!win.outcome && guard++ < 400) commandRulesetCombatDirector(ember, win, { type: "continue" });
  assert.ok(win.outcome === "victory" || win.outcome === "defeat", `the fight ended: ${win.outcome}`);
  assert.equal(win.stage, "finished");
  assert.ok(win.summary, "the Engine's own summary is filled from the fight");
  assert.equal(win.summary!.outcome, win.outcome);
  assert.equal(win.summary!.party.length, 2);
  assert.equal(win.summary!.enemies.length, 1);
  const ended = view(ember, win);
  assert.ok(ended.summary, "and the ruleset's own summary rides beside it");
  assert.equal(ended.summary!.outcome, win.outcome === "victory" ? "victory" : "defeat");
  assert.equal(ended.options, undefined, "a finished fight offers nothing");
  assert.equal(
    win.summary!.enemies[0]!.defeated,
    ended.summary!.enemies[0]!.defeated,
    "both summaries agree about the opponent",
  );

  // Running away is the director's own ending, and it still fills a summary.
  const fled = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "lurker", name: "Thorn Lurker" }],
  });
  assert.ok(commandRulesetCombatDirector(fiveE, fled, { type: "flee" }).ok);
  assert.equal(fled.outcome, "flee");
  assert.equal(fled.summary!.outcome, "flee");
  assert.equal(rulesetDirectorStage(fled), "finished");
}

// ── Plain JSON, and dice that pick up where they were left ──
{
  const state = started({
    definition: fiveE,
    cards: fiveECards,
    partyCatalogs: spellCatalogs,
    party: fiveEParty,
    enemies: [{ id: "lurker", name: "Thorn Lurker" }],
    seed: 21,
  });
  for (const member of fiveEParty) {
    commandRulesetCombatDirector(fiveE, state, { type: "control", unitId: member.id, controller: "ai" });
  }
  for (let turn = 0; turn < 3 && !state.outcome; turn++) {
    commandRulesetCombatDirector(fiveE, state, { type: "continue" });
  }
  const cursor = state.rulesetFight!.encounter.cursor;
  assert.ok(cursor > 0, "the fight has thrown dice");
  const reloaded = JSON.parse(JSON.stringify(state)) as CombatDirectorState;
  assert.deepEqual(reloaded.rulesetFight, state.rulesetFight, "a round trip changes nothing");
  const continuedHere = structuredClone(state);
  commandRulesetCombatDirector(fiveE, continuedHere, { type: "continue" });
  commandRulesetCombatDirector(fiveE, reloaded, { type: "continue" });
  assert.deepEqual(
    reloaded.rulesetFight!.events.map((entry) => entry.event),
    continuedHere.rulesetFight!.events.map((entry) => entry.event),
    "and the same dice come next",
  );
  // The cursor is what makes that true: rolling from zero would not agree.
  // Eight dice from each, because one d20 agrees by chance one time in twenty.
  const eight = (from: number) => {
    const roll = rulesetCombatRoller(state.rulesetFight!.encounter.seed, from);
    return Array.from({ length: 8 }, () => roll(20));
  };
  assert.notDeepEqual(eight(0), eight(cursor), "the dice after the cursor are not the dice the fight opened with");
  assert.deepEqual(eight(cursor), eight(cursor), "and the same cursor always gives the same dice");

  // The live sheet state the route writes back is keyed the way the game stores it.
  const live = rulesetFightLiveStates(state.rulesetFight!);
  assert.deepEqual(Object.keys(live).sort(), ["brenna", "corwin"]);
}

console.log(
  "Ruleset combat director: sheets, bestiaries, clamps, tiers, refusals, one turn per continue, the picker, summaries and a JSON round trip passed.",
);
