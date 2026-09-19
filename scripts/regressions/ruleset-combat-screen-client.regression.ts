// Ruleset combat, slice C3b: the fight on screen, driven through the REAL exported helpers, the
// REAL example rulesets and the REAL English catalog, so nothing here can agree with a mistake the
// components also make.
//
// What it pins:
//   - Every event a fight can report has a line, and the line reads the ruleset's own words: 5e
//     rolls a d20 against AC and Ember Roads rolls 2d6 against a Guard, out of the same code.
//   - The menu comes out grouped in one order, an option says what it spends in the ruleset's own
//     budget and pool names, and the forecast is the server's numbers rather than a sum done here.
//   - Target picking stays inside the option's own list and its own count, and a heal is offered
//     the allies the server said it may be pointed at.
//   - The one decision that says a fight is the ruleset's own, for every combination of the three
//     things it reads, and the battle bridge standing aside for exactly that fight.
//   - The recap a finished fight hands the Game Master, from a real summary.
//   - Every localization key the changed client code asks for exists.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatOptions,
  rulesetEncounterSummary,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  type Combatant,
  type DirectedRulesetEvent,
  type DirectedRulesetOption,
  type DirectedRulesetView,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetBuild,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import {
  rulesetCombatEventLine,
  rulesetCombatLogLines,
  rulesetCombatNames,
  rulesetRefusalText,
  rulesetValueLabel,
} from "../../packages/client/src/lib/ruleset-combat-log.js";
import {
  RULESET_MENU_KINDS,
  rulesetDefaultTargets,
  rulesetMenuGroups,
  rulesetOptionCostText,
  rulesetOptionForecastText,
  rulesetOptionNeedsTargets,
  rulesetPickTarget,
  rulesetSendsOnPick,
} from "../../packages/client/src/lib/ruleset-combat-menu.js";
import {
  isRulesetCombatFight,
  rulesetCombatRecapLines,
  seedRulesetBattleParty,
} from "../../packages/client/src/lib/ruleset-combat-bridge.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

const messages = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;

/** English rendering with i18next's own plural suffix and interpolation, so every assertion below
 *  reads the shipped strings rather than a copy of them. */
function translate(key: string, params: Record<string, unknown> = {}): string {
  const count = params.count;
  const plural = typeof count === "number" ? `${key}_${count === 1 ? "one" : "other"}` : key;
  const message = messages[plural] ?? messages[key];
  // A key the screen asks for and the catalog does not hold is the failure this lane exists for,
  // except where the code itself passes a default and means it.
  if (message === undefined) {
    const fallback = params.defaultValue;
    assert.ok(typeof fallback === "string", `en.json is missing ${key}`);
    return fallback;
  }
  return message.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (_all, name: string) => String(params[name] ?? ""));
}
type Translator = Parameters<typeof rulesetCombatEventLine>[2];
const t = translate as unknown as Translator;

// ── Every key the changed client code asks for exists ──

const keyPattern = /"((?:game\.combat\.ruleset|game\.ruleset\.(?:setup|import))\.[a-zA-Z0-9_.]+)"/gu;
const sources = [
  "packages/client/src/lib/ruleset-combat-log.ts",
  "packages/client/src/lib/ruleset-combat-menu.ts",
  "packages/client/src/components/game/RulesetCombatMenu.tsx",
  "packages/client/src/components/game/RulesetCombatStatus.tsx",
  "packages/client/src/components/game/GameSetupRulesChooser.tsx",
  "packages/client/src/components/agents/RulesetImportReviewModal.tsx",
  "packages/client/src/features/chat-settings/sections/CombatStyleSection.tsx",
].map(readSource);
const referenced = new Set<string>();
for (const source of sources) for (const match of source.matchAll(keyPattern)) referenced.add(match[1]!);
for (const key of [
  "game.combat.ruleset.menu.flee",
  "game.combat.ruleset.status.order",
  "game.ruleset.setup.combatOwnRules",
  "game.ruleset.import.combatOwnRules",
  "game.combat.ruleset.preferenceIgnored",
]) {
  assert.ok(referenced.has(key), `the screen no longer asks for ${key}`);
}
for (const key of referenced) {
  const present = key in messages || (`${key}_one` in messages && `${key}_other` in messages);
  assert.ok(present, `en.json is missing ${key}`);
}
// The keys built at runtime from a kind, a reason or a refusal code are spelled out below, so the
// regex above cannot see them. They are checked where they are used, by rendering them.

// ── The example rulesets, parsed exactly as the Engine parses them ──

function parsed(text: string, edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, `the example must stay usable: ${result.ok ? "" : result.issues.join("; ")}`);
  return result.definition;
}
const fiveEText = readSource("docs/development/ruleset-5e-2014.example.json");
const emberText = readSource("docs/examples/rulesets/ember-roads.json");
const fiveE = parsed(fiveEText);
const ember = parsed(emberText);

assert.equal(fiveE.coverage.combat, true, "the 5e example resolves its own fights and says so");
assert.equal(ember.coverage.combat, true, "and so does Ember Roads");

// The ruleset's own word for what an attack is rolled against, which is what the log prints.
assert.equal(rulesetValueLabel(fiveE, fiveE.combat!.defense), "Armor Class");
assert.equal(rulesetValueLabel(ember, ember.combat!.defense), "Guard");
assert.equal(rulesetValueLabel(ember, undefined), "");
assert.equal(rulesetValueLabel(ember, { const: 7 }), "", "a plain number has no name to give");

// ── Fixtures: two fights, one per ruleset ──

/** Dice written down in advance, so every number in a line below was decided, not guessed. */
function dice(...faces: number[]): RulesetCombatRoller {
  let index = 0;
  return (sides) => {
    assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
    return faces[index++]!;
  };
}
const build = (input: Record<string, unknown>): RulesetSheetBuild => rulesetSheetBuildSchema.parse(input);

const healEntries = [
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
const healRows = healEntries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row));

const brenna: RulesetCombatantInput = {
  id: "brenna",
  name: "Brenna",
  side: "party",
  build: build({
    abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    saves: { str_save: "proficient", con_save: "proficient" },
    fields: { level: 7, ac: 18, speed: 30, hp_max: 60 },
    lists: {
      attacks: [
        { name: "Longsword", ability: "str", proficient: true, bonus: 0, damage: "1d8", damage_type: "slashing" },
      ],
    },
  }),
  live: {},
  catalogs: {},
};
const corwin: RulesetCombatantInput = {
  id: "corwin",
  name: "Corwin",
  side: "party",
  build: build({
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    saves: { int_save: "proficient", wis_save: "proficient" },
    fields: { level: 7, ac: 12, speed: 30, hp_max: 38, spellcasting_ability: "int", slots_max_1: 4 },
    lists: { spells: healRows },
  }),
  live: { pools: { hp: { value: 20 } } },
  catalogs: { spells: healEntries },
};
const lurker = (block: Partial<RulesetStatBlock> = {}): RulesetCombatantInput => ({
  id: "lurker",
  name: "Thorn Lurker",
  side: "enemy",
  block: {
    health: 12,
    defense: 13,
    initiativeModifier: 2,
    saves: { dex_save: 2 },
    actions: [
      {
        id: "thorns",
        name: "Thorns",
        budget: "action",
        toHit: 4,
        damage: { count: 1, sides: 6, flat: 2, type: "piercing" },
      },
    ],
    ...block,
  },
});

/** A view of exactly the shape the server sends, for the parts a line or a panel reads. */
const viewOf = (state: RulesetEncounterState, events: DirectedRulesetEvent[] = []): DirectedRulesetView => ({
  ruleset: { ...state.ruleset },
  round: state.round,
  order: [...state.order],
  controller: "manual",
  combatants: state.combatants.map((combatant) => ({
    id: combatant.id,
    name: combatant.name,
    side: combatant.side,
    initiative: combatant.initiative,
    health: { value: 0, max: 0, temp: 0 },
    defense: combatant.defense,
    conditions: [],
    budgets: { ...combatant.budgets },
    down: combatant.down,
    dying: combatant.dying,
    stable: combatant.stable,
    defeated: combatant.defeated,
  })),
  events: events.map((event, index) => ({ seq: index + 1, event })),
  adjustments: [],
});

/** The menu exactly as the director builds it: every option with the ids it may be pointed at. */
const menuOf = (definition: RulesetDefinition, state: RulesetEncounterState, actorId: string) =>
  rulesetCombatOptions(definition, state, actorId).map((option) => ({
    ...option,
    targetIds: rulesetOptionTargets(state, actorId, option),
  })) satisfies DirectedRulesetOption[];

const line = (definition: RulesetDefinition, state: RulesetEncounterState, event: DirectedRulesetEvent) =>
  rulesetCombatEventLine(event, rulesetCombatNames(definition, viewOf(state)), t);

// ── A real 5e fight: a d20 against AC, and the arithmetic printed ──

{
  // Brenna 18 initiative, the Lurker 4: she swings first.
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 4242,
    combatants: [brenna, lurker()],
    roller: dice(16, 2),
  });
  const opening = state.opening;
  assert.equal(
    line(fiveE, state, opening.find((event) => event.type === "initiative")!),
    "Initiative: Brenna 18, Thorn Lurker 4.",
  );
  assert.equal(line(fiveE, state, { type: "round", round: 1 }), "Round 1.");
  assert.equal(line(fiveE, state, { type: "turn", actorId: "brenna", round: 1 }), "Brenna takes their turn.");

  const menu = menuOf(fiveE, state, "brenna");
  const sword = menu.find((option) => option.label === "Longsword")!;
  assert.ok(sword, "the sheet's own weapon is on the menu");
  assert.deepEqual(sword.targetIds, ["lurker"], "and it may only be pointed at the other side");

  // A 17 on the die, +5 from Strength and proficiency, against Armor Class 13: a hit for 5 + 4 = 9.
  const swing = applyRulesetCombatChoice(
    fiveE,
    state,
    { actorId: "brenna", optionId: sword.id, targetIds: ["lurker"] },
    dice(17, 5),
  );
  const names = rulesetCombatNames(fiveE, viewOf(swing.state));
  const printed = rulesetCombatLogLines(
    swing.events.map((event, index) => ({ seq: index + 1, event: event as DirectedRulesetEvent })),
    names,
    t,
  ).map((entry) => entry.text);
  assert.ok(
    printed.includes("Brenna attacks Thorn Lurker with Longsword: 17 + 7 = 24 against Armor Class 13, a hit."),
    `the attack line is not what it should be: ${JSON.stringify(printed)}`,
  );
  assert.ok(
    printed.includes("Thorn Lurker takes 9 slashing damage, and is on 3 of 12."),
    `the damage line is not what it should be: ${JSON.stringify(printed)}`,
  );
  assert.ok(
    printed.includes("Brenna has 0 Action left."),
    `the budget line is not in the ruleset's own words: ${JSON.stringify(printed)}`,
  );

  // Only the lines that are new are handed back, so a screen prints a fight once.
  const all = swing.events.map((event, index) => ({ seq: index + 1, event: event as DirectedRulesetEvent }));
  assert.deepEqual(rulesetCombatLogLines(all, names, t, all.length), []);
  assert.equal(rulesetCombatLogLines(all, names, t, 1).length, rulesetCombatLogLines(all, names, t).length - 1);
}

// ── The same code on Ember Roads: 2d6 against a Guard, and Grit for health ──

{
  const juno: RulesetCombatantInput = {
    id: "juno",
    name: "Juno",
    side: "party",
    build: build({
      abilities: { brawn: 2, wits: 1, heart: 0 },
      fields: { toughness: 2 },
      lists: { gear: [{ name: "Road axe", swing: "brawn", damage: "1d6", harm: "cut" }] },
    }),
    live: {},
    catalogs: {},
  };
  const hound: RulesetCombatantInput = {
    id: "ash",
    name: "Ash-hound",
    side: "enemy",
    block: {
      health: 5,
      defense: 5,
      initiativeModifier: 0,
      actions: [{ id: "bite", name: "Bite", budget: "act", toHit: 1, damage: { count: 1, sides: 4, flat: 1 } }],
    },
  };
  const state = createRulesetEncounter({
    definition: ember,
    seed: 11,
    combatants: [juno, hound],
    roller: dice(5, 4, 2, 1),
  });
  const menu = menuOf(ember, state, "juno");
  const axe = menu.find((option) => option.label === "Road axe")!;
  assert.ok(axe, "the sheet's own gear row is on the menu");
  const swing = applyRulesetCombatChoice(
    ember,
    state,
    { actorId: "juno", optionId: axe.id, targetIds: ["ash"] },
    dice(4, 3, 5),
  );
  const names = rulesetCombatNames(ember, viewOf(swing.state));
  const printed = swing.events.flatMap((event) => {
    const text = rulesetCombatEventLine(event as DirectedRulesetEvent, names, t);
    return text ? [text] : [];
  });
  assert.ok(
    printed.includes("Juno attacks Ash-hound with Road axe: 7 (4 + 3) + 2 = 9 against Guard 5, a hit."),
    `Ember Roads is not printed in its own terms: ${JSON.stringify(printed)}`,
  );
  assert.ok(
    printed.includes("Ash-hound takes 7 cut damage, and is on 0 of 5."),
    `the damage line is not what it should be: ${JSON.stringify(printed)}`,
  );
  assert.ok(printed.includes("Ash-hound is out of the fight."), JSON.stringify(printed));
  assert.ok(printed.includes("The fight is won."), JSON.stringify(printed));
  // Ember Roads has one budget and calls it Action, and one Grit pool: the ruleset's words, not
  // this Engine's.
  assert.ok(printed.includes("Juno has 0 Action left."), JSON.stringify(printed));

  // ── The recap a finished fight hands the Game Master ──
  const summary = rulesetEncounterSummary(ember, swing.state);
  assert.deepEqual(rulesetCombatRecapLines(ember, summary), [
    "Party on Ember Roads rules: Juno: 8/8 Grit",
    "Sheets: the Ember Roads sheets were kept up to date while the fight ran, so every cost is already paid. Do not change those numbers again.",
  ]);
}

// ── Every event a fight can report has a line ──

{
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 7,
    combatants: [brenna, corwin, lurker()],
    roller: dice(10, 8, 3),
  });
  const say = (event: DirectedRulesetEvent) => line(fiveE, state, event);

  const table: Array<[RulesetCombatEvent["type"] | "director", string | null]> = [
    ["initiative", say({ type: "initiative", entries: [{ actorId: "brenna", roll: [12], modifier: 2, total: 14 }] })],
    ["round", say({ type: "round", round: 3 })],
    ["turn", say({ type: "turn", actorId: "brenna", round: 3 })],
    [
      "attack",
      say({
        type: "attack",
        actorId: "brenna",
        targetId: "lurker",
        optionId: "sword",
        label: "Longsword",
        mode: "advantage",
        rolls: [7, 19],
        kept: 19,
        modifier: 5,
        total: 24,
        defense: 13,
        outcome: "critical",
      }),
    ],
    [
      "save",
      say({
        type: "save",
        actorId: "brenna",
        save: "con_save",
        rolls: [11, 4],
        kept: 4,
        modifier: -1,
        total: 3,
        difficulty: 13,
        success: false,
      }),
    ],
    [
      "damage",
      say({
        type: "damage",
        targetId: "lurker",
        sourceId: "brenna",
        damageType: "fire",
        rolls: [4, 4],
        flat: 0,
        amount: 8,
        dealt: 4,
        adjust: "resist",
        saved: true,
        toTemp: 2,
        health: 8,
        maxHealth: 12,
        critical: true,
      }),
    ],
    ["heal", say({ type: "heal", targetId: "corwin", rolls: [5], flat: 4, amount: 9, health: 29, maxHealth: 38 })],
    ["temporary", say({ type: "temporary", targetId: "brenna", rolls: [3], flat: 2, amount: 5 })],
    ["condition", say({ type: "condition", targetId: "brenna", condition: "prone", active: true, reason: "applied" })],
    ["spend", say({ type: "spend", actorId: "corwin", pool: "slots_1", label: "1st-level slots", amount: 1 })],
    ["budget", say({ type: "budget", actorId: "brenna", budget: "bonus", left: 0 })],
    ["uses", say({ type: "uses", actorId: "lurker", optionId: "thorns", label: "Thorns", left: 1, of: 3 })],
    [
      "recharge",
      say({
        type: "recharge",
        actorId: "lurker",
        optionId: "thorns",
        label: "Thorns",
        rolls: [5],
        kept: 5,
        from: 5,
        back: true,
      }),
    ],
    ["signature", say({ type: "signature", actorId: "lurker", optionId: "wail", label: "Wail", cost: 2, left: 1 })],
    [
      "concentration",
      say({ type: "concentration", actorId: "corwin", label: "Bless", state: "ended", reason: "damage" }),
    ],
    ["standard", say({ type: "standard", actorId: "brenna", action: "help", targetId: "corwin" })],
    [
      "dying",
      say({
        type: "dying",
        actorId: "brenna",
        rolls: [12],
        kept: 12,
        difficulty: 10,
        successes: 2,
        failures: 1,
        result: "success",
      }),
    ],
    ["down", say({ type: "down", actorId: "brenna", dying: true })],
    ["defeated", say({ type: "defeated", actorId: "lurker" })],
    ["revived", say({ type: "revived", actorId: "brenna", health: 1 })],
    ["outcome", say({ type: "outcome", outcome: "victory" })],
    ["refused", say({ type: "refused", actorId: "brenna", optionId: "sword", reason: "no-budget" })],
    ["director", say({ type: "director", reason: "ruleset-unavailable", text: "The rules are gone." })],
  ];
  const printed = new Map(table);
  for (const [type, text] of table) {
    assert.ok(text && text.length > 0, `a "${type}" event prints nothing`);
  }

  // The exact strings, so rewording one is a decision rather than an accident.
  assert.equal(printed.get("initiative"), "Initiative: Brenna 14.");
  assert.equal(printed.get("round"), "Round 3.");
  assert.equal(printed.get("turn"), "Brenna takes their turn.");
  assert.equal(
    printed.get("attack"),
    "Brenna attacks Thorn Lurker with Longsword: 19 (rolled 7, 19, with advantage) + 5 = 24 against Armor Class 13, a critical hit.",
  );
  assert.equal(printed.get("save"), "Brenna rolls Constitution save: 4 (rolled 11, 4) - 1 = 3 against 13, a failure.");
  assert.equal(
    printed.get("damage"),
    "Thorn Lurker takes 4 fire damage, and is on 8 of 12. A critical hit. Resisted. Halved by the save. 2 of it came off temporary points.",
  );
  assert.equal(printed.get("heal"), "Corwin recovers 9, and is on 29 of 38.");
  assert.equal(printed.get("temporary"), "Brenna gains 5 temporary points.");
  assert.equal(printed.get("condition"), "Brenna is now Prone.");
  assert.equal(printed.get("spend"), "Corwin spends 1 1st-level slots.");
  assert.equal(printed.get("budget"), "Brenna has 0 Bonus action left.");
  assert.equal(printed.get("uses"), "Thorns: 1 of 3 left.");
  assert.equal(printed.get("recharge"), "Thorns is ready again: 5, needing 5.");
  assert.equal(printed.get("signature"), "Thorn Lurker spends 2 on Wail, with 1 left.");
  assert.equal(printed.get("concentration"), "Corwin loses hold of Bless.");
  assert.equal(printed.get("standard"), "Brenna helps Corwin.");
  assert.equal(printed.get("dying"), "Brenna holds on: 12 against 10. Held 2, slipped 1.");
  assert.equal(printed.get("down"), "Brenna goes down and is fighting to hold on.");
  assert.equal(printed.get("defeated"), "Thorn Lurker is out of the fight.");
  assert.equal(printed.get("revived"), "Brenna is back up on 1.");
  assert.equal(printed.get("outcome"), "The fight is won.");
  assert.equal(printed.get("refused"), "Brenna could not do that: They have nothing left to spend on it this turn.");
  assert.equal(printed.get("director"), "The fight stopped here: The rules are gone.");

  // A fight that is still going says nothing, so nobody prints "ongoing" at a player.
  assert.equal(line(fiveE, state, { type: "outcome", outcome: "ongoing" }), null);

  // Drift guard: an event type the resolver learns to emit has to be given a line here too. The
  // union is read out of the shared types file, so a new variant fails this lane rather than
  // printing nothing on screen.
  const unionText = readSource("packages/shared/src/features/ruleset-combat/types.ts");
  const union = unionText.slice(unionText.indexOf("export type RulesetCombatEvent"));
  const declared = new Set([...union.matchAll(/type:\s*"([a-z-]+)"/gu)].map((match) => match[1]!));
  assert.ok(declared.size > 15, "the event union was not found where it used to be");
  for (const type of declared) {
    assert.ok(printed.has(type as RulesetCombatEvent["type"]), `no line is written for a "${type}" event`);
  }
}

// ── The refusal a 400 carries, and the sentence behind an unknown code ──

{
  assert.equal(
    rulesetRefusalText("ruleset_combat_bad-target", "That is not a legal target for this.", t),
    "That is not a legal target for this.",
  );
  assert.equal(
    rulesetRefusalText("ruleset_combat_decision_open", "whatever the server said", t),
    "Answer the open decision first.",
  );
  // A code this Engine does not know keeps the server's own sentence rather than inventing one.
  assert.equal(
    rulesetRefusalText("ruleset_combat_something_new", "The rules refused that.", t),
    "The rules refused that.",
  );
  assert.equal(
    rulesetRefusalText(undefined, "Battle anchor is not in this chat.", t),
    "Battle anchor is not in this chat.",
  );
  assert.equal(rulesetRefusalText("some_other_code", "Chat not found.", t), "Chat not found.");
}

// ── The menu: grouped, priced and forecast out of what the server sent ──

{
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 9,
    combatants: [brenna, corwin, lurker()],
    roller: dice(15, 9, 3),
  });
  const menu = menuOf(fiveE, state, "brenna");
  const groups = rulesetMenuGroups(menu);
  assert.deepEqual(
    groups.map((group) => group.kind),
    RULESET_MENU_KINDS.filter((kind) => menu.some((option) => option.kind === kind)),
    "the groups come out in one order, and an empty one is not drawn",
  );
  assert.deepEqual(groups.at(-1)?.kind, "end-turn", "ending the turn is always last");
  assert.equal(groups.at(-1)?.labelKey, "game.combat.ruleset.group.endTurn");
  for (const group of groups) assert.ok(messages[group.labelKey], `en.json is missing ${group.labelKey}`);
  assert.deepEqual(rulesetMenuGroups(undefined), [], "no menu is no groups");
  assert.deepEqual(
    rulesetMenuGroups([{ ...menu[0]!, kind: "nonsense" as never }]),
    [],
    "an option of a kind this Engine does not know is left out rather than drawn without a heading",
  );

  const budgetLabel = (id: string) => fiveE.combat!.economy.budgets.find((budget) => budget.id === id)?.label ?? id;
  const sword = menu.find((option) => option.label === "Longsword")!;
  assert.equal(rulesetOptionCostText(sword, budgetLabel, t), "Spends Action");
  const forecast = rulesetOptionForecastText(sword, t);
  assert.match(forecast, /^\d+% to hit, about \d+ damage$/u, `the forecast reads oddly: ${forecast}`);
  assert.equal(
    rulesetOptionForecastText({ ...sword, heals: true }, t),
    forecast.replace(" damage", " healed"),
    "a heal is worded as healing, because both are an amount",
  );
  assert.equal(rulesetOptionForecastText({ ...sword, forecast: undefined }, t), "");

  // What a spell costs is the sheet's own pool name, and how many are left is the server's count.
  // The menu only ever holds the actor on turn's own options, so the wizard is given the initiative
  // in a fight of her own rather than being asked for a menu out of turn.
  const wizardsTurn = createRulesetEncounter({
    definition: fiveE,
    seed: 9,
    combatants: [brenna, corwin, lurker()],
    roller: dice(4, 18, 3),
  });
  assert.equal(wizardsTurn.order[0], "corwin", "the wizard rolled highest and is on turn");
  const heal = menuOf(fiveE, wizardsTurn, "corwin").find((option) => option.label === "Mending Light")!;
  assert.ok(heal, "the wizard's prepared spell is on the menu");
  const healCost = rulesetOptionCostText(heal, budgetLabel, t);
  assert.ok(healCost.startsWith("Spends Action · 1 "), `the cost is not in the sheet's own words: ${healCost}`);
  assert.equal(
    rulesetOptionCostText({ ...heal, left: 2, signature: { cost: 1, points: 3 } }, budgetLabel, t),
    `${healCost} · 1 of 3 points · 2 left`,
  );

  // ── Target picking stays inside the option's own list and count ──
  assert.ok(rulesetOptionNeedsTargets(sword));
  assert.deepEqual(sword.targetIds, ["lurker"], "one enemy is standing, so one id is legal");
  assert.ok(rulesetSendsOnPick(sword), "one target and one allowed is a single tap");
  assert.deepEqual(rulesetPickTarget(sword, [], "lurker"), ["lurker"]);
  assert.deepEqual(rulesetPickTarget(sword, [], "brenna"), [], "an id the option does not list cannot be picked");
  assert.deepEqual(rulesetPickTarget(sword, ["lurker"], "lurker"), [], "picking it again takes it off");

  // A heal is offered the allies the server said it may be pointed at, and never the other side.
  assert.equal(heal.targets.side, "ally");
  assert.deepEqual([...heal.targetIds].sort(), ["brenna", "corwin"]);
  assert.ok(!heal.targetIds.includes("lurker"), "a heal is never offered the enemy");

  // The count is the ceiling, and a pick beyond it changes nothing.
  const two: DirectedRulesetOption = { ...heal, targets: { side: "ally", count: 2 } };
  assert.ok(!rulesetSendsOnPick(two), "something that may take two is confirmed rather than sent on the first tap");
  assert.deepEqual(rulesetPickTarget(two, ["brenna"], "corwin"), ["brenna", "corwin"]);
  assert.deepEqual(rulesetPickTarget(two, ["brenna", "corwin"], "brenna"), ["corwin"]);
  const three: DirectedRulesetOption = { ...heal, targets: { side: "ally", count: 1 } };
  assert.deepEqual(rulesetPickTarget(three, ["brenna"], "corwin"), ["brenna"], "the count is the ceiling");

  // Nothing to point at, and something pointed at the actor, are both sent without a picking step.
  const endTurn = menu.find((option) => option.kind === "end-turn")!;
  assert.ok(!rulesetOptionNeedsTargets(endTurn));
  assert.deepEqual(rulesetDefaultTargets(endTurn), []);
  const dodge = menu.find((option) => option.targets.side === "self");
  if (dodge) {
    assert.ok(!rulesetOptionNeedsTargets(dodge), "aiming at yourself is not a choice");
    assert.deepEqual(rulesetDefaultTargets(dodge), dodge.targetIds.slice(0, dodge.targets.count));
  }
  assert.deepEqual(rulesetDefaultTargets(sword), [], "something that IS a choice sends nothing until it is made");
}

// ── When a fight is the ruleset's own ──

{
  const both = ember;
  // A bestiary is written in the combat block's own terms, so a ruleset without one ships none.
  const withoutCombat = (doc: Record<string, any>) => {
    delete doc.combat;
    doc.catalogs = (doc.catalogs ?? []).filter((catalog: { holds?: string }) => catalog.holds !== "creatures");
  };
  const battleOnly = parsed(emberText, withoutCombat);
  const combatOnly = parsed(emberText, (doc) => delete doc.battle);
  assert.ok(battleOnly.battle && !battleOnly.combat);
  assert.ok(combatOnly.combat && !combatOnly.battle);

  // All three, and it is the ruleset's fight.
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: both, anchor: "m1" }), true);
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: combatOnly, anchor: "m1" }), true);
  // Take any one away and it is one of Marinara's own.
  assert.equal(isRulesetCombatFight({ combatDirector: false, definition: both, anchor: "m1" }), false);
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: battleOnly, anchor: "m1" }), false);
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: both, anchor: null }), false);
  // A game with no ruleset at all never reaches any of it.
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: null, anchor: "m1" }), false);
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: undefined, anchor: undefined }), false);
  // The self-declared flag is not what decides it, either way round.
  const claimsNothing = parsed(emberText, (doc) => (doc.coverage.combat = false));
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: claimsNothing, anchor: "m1" }), true);
  const claimsCombat = parsed(emberText, (doc) => {
    withoutCombat(doc);
    doc.coverage.combat = true;
  });
  assert.equal(isRulesetCombatFight({ combatDirector: true, definition: claimsCombat, anchor: "m1" }), false);

  // ── And the battle bridge stands aside for exactly that fight ──
  const cards = [
    {
      name: "Juno",
      rulesetSheet: {
        v: 1,
        build: rulesetSheetBuildSchema.parse({
          abilities: { grit_stat: 2, wits: 1, heart: 0 },
          fields: { grit_max: 8 },
        }),
      },
    },
  ];
  const party: Combatant[] = [
    {
      id: "juno",
      name: "Juno",
      hp: 100,
      maxHp: 100,
      attack: 10,
      defense: 5,
      speed: 5,
      level: 3,
      side: "player",
    },
  ];
  const live = { juno: { pools: { grit: { value: 4 } } } };
  // A ruleset with only a `battle` block still lends the fight the sheet's own share.
  const bridged = seedRulesetBattleParty(battleOnly, cards, live, {}, party, null);
  assert.ok(bridged.party !== party, "the bridge really ran");
  assert.equal(bridged.party[0]!.hp, 67, "four Grit out of six is two thirds of a hundred hit points");
  // The very same call for the fight the ruleset resolves is never made: GameSurface asks the
  // decision above first, and the seeding it would have done is what would disagree with the
  // server's own reading of the same sheet.
  assert.equal(
    isRulesetCombatFight({ combatDirector: true, definition: both, anchor: "m1" }),
    true,
    "so this fight never reaches the bridge",
  );
  // A ruleset with no `battle` block hands back the very array it was given, references included.
  assert.equal(seedRulesetBattleParty(combatOnly, cards, live, {}, party, null).party, party);
}

// ── The recap, from a fight that really ended ──

{
  const state = createRulesetEncounter({
    definition: fiveE,
    seed: 3,
    combatants: [brenna, corwin, lurker({ health: 4 })],
    roller: dice(18, 9, 2),
  });
  const menu = menuOf(fiveE, state, "brenna");
  const sword = menu.find((option) => option.label === "Longsword")!;
  const over = applyRulesetCombatChoice(
    fiveE,
    state,
    { actorId: "brenna", optionId: sword.id, targetIds: ["lurker"] },
    dice(18, 6),
  );
  const summary = rulesetEncounterSummary(fiveE, over.state);
  assert.equal(summary.outcome, "victory");
  const recap = rulesetCombatRecapLines(fiveE, summary);
  assert.deepEqual(recap, [
    "Party on 5e (SRD 5.1) rules: Brenna: 60/60 Hit points; Corwin: 20/38 Hit points",
    "Sheets: the 5e (SRD 5.1) sheets were kept up to date while the fight ran, so every cost is already paid. Do not change those numbers again.",
  ]);

  // Who is down, dying or stable, and what they are carrying, in the ruleset's own words.
  const hurt = {
    ...summary,
    party: [
      { ...summary.party[0]!, health: 0, down: true, dying: true, stable: false, conditions: ["unconscious"] },
      { ...summary.party[1]!, temp: 4, down: true, dying: true, stable: true, conditions: [] },
    ],
    enemies: [{ id: "lurker", name: "Thorn Lurker", health: 3, maxHealth: 12, defeated: false }],
  };
  assert.deepEqual(rulesetCombatRecapLines(fiveE, hurt), [
    "Party on 5e (SRD 5.1) rules: Brenna: 0/60 Hit points (dying; Unconscious); Corwin: 20/38 Hit points (stable; 4 temporary)",
    "Still standing: Thorn Lurker (3/12)",
    "Sheets: the 5e (SRD 5.1) sheets were kept up to date while the fight ran, so every cost is already paid. Do not change those numbers again.",
  ]);
}

console.log("ruleset-combat-screen-client regression passed");
