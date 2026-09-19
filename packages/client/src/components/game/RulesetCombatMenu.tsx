// The menu of a fight the ruleset resolves: what the actor on turn may do, who they may do it to,
// and which pool pays for it.
//
// Every option on screen came off the server's own legal menu, with its own label, its own costs,
// its own forecast and the exact ids it may be pointed at. Nothing here works out whether something
// is allowed, what it would cost or how likely it is to land: an option the rules do not allow is
// simply not sent, so nothing is ever greyed out by this file.
import { useEffect, useMemo, useRef, useState } from "react";
import type { DirectedRulesetOption, DirectedRulesetView } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import {
  rulesetDefaultTargets,
  rulesetMenuGroups,
  rulesetOptionCostText,
  rulesetOptionForecastText,
  rulesetOptionLabel,
  rulesetOptionNeedsTargets,
  rulesetPickTarget,
  rulesetSendsOnPick,
} from "../../lib/ruleset-combat-menu";
import { cn } from "../../lib/utils";

export interface RulesetCombatMenuProps {
  view: DirectedRulesetView;
  /** The ruleset's own name for a budget id, so the menu says "Bonus action" or "Action" as the
   *  file does, never a word this Engine picked. */
  budgetLabel: (id: string) => string;
  busy: boolean;
  onChoose: (optionId: string, targetIds: string[], payWith?: string) => void;
  /** Walking away. The ruleset's menu never carries it, because leaving is not a thing the rules
   *  resolve: it is the director ending the session, exactly as the other two styles end it. */
  onFlee: () => void;
}

/** Where a half-made choice is: deciding what pays for it, or deciding who it is pointed at. */
type Step = { stage: "pay" | "target"; option: DirectedRulesetOption; payWith?: string; targets: string[] };

const buttonClass =
  "min-h-11 rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50";

export function RulesetCombatMenu({ view, budgetLabel, busy, onChoose, onFlee }: RulesetCombatMenuProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const actorName = view.combatants.find((combatant) => combatant.id === view.actorId)?.name ?? "";
  const groups = useMemo(() => rulesetMenuGroups(view.options), [view.options]);
  // A fresh menu is a fresh choice: the turn moved on, so a half-finished pick from the last one
  // must never be sent against it.
  useEffect(() => {
    setStep(null);
  }, [view.actorId, view.round]);
  useEffect(() => {
    if (step) first.current?.focus();
  }, [step]);

  if (!view.options) {
    return (
      <p className="px-3 py-2 text-xs text-white/55" role="status">
        {actorName
          ? t("game.combat.ruleset.menu.waiting", { name: actorName })
          : t("game.combat.ruleset.menu.waitingAnybody")}
      </p>
    );
  }

  const send = (option: DirectedRulesetOption, targets: string[], payWith?: string) => {
    setStep(null);
    onChoose(option.id, targets, payWith);
  };
  const take = (option: DirectedRulesetOption) => {
    if (option.payWith && option.payWith.length > 0) {
      setStep({ stage: "pay", option, targets: [] });
      return;
    }
    if (rulesetOptionNeedsTargets(option)) {
      setStep({ stage: "target", option, targets: [] });
      return;
    }
    send(option, rulesetDefaultTargets(option));
  };
  const paid = (payWith?: string) => {
    if (!step) return;
    if (!rulesetOptionNeedsTargets(step.option)) {
      send(step.option, rulesetDefaultTargets(step.option), payWith);
      return;
    }
    setStep({ ...step, stage: "target", ...(payWith ? { payWith } : {}), targets: [] });
  };
  const pick = (id: string) => {
    if (!step) return;
    const targets = rulesetPickTarget(step.option, step.targets, id);
    if (rulesetSendsOnPick(step.option) && targets.length === 1) {
      send(step.option, targets, step.payWith);
      return;
    }
    setStep({ ...step, targets });
  };

  // ── Paying for it out of another pool of the family ──
  const pools = step?.stage === "pay" ? (step.option.payWith ?? []) : [];
  if (step && pools.length > 0) {
    const option = step.option;
    return (
      <div className="flex flex-col gap-2 p-3">
        <p className="text-xs text-white/60">
          {t("game.combat.ruleset.upcast.prompt", { label: rulesetOptionLabel(option, t) })}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            ref={first}
            type="button"
            disabled={busy}
            onClick={() => paid(undefined)}
            className={cn(buttonClass, "border-white/15 bg-white/5 text-white/85 hover:bg-white/10")}
          >
            {t("game.combat.ruleset.upcast.own", { cost: rulesetOptionCostText(option, budgetLabel, t) })}
          </button>
          {pools.map((pool) => (
            <button
              key={pool}
              type="button"
              disabled={busy}
              onClick={() => paid(pool)}
              className={cn(buttonClass, "border-blue-400/25 bg-blue-500/10 text-white/85 hover:bg-blue-500/20")}
            >
              {t("game.combat.ruleset.upcast.pool", { pool })}
            </button>
          ))}
        </div>
        <BackButton onClick={() => setStep(null)} label={t("game.combat.ruleset.target.back")} />
      </div>
    );
  }

  // ── Pointing it at somebody ──
  if (step?.stage === "target" && rulesetOptionNeedsTargets(step.option)) {
    const option = step.option;
    const many = option.targets.count > 1;
    const targets = view.combatants.filter((combatant) => option.targetIds.includes(combatant.id));
    return (
      <div className="flex flex-col gap-2 p-3">
        <p className="text-xs text-amber-200" id="ruleset-target-prompt">
          {many
            ? t("game.combat.ruleset.target.promptMany", {
                label: rulesetOptionLabel(option, t),
                count: option.targets.count,
              })
            : t("game.combat.ruleset.target.prompt", { label: rulesetOptionLabel(option, t) })}
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ruleset-target-prompt">
          {targets.map((combatant, index) => {
            const picked = step.targets.includes(combatant.id);
            return (
              <button
                ref={index === 0 ? first : undefined}
                key={combatant.id}
                type="button"
                disabled={busy}
                aria-pressed={many ? picked : undefined}
                onClick={() => pick(combatant.id)}
                className={cn(
                  buttonClass,
                  picked
                    ? "border-[var(--primary)]/60 bg-[var(--primary)]/25 text-white"
                    : combatant.side === "enemy"
                      ? "border-amber-400/30 bg-amber-500/10 text-white/85 hover:bg-amber-500/20"
                      : "border-blue-400/30 bg-blue-500/10 text-white/85 hover:bg-blue-500/20",
                )}
              >
                <span className="block font-semibold">{combatant.name}</span>
                <span className="mt-0.5 block text-[0.65rem] tabular-nums text-white/55">
                  {t("game.combat.ruleset.status.health", {
                    value: combatant.health.value,
                    max: combatant.health.max,
                  })}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {many && (
            <button
              type="button"
              disabled={busy || step.targets.length === 0}
              onClick={() => send(option, step.targets, step.payWith)}
              className={cn(buttonClass, "border-[var(--primary)]/50 bg-[var(--primary)]/20 text-white")}
            >
              {t("game.combat.ruleset.target.confirm", { count: step.targets.length })}
            </button>
          )}
          <BackButton onClick={() => setStep(null)} label={t("game.combat.ruleset.target.back")} />
        </div>
      </div>
    );
  }

  // ── The menu itself ──
  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-[0.65rem] uppercase tracking-wide text-white/45">
        {t("game.combat.ruleset.menu.title", { name: actorName })}
      </p>
      {groups.map((group) => (
        <section key={group.kind} className="flex flex-col gap-1.5">
          <h4 className="text-[0.6rem] font-semibold uppercase tracking-wide text-white/40">{t(group.labelKey)}</h4>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const cost = rulesetOptionCostText(option, budgetLabel, t);
              const forecast = rulesetOptionForecastText(option, t);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={busy}
                  onClick={() => take(option)}
                  className={cn(
                    buttonClass,
                    "border-white/10 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span className="block font-semibold text-white/90">{rulesetOptionLabel(option, t)}</span>
                  {cost && <span className="mt-0.5 block text-[0.65rem] text-white/45">{cost}</span>}
                  {forecast && <span className="block text-[0.65rem] text-white/45">{forecast}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={onFlee}
          className={cn(buttonClass, "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white")}
        >
          {t("game.combat.ruleset.menu.flee")}
        </button>
      </div>
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded border border-white/15 px-3 text-xs text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
    >
      {label}
    </button>
  );
}
