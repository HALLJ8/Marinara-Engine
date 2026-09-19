// ──────────────────────────────────────────────
// Game: the director's third style, a fight the ruleset resolves itself
// ──────────────────────────────────────────────
// The same ledger as the other two styles: one storage row, one revision, one request-id guard and
// one per-chat queue. Only what happens inside a step is different, and all of it goes through the
// pure resolver in `@marinara-engine/shared`: the menu decides legality, the dice come from the
// session's own seed and cursor, and everything a party member spends or loses is written through
// the sheet's own rules.
//
// Everything here is pure over `(definition, state)` so a regression can drive a whole fight with
// no database and no network. The two things that are not pure, reading the ruleset and writing the
// party's live sheet state back, live in the route.

import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  assignCombatTactics,
  chooseCombatCandidate,
  clampRulesetStatBlock,
  createRulesetEncounter,
  currentRulesetActor,
  findRulesetCreature,
  normalizeCharacterLookupName,
  normalizeGameDifficulty,
  readRulesetLive,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetCombatRoller,
  rulesetCreatureSchema,
  rulesetEncounterOutcome,
  rulesetEncounterSummary,
  rulesetOptionTargets,
  rulesetSheetBuildsByName,
  rulesetStatBlockFromCreature,
  rulesetTierStatBlock,
  type CombatAiCandidate,
  type Combatant,
  type CombatDecisionOption,
  type DirectedCommand,
  type DirectedRulesetCombatant,
  type DirectedRulesetOption,
  type DirectedRulesetView,
  type RulesetCatalogEntriesById,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatOption,
  type RulesetCombatant,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetLiveState,
  type RulesetLiveStates,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { combatDirectorView, type CombatDirectorState } from "./combat-director.service.js";

/** How many events a session keeps. A screen prints the tail and asks for nothing older, so the
 *  ledger row stays small however long a fight runs.
 *  ponytail: a fixed window. A fight that needs its whole history on screen wants the events in
 *  their own paged store, which is the upgrade path. */
export const RULESET_COMBAT_EVENT_LIMIT = 200;

/** How many lines the opponents' own build is allowed to leave behind. */
const RULESET_ADJUSTMENT_LIMIT = 60;

/** How many actions one turn of an actor nobody controls may take before the turn is ended anyway.
 *  Budgets already bound it; this is the belt beside the braces. */
const RULESET_TURN_ACTION_LIMIT = 12;

/** The fight itself, as the director's ledger stores it. Plain JSON by design: it is persisted, read
 *  back and resolved from exactly as it was left. */
export interface RulesetFightState {
  encounter: RulesetEncounterState;
  /** One per event ever produced, so a client prints only what it has not seen. */
  eventSeq: number;
  events: Array<{ seq: number; event: RulesetCombatEvent }>;
  /** Who plays each party member. An opponent is never in here. */
  controllers: Record<string, "manual" | "ai">;
  /** The opponents the client marked as bosses, which is what routes a turn to the Game Master. */
  bosses: string[];
  /** Every clamp and every fallback the opponents were built with, in plain words. */
  adjustments: string[];
}

export type RulesetCommandResult = { ok: true } | { ok: false; error: string; code: string };

const refuse = (error: string, code: string): RulesetCommandResult => ({ ok: false, error, code });

/** Where the fight stands, once a command has been applied: who is waited on, or that it is over. */
export function rulesetDirectorStage(state: CombatDirectorState): CombatDirectorState["stage"] {
  const fight = fightOf(state);
  if (!fight) return state.stage;
  if (state.outcome) return "finished";
  if (state.window) return "decision";
  const actor = currentRulesetActor(fight.encounter);
  return actor && rulesetController(state, fight, actor) === "manual" ? "action" : "select";
}

/** Where a command leaves the session. The director's own view is built once here, because that is
 *  what keeps the Engine's `party`, `enemies` and `CombatSummary` in step with the fight, and a
 *  fight that has ended has no decision open and nobody on turn. */
function settled(state: CombatDirectorState): RulesetCommandResult {
  combatDirectorView(state);
  if (state.outcome) {
    state.window = undefined;
    state.choices = [];
  }
  state.stage = rulesetDirectorStage(state);
  return { ok: true };
}

// ── Building the fight ──

export interface RulesetFightOpponent {
  id: string;
  name: string;
  /** A bestiary reference (`<catalogId>/<entryId>`) or a name, as the Game Master wrote it. */
  creature?: string;
  tier?: string;
  /** A stat block the Game Master proposed, in the shared creature form. Clamped onto the scale. */
  proposed?: unknown;
  boss?: boolean;
}

export interface RulesetFightSeed {
  definition: RulesetDefinition;
  seed: number;
  party: Array<{ id: string; name: string }>;
  enemies: RulesetFightOpponent[];
  /** The chat's own party cards, which is where a sheet build lives. */
  cards: unknown;
  playerName: string | null;
  /** The stored live sheet state of the whole game. */
  live: RulesetLiveStates | null;
  /** The catalogs the party's own rows came from, so the fight knows what an ability costs. */
  partyCatalogs: RulesetCatalogEntriesById;
  /** Every catalog of this ruleset that holds creatures. */
  bestiary: RulesetCatalogEntriesById;
}

export type RulesetFightSeedResult = { ok: true; fight: RulesetFightState } | { ok: false; error: string };

/**
 * A fight, ready for its first turn, or a plain sentence saying why it could not be built.
 *
 * The server decides what the fight is resolved by and what everybody's numbers are: a party
 * member's come off their own sheet, and an opponent's off a bestiary, off a clamped proposal or
 * off the ruleset's own threat scale, in that order. A client-sent sheet is never read.
 */
export function createRulesetFight(input: RulesetFightSeed): RulesetFightSeedResult {
  const { definition } = input;
  const combat = definition.combat;
  if (!combat) return { ok: false, error: "This game's ruleset does not resolve its own fights." };

  const adjustments: string[] = [];
  const builds = rulesetSheetBuildsByName(input.cards, input.playerName);
  const combatants: RulesetCombatantInput[] = [];
  for (const member of input.party) {
    const key = normalizeCharacterLookupName(member.name);
    const build = builds.get(key);
    if (!build) {
      return { ok: false, error: `${member.name} has no ruleset sheet, so this fight cannot read their numbers.` };
    }
    combatants.push({
      id: member.id,
      name: member.name,
      side: "party",
      build,
      live: input.live?.[key],
      catalogs: input.partyCatalogs,
    });
  }

  for (const opponent of input.enemies) {
    // By the reference the Game Master named, then by the opponent's own name, and no further: a
    // fight built on a near miss is worse than one the Engine says it could not build.
    const named = opponent.creature ? findRulesetCreature(input.bestiary, opponent.creature) : null;
    const found = named ?? findRulesetCreature(input.bestiary, opponent.name);
    if (opponent.creature && !named) {
      adjustments.push(
        found
          ? `No bestiary holds "${opponent.creature}", so ${opponent.name} was looked up by name.`
          : `No bestiary of this ruleset holds "${opponent.creature}".`,
      );
    }
    if (found) {
      combatants.push({
        id: opponent.id,
        name: opponent.name,
        side: "enemy",
        creature: { catalogId: found.catalogId, entryId: found.entry.id },
      });
      continue;
    }
    const proposed = opponent.proposed === undefined ? null : rulesetCreatureSchema.safeParse(opponent.proposed);
    if (proposed?.success) {
      const block = rulesetStatBlockFromCreature(definition, proposed.data);
      if (block) {
        const clamped = clampRulesetStatBlock(definition, block, opponent.tier ?? proposed.data.tier);
        for (const line of clamped.adjusted) adjustments.push(`${opponent.name}: ${line}`);
        combatants.push({ id: opponent.id, name: opponent.name, side: "enemy", block: clamped.block });
        continue;
      }
    }
    if (proposed && !proposed.success) {
      adjustments.push(`The proposed stat block for ${opponent.name} could not be read, so its tier was used.`);
    }
    const built = rulesetTierStatBlock(definition, opponent.tier, opponent.name);
    if (!built) {
      return {
        ok: false,
        error: `${opponent.name} is in no bestiary of this ruleset, carries no stat block, and the ruleset declares no threat tiers to build one from.`,
      };
    }
    if (opponent.tier && built.tier.id !== opponent.tier) {
      adjustments.push(`The tier "${opponent.tier}" is not on this ruleset's scale, so ${built.tier.label} was used.`);
    }
    adjustments.push(`${opponent.name} was built from the numbers of ${built.tier.label}.`);
    combatants.push({ id: opponent.id, name: opponent.name, side: "enemy", block: built.block });
  }

  const encounter = createRulesetEncounter({
    definition,
    seed: input.seed,
    combatants,
    bestiary: input.bestiary,
  });
  const fight: RulesetFightState = {
    encounter,
    eventSeq: 0,
    events: [],
    controllers: {},
    bosses: input.enemies.filter((opponent) => opponent.boss).map((opponent) => opponent.id),
    adjustments: adjustments.slice(0, RULESET_ADJUSTMENT_LIMIT),
  };
  record(fight, encounter.opening);
  for (const line of fight.adjustments) logger.info("[game/combat:ruleset] %s", line);
  return { ok: true, fight };
}

// ── Reading the fight ──

const fightOf = (state: CombatDirectorState): RulesetFightState | null =>
  state.style === "ruleset" ? (state.rulesetFight ?? null) : null;

function record(fight: RulesetFightState, events: readonly RulesetCombatEvent[]): void {
  for (const event of events) fight.events.push({ seq: ++fight.eventSeq, event });
  if (fight.events.length > RULESET_COMBAT_EVENT_LIMIT) {
    fight.events = fight.events.slice(-RULESET_COMBAT_EVENT_LIMIT);
  }
}

/** Who plays this combatant: the player, the Engine's own picker, or the Game Master. */
export function rulesetController(
  state: CombatDirectorState,
  fight: RulesetFightState,
  combatant: RulesetCombatant | undefined,
): "manual" | "ai" | "gm" {
  if (!combatant) return "ai";
  // A party member is the player's to play unless they handed them over.
  if (combatant.side === "party") return fight.controllers[combatant.id] === "ai" ? "ai" : "manual";
  return state.gm && fight.bosses.includes(combatant.id) ? "gm" : "ai";
}

/** The dice this fight throws next: the session's own seed, from the cursor the last step left. */
const rollerFor = (fight: RulesetFightState) => rulesetCombatRoller(fight.encounter.seed, fight.encounter.cursor);

/** The party's live sheet state, keyed the way the game stores it, so the caller can write it back
 *  where the sheet reads it. */
export function rulesetFightLiveStates(fight: RulesetFightState): RulesetLiveStates {
  const live: RulesetLiveStates = {};
  for (const combatant of fight.encounter.combatants) {
    if (!combatant.sheet) continue;
    live[normalizeCharacterLookupName(combatant.name)] = combatant.sheet.live as RulesetLiveState;
  }
  return live;
}

/**
 * The Engine's own `party` and `enemies` arrays, kept in step with the fight after every step: the
 * client's recap, the journal and the outcome the director reads all go through them, so they are
 * never allowed to drift from what the ruleset says.
 */
export function syncRulesetCombatants(definition: RulesetDefinition, state: CombatDirectorState): void {
  const fight = fightOf(state);
  const combat = definition.combat;
  if (!fight || !combat) return;
  // The ruleset decides who won, not the Engine's own hit points. They agree, because the numbers
  // below are the same numbers, but the ruleset is the one that is read.
  const outcome = rulesetEncounterOutcome(fight.encounter);
  if (!state.outcome && outcome !== "ongoing") state.outcome = outcome;
  const units = new Map<string, Combatant>();
  for (const unit of [...state.party, ...state.enemies]) units.set(unit.id, unit);
  for (const combatant of fight.encounter.combatants) {
    const unit = units.get(combatant.id);
    if (!unit) continue;
    const health = rulesetCombatHealth(definition, combat, combatant);
    unit.maxHp = Math.max(1, Math.floor(health.max));
    unit.hp = combatant.defeated ? 0 : Math.min(unit.maxHp, Math.max(0, Math.floor(health.value)));
    unit.statusEffects = conditionsOf(definition, combatant).map((condition) => ({
      name: condition.label,
      modifier: 0,
      stat: "hp" as const,
      turnsLeft: Math.min(100, Math.max(0, condition.rounds ?? 0)),
    }));
  }
}

function conditionsOf(
  definition: RulesetDefinition,
  combatant: RulesetCombatant,
): Array<{ id: string; label: string; rounds?: number }> {
  const declared = new Map(definition.sheet.live.conditions.map((entry) => [entry.id, entry.label]));
  const tracked = new Map(combatant.tracked.map((entry) => [entry.condition, entry.rounds]));
  return rulesetCombatConditions(definition, combatant).map((id) => {
    const rounds = tracked.get(id);
    return {
      id,
      label: declared.get(id) ?? id,
      ...(typeof rounds === "number" ? { rounds } : {}),
    };
  });
}

function deathTrackOf(definition: RulesetDefinition, combatant: RulesetCombatant) {
  const dying = definition.combat?.dying;
  if (!dying || !combatant.sheet) return undefined;
  const live = readRulesetLive(definition, combatant.sheet.build, combatant.sheet.live);
  const value = (track: string) => live.tracks.find((entry) => entry.id === track)?.value ?? 0;
  const max = (track: string) => definition.sheet.live.tracks.find((entry) => entry.id === track)?.max ?? 0;
  return {
    successes: value(dying.successes),
    failures: value(dying.failures),
    successesMax: max(dying.successes),
    failuresMax: max(dying.failures),
  };
}

function projectCombatant(definition: RulesetDefinition, combatant: RulesetCombatant): DirectedRulesetCombatant {
  const combat = definition.combat!;
  const health = rulesetCombatHealth(definition, combat, combatant);
  const deathTrack = deathTrackOf(definition, combatant);
  return {
    id: combatant.id,
    name: combatant.name,
    side: combatant.side,
    initiative: combatant.initiative,
    health,
    defense: combatant.defense,
    conditions: conditionsOf(definition, combatant),
    budgets: { ...combatant.budgets },
    down: combatant.down,
    dying: combatant.dying,
    stable: combatant.stable,
    defeated: combatant.defeated,
    ...(deathTrack ? { deathTrack } : {}),
    ...(combatant.concentrating ? { concentrating: combatant.concentrating.label } : {}),
    ...(combatant.block?.tier ? { tier: combatant.block.tier } : {}),
    ...(combatant.block?.traits?.length ? { traits: combatant.block.traits.map((trait) => ({ ...trait })) } : {}),
  };
}

/** Every option of the legal menu, with the combatants each one may be pointed at right now. */
export function rulesetMenu(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
): DirectedRulesetOption[] {
  return rulesetCombatOptions(definition, encounter, actorId).map((option) => ({
    ...option,
    targetIds: rulesetOptionTargets(encounter, actorId, option),
  }));
}

/** The fight as a screen reads it. A projection: no sheet build, no live blob and no catalogs. */
export function directedRulesetView(
  definition: RulesetDefinition,
  state: CombatDirectorState,
): DirectedRulesetView | undefined {
  const fight = fightOf(state);
  if (!fight || !definition.combat) return undefined;
  const encounter = fight.encounter;
  const actor = currentRulesetActor(encounter);
  const controller = rulesetController(state, fight, actor);
  const over = !!state.outcome || rulesetEncounterOutcome(encounter) !== "ongoing";
  return {
    ruleset: { ...encounter.ruleset },
    round: encounter.round,
    order: [...encounter.order],
    ...(actor && !over ? { actorId: actor.id } : {}),
    controller,
    combatants: encounter.combatants.map((combatant) => projectCombatant(definition, combatant)),
    ...(actor && !over && controller === "manual" && !state.window
      ? { options: rulesetMenu(definition, encounter, actor.id) }
      : {}),
    events: fight.events.map((entry) => ({ seq: entry.seq, event: entry.event })),
    ...(over ? { summary: rulesetEncounterSummary(definition, encounter) } : {}),
    adjustments: [...fight.adjustments],
  };
}

// ── Choosing, for everybody no human plays ──

interface RulesetCandidate {
  choice: RulesetCombatChoice;
  option: RulesetCombatOption;
  targetId?: string;
}

/**
 * Everything the actor could do, scored the way every other combat AI in the Engine is scored.
 * The menu is the only source of legality, so the picker can never choose something a player could
 * not, and the option's own forecast is the only thing it is allowed to know about the dice.
 */
function rulesetCandidates(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
  /** The Game Master's window is shown everything; the Engine's own picker is not (see the end). */
  everything = false,
): Array<CombatAiCandidate<RulesetCandidate>> {
  const combat = definition.combat;
  const actor = rulesetCombatant(encounter, actorId);
  if (!combat || !actor) return [];
  const candidates: Array<CombatAiCandidate<RulesetCandidate>> = [];
  for (const option of rulesetCombatOptions(definition, encounter, actorId)) {
    const price = (option.cost ?? []).reduce((total, entry) => total + entry.amount, 0) + (option.signature?.cost ?? 0);
    if (option.kind === "end-turn") {
      candidates.push({ action: { choice: { actorId, optionId: option.id, targetIds: [] }, option }, hold: true });
      continue;
    }
    if (option.targets.count <= 0) {
      // Holding the thing it is already holding would end it and start it again for the same price.
      if (actor.concentrating?.actionId === option.id) continue;
      candidates.push({
        action: { choice: { actorId, optionId: option.id, targetIds: [] }, option },
        setup: option.kind === "standard" ? 0.05 : 0.4,
        cost: price,
      });
      continue;
    }
    const legal = rulesetOptionTargets(encounter, actorId, option);
    // An action made of other actions sends all of them at one opponent. Anything else that may
    // take several targets takes as many as it is allowed: a breath that could catch three people
    // and is pointed at one is an opponent played badly, not an opponent played kindly.
    const spreads = option.targets.count > 1 && !actor.actions.find((entry) => entry.id === option.id)?.sequence;
    for (const targetId of legal) {
      const target = rulesetCombatant(encounter, targetId);
      if (!target) continue;
      // Whose side the TARGET is on, not whose side the option was written for: an author may let a
      // blast reach either side, and a fight where the Engine drops one on its own party is worse
      // than one where it never does.
      const ally = target.side === actor.side;
      const health = rulesetCombatHealth(definition, combat, target);
      const pool = Math.max(1, health.value + health.temp);
      const chance = option.forecast?.hitChance ?? 1;
      const average = option.forecast?.averageDamage ?? 0;
      const candidate: CombatAiCandidate<RulesetCandidate> = {
        action: { choice: { actorId, optionId: option.id, targetIds: [targetId] }, option, targetId },
        targetId,
        cost: price,
      };
      if (option.heals) {
        // Never on the other side, and never on somebody with nothing to gain by it.
        if (!ally || (health.value >= health.max && !target.down)) continue;
        candidate.healing = Math.min(1, average / Math.max(1, health.max)) + (target.down ? 1 : 0);
      } else if (average > 0) {
        // Never its own side, and never somebody who is already down: the rules let a blow land on
        // them, and a table where every opponent finishes off the dying is not one anybody plays
        // at. A human may still choose it; nothing the Engine enumerates for itself or for a Game
        // Master's boss includes it.
        if (ally || target.down) continue;
        const others = spreads
          ? legal
              .filter((id) => id !== targetId)
              .map((id) => rulesetCombatant(encounter, id))
              .filter((other): other is RulesetCombatant => !!other && other.side !== actor.side && !other.down)
              .slice(0, option.targets.count - 1)
          : [];
        candidate.action.choice.targetIds = [targetId, ...others.map((other) => other.id)];
        candidate.damage = Math.min(2, (average / pool) * (1 + others.length)) * chance;
        if (average >= pool) candidate.finish = chance;
      } else if (ally) candidate.support = 0.4;
      else candidate.setup = 0.4;
      candidates.push(candidate);
    }
  }
  // Somebody who can hurt an opponent or help a friend does that. The scoring weighs a blow by the
  // share of the target's health it takes, so against a sturdy target a careful creature would score
  // a standard action (dodging, say) above every attack it has and stand there all fight. A
  // standard action or an empty turn is what is left when there is nothing better, never a rival.
  const useful = candidates.filter((candidate) => (candidate.damage ?? 0) > 0 || (candidate.healing ?? 0) > 0);
  if (useful.length > 0 && !everything) {
    return candidates.filter((candidate) => !candidate.hold && candidate.action.option.kind !== "standard");
  }
  return candidates;
}

/** The choice the picker would make, or null when the actor has nothing at all to pick from. */
function pickRulesetChoice(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  encounter: RulesetEncounterState,
  actorId: string,
): RulesetCandidate | null {
  const candidates = rulesetCandidates(definition, encounter, actorId);
  if (candidates.length === 0) return null;
  const unit = [...state.party, ...state.enemies].find((entry) => entry.id === actorId);
  if (!unit) return candidates[0]!.action;
  unit.tactics ??= assignCombatTactics(unit, state.seed);
  return chooseCombatCandidate(unit, candidates, encounter.round, normalizeGameDifficulty(state.difficulty));
}

// ── One step ──

function applyChoice(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  choice: RulesetCombatChoice,
): { refused: RulesetCombatEvent | null } {
  const step = applyRulesetCombatChoice(definition, fight.encounter, choice, rollerFor(fight));
  const refused = step.events.find((event) => event.type === "refused") ?? null;
  // A refusal changes nothing and bumps nothing: the state it was given is the state it hands back.
  if (refused) return { refused };
  fight.encounter = step.state;
  record(fight, step.events);
  syncRulesetCombatants(definition, state);
  return { refused: null };
}

function advanceTurn(definition: RulesetDefinition, state: CombatDirectorState, fight: RulesetFightState): void {
  // A fight that is over has no next turn, and saying so a second time would print the outcome twice.
  if (rulesetEncounterOutcome(fight.encounter) !== "ongoing") return;
  const step = advanceRulesetTurn(definition, fight.encounter, rollerFor(fight));
  fight.encounter = step.state;
  record(fight, step.events);
  // A fresh round hands the Game Master its calls back, exactly as the other two styles do.
  if (step.events.some((event) => event.type === "round")) state.gmCalls = 0;
  syncRulesetCombatants(definition, state);
}

/** One whole turn of an actor no human plays: every action it takes, and then the end of its turn. */
function playRulesetTurn(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): void {
  for (let action = 0; action < RULESET_TURN_ACTION_LIMIT; action++) {
    if (rulesetEncounterOutcome(fight.encounter) !== "ongoing") break;
    const picked = pickRulesetChoice(definition, state, fight.encounter, actorId);
    if (!picked || picked.option.kind === "end-turn") break;
    // A refusal here would be an Engine bug rather than a player's mistake, so the turn ends
    // instead of asking again with the same state and looping.
    if (applyChoice(definition, state, fight, picked.choice).refused) break;
  }
  advanceTurn(definition, state, fight);
}

// ── The Game Master's window ──

const windowKind = (kind: RulesetCombatOption["kind"]): CombatDecisionOption["kind"] =>
  kind === "ability" ? "skill" : kind === "standard" ? "defend" : kind === "end-turn" ? "wait" : "attack";

/** One `CombatDecisionOption` per candidate, carrying the ruleset's own id, targets and label so the
 *  answer the Game Master picks resolves straight back through the menu. */
function windowOptions(
  definition: RulesetDefinition,
  encounter: RulesetEncounterState,
  actorId: string,
): CombatDecisionOption[] {
  return rulesetCandidates(definition, encounter, actorId, true).map((candidate, index) => ({
    id: String(index),
    kind: windowKind(candidate.action.option.kind),
    actorId,
    ...(candidate.action.targetId ? { targetId: candidate.action.targetId } : {}),
    mpCost: 0,
    legendaryCost: 0,
    optionId: candidate.action.option.id,
    targetIds: [...candidate.action.choice.targetIds],
    label: candidate.action.option.label,
  }));
}

function openRulesetWindow(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): boolean {
  const options = windowOptions(definition, fight.encounter, actorId);
  // Nothing but the end of the turn left: there is no decision worth a model call.
  if (options.length <= 1) return false;
  state.choices = options;
  state.window = {
    id: `${state.id}:${++state.serial}`,
    kind: "ordinary",
    actorId,
    controller: "gm",
    options,
  };
  state.stage = "decision";
  return true;
}

function closeWindow(state: CombatDirectorState): void {
  state.window = undefined;
  state.choices = [];
}

/** After an opponent the Game Master plays has acted: another decision while it still has one, and
 *  otherwise the end of its turn. */
function continueBossTurn(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  fight: RulesetFightState,
  actorId: string,
): void {
  if (
    rulesetEncounterOutcome(fight.encounter) === "ongoing" &&
    currentRulesetActor(fight.encounter)?.id === actorId &&
    openRulesetWindow(definition, state, fight, actorId)
  ) {
    return;
  }
  if (currentRulesetActor(fight.encounter)?.id === actorId) advanceTurn(definition, state, fight);
}

// ── Commands ──

/**
 * One command against a ruleset fight. Never throws: a refusal changes nothing, bumps nothing and
 * comes back with the resolver's own reason in a stable code, so a client can say why.
 *
 * `source` is who the answer came from, exactly as the other styles record it.
 */
export function commandRulesetCombatDirector(
  definition: RulesetDefinition,
  state: CombatDirectorState,
  command: DirectedCommand,
  source: "gm" | "ai" | "manual" | "fallback" = "manual",
): RulesetCommandResult {
  const fight = fightOf(state);
  if (!fight) return refuse("This battle is not resolved by a ruleset.", "ruleset_combat_not_a_ruleset_fight");
  if (!definition.combat)
    return refuse("This game's ruleset no longer resolves its own fights.", "ruleset_combat_no_block");
  if (state.outcome) return refuse("Battle already finished.", "ruleset_combat_encounter-over");

  if (command.type === "begin" || command.type === "classic" || command.type === "tactical") {
    return refuse("Action does not match this combat mode.", "ruleset_combat_wrong_style");
  }

  if (command.type === "flee") {
    state.outcome = "flee";
    return settled(state);
  }

  if (command.type === "control") {
    const combatant = rulesetCombatant(fight.encounter, command.unitId);
    if (!combatant || combatant.side !== "party") {
      return refuse("Only a party member has a controller.", "ruleset_combat_unknown-actor");
    }
    if (state.window) return refuse("Resolve the open decision first.", "ruleset_combat_decision_open");
    fight.controllers[combatant.id] = command.controller;
    return settled(state);
  }

  const actor = currentRulesetActor(fight.encounter);
  if (!actor) return refuse("Nobody is on turn.", "ruleset_combat_unknown-actor");
  const controller = rulesetController(state, fight, actor);

  if (command.type === "ruleset") {
    if (state.window) return refuse("Resolve the open decision first.", "ruleset_combat_decision_open");
    if (controller !== "manual") return refuse("This turn is not yours to play.", "ruleset_combat_not-your-turn");
    const step = applyChoice(definition, state, fight, {
      actorId: actor.id,
      optionId: command.optionId,
      targetIds: command.targetIds,
      ...(command.payWith !== undefined ? { payWith: command.payWith } : {}),
    });
    if (step.refused && step.refused.type === "refused") {
      return refuse(rulesetRefusalMessage(step.refused.reason), `ruleset_combat_${step.refused.reason}`);
    }
    return settled(state);
  }

  if (command.type === "choose" || command.type === "fallback") {
    const open = state.window;
    if (!open) return refuse("No decision is pending.", "ruleset_combat_no_decision");
    const chosen =
      command.type === "choose" ? open.options.find((option) => option.id === command.candidateId) : undefined;
    if (command.type === "choose" && !chosen) {
      return refuse("Unknown decision option.", "ruleset_combat_unknown-option");
    }
    const actorId = open.actorId;
    closeWindow(state);
    const choice: RulesetCombatChoice | null = chosen
      ? {
          actorId,
          optionId: chosen.optionId ?? "end-turn",
          targetIds: [...(chosen.targetIds ?? [])],
          ...(chosen.payWith !== undefined ? { payWith: chosen.payWith } : {}),
        }
      : // The local picker is the fallback, so a Game Master that answered nothing usable costs the
        // fight nothing but the model call.
        (pickRulesetChoice(definition, state, fight.encounter, actorId)?.choice ?? null);
    if (choice && choice.optionId !== "end-turn") {
      const step = applyChoice(definition, state, fight, choice);
      if (step.refused) {
        logger.warn(
          "[game/combat:ruleset] A %s decision for %s was refused by the rules and the turn was ended",
          source,
          actorId,
        );
        if (currentRulesetActor(fight.encounter)?.id === actorId) advanceTurn(definition, state, fight);
        return settled(state);
      }
    }
    continueBossTurn(definition, state, fight, actorId);
    return settled(state);
  }

  // `continue`: one whole turn of whoever the player is not playing.
  if (state.window) return { ok: true };
  if (controller === "manual") return settled(state);
  if (controller === "gm" && openRulesetWindow(definition, state, fight, actor.id)) return { ok: true };
  playRulesetTurn(definition, state, fight, actor.id);
  return settled(state);
}

/** The resolver's own reason, in a sentence a player can read. The code beside it is what a client
 *  keys off; this is only what it says when it has nothing better. */
function rulesetRefusalMessage(reason: string): string {
  const said: Record<string, string> = {
    "encounter-over": "This fight is already over.",
    "unknown-actor": "That combatant is not in this fight.",
    "not-your-turn": "It is not their turn.",
    "unknown-option": "That is not on the menu.",
    "cannot-act": "They cannot act right now.",
    down: "They are down.",
    "bad-target": "That is not a legal target for this.",
    "no-budget": "They have nothing left to spend on it this turn.",
    insufficient: "They cannot pay for it.",
    "bad-pool": "That is not a pool this can be paid from.",
    "unknown-creature": "That opponent is not in any bestiary this game can read.",
  };
  return said[reason] ?? "The rules refused that choice.";
}
