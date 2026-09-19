// The rules a ruleset fight's menu is drawn and driven by, with no React in them.
//
// The server sends the only legal menu there is: every option on it can be taken right now, and
// each one lists exactly who it may be pointed at. Nothing here decides legality or does any
// arithmetic; it groups what arrived, spells what an option spends out of the words the option
// carries, and keeps a player's picking inside the option's own list and count.
import type { DirectedRulesetOption } from "@marinara-engine/shared";
import type { TFunction } from "i18next";

/** The order a menu reads in: what you swing, what you cast, what a stat block can do, the moves
 *  the kind implements, and finally ending the turn. */
export const RULESET_MENU_KINDS = ["attack", "ability", "block", "standard", "end-turn"] as const;

export type RulesetMenuKind = (typeof RULESET_MENU_KINDS)[number];

export interface RulesetMenuGroup {
  kind: RulesetMenuKind;
  /** The heading key for this group, so a caller never builds one by hand. */
  labelKey: string;
  options: DirectedRulesetOption[];
}

/** The menu in groups, in a fixed order, with empty groups left out. An option whose kind is not
 *  one this Engine knows is dropped rather than shown without a heading. */
export function rulesetMenuGroups(options: DirectedRulesetOption[] | undefined): RulesetMenuGroup[] {
  const groups: RulesetMenuGroup[] = [];
  for (const kind of RULESET_MENU_KINDS) {
    const found = (options ?? []).filter((option) => option.kind === kind);
    if (found.length === 0) continue;
    groups.push({
      kind,
      labelKey: `game.combat.ruleset.group.${kind === "end-turn" ? "endTurn" : kind}`,
      options: found,
    });
  }
  return groups;
}

/** What one option spends, in the ruleset's own words: its budget, the pools it draws on, and how
 *  many times it is left. Every name comes off the option the server built. */
export function rulesetOptionCostText(
  option: DirectedRulesetOption,
  budgetLabel: (id: string) => string,
  t: TFunction,
): string {
  const parts: string[] = [];
  if (option.budget) parts.push(t("game.combat.ruleset.option.spends", { budget: budgetLabel(option.budget) }));
  for (const cost of option.cost ?? []) {
    parts.push(t("game.combat.ruleset.option.cost", { amount: cost.amount, pool: cost.label }));
  }
  if (option.signature) {
    parts.push(
      t("game.combat.ruleset.option.signature", { cost: option.signature.cost, points: option.signature.points }),
    );
  }
  if (typeof option.left === "number") parts.push(t("game.combat.ruleset.option.left", { left: option.left }));
  return parts.join(" · ");
}

/** What the option is expected to do, in words. The server computed both numbers; a screen that
 *  worked out its own chance to hit could disagree with the fight it is describing. */
export function rulesetOptionForecastText(option: DirectedRulesetOption, t: TFunction): string {
  const parts: string[] = [];
  const forecast = option.forecast;
  if (typeof forecast?.hitChance === "number") {
    parts.push(t("game.combat.ruleset.option.forecastHit", { percent: Math.round(forecast.hitChance * 100) }));
  }
  if (typeof forecast?.averageDamage === "number") {
    parts.push(
      t(option.heals ? "game.combat.ruleset.option.forecastHeal" : "game.combat.ruleset.option.forecastDamage", {
        amount: Math.round(forecast.averageDamage),
      }),
    );
  }
  return parts.join(", ");
}

/** Whether taking this option asks the player to point it at anybody at all. An option with
 *  nothing legal to hit is still on the menu, and taking it simply sends no targets. */
export function rulesetOptionNeedsTargets(option: DirectedRulesetOption): boolean {
  // Something aimed at the actor themselves is not a choice, so it is never a picking step.
  if (option.targets.side === "self") return false;
  return option.targets.count > 0 && option.targetIds.length > 0;
}

/** The targets a player has picked after clicking one more. Only ids the option itself lists can
 *  be picked, clicking a picked one takes it off again, and the option's own count is the ceiling. */
export function rulesetPickTarget(option: DirectedRulesetOption, picked: string[], id: string): string[] {
  if (!option.targetIds.includes(id)) return picked;
  if (picked.includes(id)) return picked.filter((entry) => entry !== id);
  if (picked.length >= option.targets.count) return picked;
  return [...picked, id];
}

/** What is sent for an option that takes no picking: whoever it is already pointed at. */
export function rulesetDefaultTargets(option: DirectedRulesetOption): string[] {
  if (rulesetOptionNeedsTargets(option)) return [];
  return option.targetIds.slice(0, Math.max(0, option.targets.count));
}

/** Whether one more pick sends the choice on its own. One target and one allowed is a single tap;
 *  anything that may take several is confirmed, so a second target is still reachable. */
export function rulesetSendsOnPick(option: DirectedRulesetOption): boolean {
  return option.targets.count === 1;
}
