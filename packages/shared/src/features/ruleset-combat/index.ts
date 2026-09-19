// Ruleset combat: a fight resolved by the ruleset's own numbers.
//
// Pure, deterministic and free of I/O, like the tactical engine beside it: every die comes through
// an injected roller, nothing throws, and the state is a plain object a later slice can persist as
// JSON and read back exactly. It knows nothing about routes, sessions, sheets on disk or React.
//
// A party member reads their numbers from the ruleset sheet through the sheet's own helpers and
// writes every change back through `applyRulesetSheetOp`, so the fight and the sheet keep one
// record: hit points, resources, conditions and what a character is concentrating on are the same
// values during the battle and after it. An opponent is a stat block, written by hand or taken from
// a bestiary catalog, and lives in the encounter.
//
// What these slices deliberately leave for the ones after them, with the seams already in place:
//   - positions, distance, reach, ranges and movement. `economy.movement`, a block's `reach` and
//     `range`, and the condition effects that read distance are carried and not read.
//   - reactions and the windows they open, so `cannot-react` is carried and not read, and a catalog
//     entry marked `reaction` is left off the menu.
//   - the WINDOW a signature action is bought in, between one turn and the next. The points, the
//     options and the spending are here; what opens the window is the slice that builds reactions.
//   - who an opponent chooses to attack. Everything an enemy could do is on the same menu a player
//     picks from, which is what the enemy's own turn will read.

export * from "./types.js";
export { parseRulesetCombatDice, rollRulesetDice, rulesetAverageAmount, rulesetCombatRoller } from "./dice.js";
export {
  clampRulesetStatBlock,
  findRulesetCreature,
  findRulesetCreatureEntry,
  rulesetCreatureBlock,
  RULESET_CLAMP_HEADROOM,
  RULESET_CLAMP_MAX_ACTIONS,
  type RulesetClampedStatBlock,
} from "./creatures.js";
export {
  createRulesetEncounter,
  currentRulesetActor,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatEffects,
  rulesetCombatHealth,
  rulesetCombatStanding,
  type RulesetEncounterInput,
} from "./encounter.js";
export {
  planRulesetCombatCost,
  rulesetActionAvailable,
  rulesetAttackMode,
  rulesetCombatOptions,
  rulesetCostSteps,
  rulesetHitChance,
  rulesetPoolFamily,
  rulesetSignatureOptions,
  rulesetStandardBudget,
  type RulesetCombatCost,
} from "./options.js";
export {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  rulesetEncounterOutcome,
  rulesetEncounterSummary,
} from "./resolve.js";
