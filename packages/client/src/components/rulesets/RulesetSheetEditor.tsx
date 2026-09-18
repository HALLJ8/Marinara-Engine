// Generic editor for a Game Mode ruleset character sheet. Everything it shows comes from the
// ruleset definition: no ruleset ships client code, and nothing here knows a system by name.
// Values are clamped to the ruleset's bounds when they are edited, never when they are read.
import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  isRulesetItemHidden,
  type RulesetDefinition,
  type RulesetField,
  type RulesetListColumn,
  type RulesetSheetBuild,
  type RulesetSheetEnvelope,
} from "@marinara-engine/shared";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { DraftTextarea } from "../ui/DraftTextarea";

type Scalar = number | string | boolean;
type ListRow = Record<string, Scalar>;

const inputClass =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs text-[var(--foreground)]";
const labelClass = "text-[0.6875rem] font-medium text-[var(--muted-foreground)]";

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The build an envelope carries, completed with the ruleset's defaults for anything it lacks. */
function readBuild(definition: RulesetDefinition, envelope: RulesetSheetEnvelope | undefined): RulesetSheetBuild {
  const defaults = defaultRulesetSheetBuild(definition);
  const build = envelope?.build;
  if (!build) return defaults;
  return {
    ...build,
    abilities: { ...defaults.abilities, ...build.abilities },
    skills: { ...build.skills },
    saves: { ...build.saves },
    bonuses: { ...build.bonuses },
    fields: { ...defaults.fields, ...build.fields },
    lists: { ...build.lists },
  };
}

function TypedInput({
  spec,
  value,
  onChange,
  ariaLabel,
}: {
  spec: RulesetField | RulesetListColumn;
  value: Scalar | undefined;
  onChange: (value: Scalar) => void;
  ariaLabel: string;
}) {
  if (spec.type === "number") {
    return (
      <DraftNumberInput
        value={
          typeof value === "number" && Number.isFinite(value) ? value : (spec.default ?? clamp(0, spec.min, spec.max))
        }
        onCommit={(next) => onChange(clamp(next, spec.min, spec.max))}
        min={spec.min}
        max={spec.max}
        integer={spec.integer}
        ariaLabel={ariaLabel}
        className={`${inputClass} text-center`}
      />
    );
  }
  if (spec.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={ariaLabel}
        className="h-4 w-4 accent-[var(--primary)]"
      />
    );
  }
  if (spec.type === "enum") {
    // On purpose the control shows the value the sheet EVALUATES to. A stored string the ruleset
    // no longer offers reads as the default in the sheet math, so showing the stale string beside
    // modifiers computed from the default would misreport them. The stored string itself is left
    // untouched until the user picks a value.
    const current = typeof value === "string" && spec.values.includes(value) ? value : (spec.default ?? spec.values[0]);
    return (
      <select
        value={current}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        className={inputClass}
      >
        {spec.values.map((option) => (
          <option key={option} value={option}>
            {spec.valueLabels?.[option] ?? option}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "longtext") {
    return (
      <DraftTextarea
        value={typeof value === "string" ? value : ""}
        onCommit={(next) => onChange(next.slice(0, spec.maxLength))}
        maxLength={spec.maxLength}
        rows={2}
        aria-label={ariaLabel}
        className={inputClass}
      />
    );
  }
  const maxLength = spec.type === "text" ? spec.maxLength : 40;
  return (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
      maxLength={maxLength}
      placeholder={spec.type === "dice" ? spec.example : undefined}
      aria-label={ariaLabel}
      className={inputClass}
    />
  );
}

function TrainedRows({
  title,
  entries,
  tiers,
  chosen,
  modifiers,
  bonuses,
  bonusRange,
  definition,
  onTier,
  onBonus,
}: {
  title: string;
  entries: RulesetDefinition["sheet"]["skills"];
  tiers: RulesetDefinition["resolution"]["proficiencyTiers"];
  chosen: Record<string, string>;
  modifiers: Record<string, number>;
  bonuses: Record<string, number>;
  bonusRange: { min: number; max: number };
  definition: RulesetDefinition;
  onTier: (id: string, tier: string) => void;
  onBonus: (id: string, bonus: number) => void;
}) {
  const { t } = useUiTranslation();
  if (entries.length === 0) return null;
  const abilityShort = (id: string | undefined) => {
    const ability = definition.sheet.abilities.find((entry) => entry.id === id);
    return ability ? (ability.short ?? ability.label) : "";
  };
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-[var(--foreground)]">{title}</h4>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,7rem)_3.25rem_2.25rem] items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1"
          >
            <span className="min-w-0 truncate text-xs text-[var(--foreground)]" title={entry.label}>
              {entry.label}
              {entry.ability ? (
                <span className="ml-1 text-[var(--muted-foreground)]">{abilityShort(entry.ability)}</span>
              ) : null}
            </span>
            <select
              value={chosen[entry.id] ?? tiers[0]!.id}
              onChange={(event) => onTier(entry.id, event.target.value)}
              aria-label={t("ui.rulesets.sheet.trainingFor", { name: entry.label })}
              className={inputClass}
            >
              {[
                ...tiers,
                // A stored tier the editor no longer offers still shows as what it is.
                ...definition.resolution.proficiencyTiers.filter(
                  (tier) => tier.id === chosen[entry.id] && !tiers.some((offeredTier) => offeredTier.id === tier.id),
                ),
              ].map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.label}
                </option>
              ))}
            </select>
            <DraftNumberInput
              value={bonuses[entry.id] ?? 0}
              onCommit={(next) => onBonus(entry.id, clamp(next, bonusRange.min, bonusRange.max))}
              min={bonusRange.min}
              max={bonusRange.max}
              integer
              ariaLabel={t("ui.rulesets.sheet.bonusFor", { name: entry.label })}
              title={t("ui.rulesets.sheet.bonusHint")}
              className={`${inputClass} text-center`}
            />
            <span className="text-right text-xs font-semibold tabular-nums text-[var(--foreground)]">
              {signed(modifiers[entry.id] ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RulesetSheetEditor({
  definition,
  envelope,
  onChange,
}: {
  definition: RulesetDefinition;
  envelope: RulesetSheetEnvelope | undefined;
  onChange: (envelope: RulesetSheetEnvelope) => void;
}) {
  const { t } = useUiTranslation();
  const { sheet, resolution } = definition;
  const build = useMemo(() => readBuild(definition, envelope), [definition, envelope]);
  const evaluated = useMemo(() => evaluateRulesetSheet(definition, build), [definition, build]);

  const commit = (patch: Partial<RulesetSheetBuild>) =>
    onChange({ ...envelope, v: sheet.version, build: { ...build, ...patch } });
  const hidden = (item: Parameters<typeof isRulesetItemHidden>[0]) => isRulesetItemHidden(item, build, definition);
  const offered = (ids: string[] | undefined) =>
    ids ? resolution.proficiencyTiers.filter((tier) => ids.includes(tier.id)) : resolution.proficiencyTiers;

  const sections = [
    ...sheet.sections,
    ...[...sheet.fields, ...sheet.derived, ...sheet.lists]
      .map((item) => item.section)
      .filter((id): id is string => !!id && !sheet.sections.some((section) => section.id === id))
      .filter((id, index, all) => all.indexOf(id) === index)
      .map((id) => ({ id, label: id })),
  ];
  const sectionGroups = [...sections, { id: "", label: t("ui.rulesets.sheet.otherSection") }]
    .map((section) => ({
      section,
      fields: sheet.fields.filter((field) => (field.section ?? "") === section.id && !hidden(field)),
      derived: sheet.derived.filter((entry) => (entry.section ?? "") === section.id && !hidden(entry)),
      lists: sheet.lists.filter((list) => (list.section ?? "") === section.id && !hidden(list)),
    }))
    .filter((group) => group.fields.length + group.derived.length + group.lists.length > 0);

  const updateRow = (listId: string, rows: ListRow[], index: number, columnId: string, value: Scalar) =>
    commit({
      lists: { ...build.lists, [listId]: rows.map((row, i) => (i === index ? { ...row, [columnId]: value } : row)) },
    });

  return (
    <div className="space-y-4">
      {sheet.abilities.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {sheet.abilities.map((ability) => (
            <label
              key={ability.id}
              className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
            >
              <span className={`${labelClass} max-w-full truncate`} title={ability.label}>
                {ability.short ?? ability.label}
              </span>
              <DraftNumberInput
                value={evaluated.abilityScores[ability.id] ?? ability.default}
                onCommit={(next) =>
                  commit({ abilities: { ...build.abilities, [ability.id]: clamp(next, ability.min, ability.max) } })
                }
                min={ability.min}
                max={ability.max}
                integer
                ariaLabel={ability.label}
                className={`${inputClass} text-center`}
              />
              <span className="text-xs font-semibold tabular-nums text-[var(--foreground)]">
                {signed(evaluated.abilityMods[ability.id] ?? 0)}
              </span>
            </label>
          ))}
        </div>
      )}

      {sectionGroups.map(({ section, fields, derived, lists }) => (
        <div key={section.id || "other"} className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--foreground)]">{section.label}</h4>
          {(fields.length > 0 || derived.length > 0) && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fields.map((field) => (
                <label
                  key={field.id}
                  className={`flex min-w-0 flex-col gap-1 ${field.type === "longtext" ? "col-span-full" : ""}`}
                >
                  <span className={labelClass}>{field.label}</span>
                  <TypedInput
                    spec={field}
                    value={build.fields[field.id]}
                    onChange={(value) => commit({ fields: { ...build.fields, [field.id]: value } })}
                    ariaLabel={field.label}
                  />
                </label>
              ))}
              {derived.map((entry) => (
                <div key={entry.id} className="flex min-w-0 flex-col gap-1">
                  <span className={labelClass}>{entry.label}</span>
                  <span className="rounded-lg border border-dashed border-[var(--border)] px-2 py-1 text-center text-xs font-semibold tabular-nums text-[var(--foreground)]">
                    {evaluated.derived[entry.id] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
          {lists.map((list) => {
            const rows = (Array.isArray(build.lists[list.id]) ? build.lists[list.id] : []) as ListRow[];
            return (
              <div key={list.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={labelClass}>
                    {list.label} ({rows.length}/{list.maxItems})
                  </span>
                  <button
                    type="button"
                    disabled={rows.length >= list.maxItems}
                    onClick={() =>
                      commit({
                        lists: {
                          ...build.lists,
                          [list.id]: [
                            ...rows,
                            Object.fromEntries(
                              list.columns
                                .filter((column) => column.default !== undefined)
                                .map((column) => [column.id, column.default as Scalar]),
                            ),
                          ],
                        },
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    <Plus size={12} aria-hidden="true" />
                    {t("ui.rulesets.sheet.addRow")}
                  </button>
                </div>
                {rows.map((row, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
                  >
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {list.columns.map((column) => (
                        <label
                          key={column.id}
                          className={`flex min-w-0 flex-col gap-0.5 ${column.type === "longtext" ? "col-span-full" : ""}`}
                        >
                          <span className={labelClass}>{column.label}</span>
                          <TypedInput
                            spec={column}
                            value={row[column.id]}
                            onChange={(value) => updateRow(list.id, rows, index, column.id, value)}
                            ariaLabel={`${list.label} ${index + 1}: ${column.label}`}
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        commit({ lists: { ...build.lists, [list.id]: rows.filter((_, i) => i !== index) } })
                      }
                      aria-label={t("ui.rulesets.sheet.removeRow", { list: list.label, index: index + 1 })}
                      className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--destructive)]"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}

      <TrainedRows
        title={t("ui.rulesets.sheet.skills")}
        entries={sheet.skills}
        tiers={offered(sheet.skillTiers)}
        chosen={evaluated.skillTiers}
        modifiers={evaluated.skillMods}
        bonuses={build.bonuses}
        bonusRange={sheet.bonusRange}
        definition={definition}
        onTier={(id, tier) => commit({ skills: { ...build.skills, [id]: tier } })}
        onBonus={(id, bonus) => commit({ bonuses: { ...build.bonuses, [id]: bonus } })}
      />
      <TrainedRows
        title={t("ui.rulesets.sheet.saves")}
        entries={sheet.saves}
        tiers={offered(sheet.saveTiers)}
        chosen={evaluated.saveTiers}
        modifiers={evaluated.saveMods}
        bonuses={build.bonuses}
        bonusRange={sheet.bonusRange}
        definition={definition}
        onTier={(id, tier) => commit({ saves: { ...build.saves, [id]: tier } })}
        onBonus={(id, bonus) => commit({ bonuses: { ...build.bonuses, [id]: bonus } })}
      />
    </div>
  );
}
