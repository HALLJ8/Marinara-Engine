// What the user sees before an imported ruleset is stored. A ruleset carries no code and asks for
// no permissions, so there is nothing to tick here: the review exists because the file DOES decide
// how every check in the game is rolled, what a sheet holds, and what text reaches the Game Master
// model. Those are shown in full, the GM text verbatim, before anything is written.
import type { ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import type { RulesetDefinition } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";

/** One labelled row of the summary. */
function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="shrink-0 text-xs font-medium text-[var(--foreground)] sm:w-36">{label}</span>
      <span className="min-w-0 text-xs text-[var(--muted-foreground)]">{children}</span>
    </div>
  );
}

/** Long, author-written text: shown whole, wrapped, and scrolled rather than truncated, because
 *  the point of showing it is that the user can read all of it. */
function ReviewText({ children }: { children: string }) {
  return (
    <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--secondary)]/45 p-2 font-sans text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
      {children}
    </pre>
  );
}

export function RulesetImportReviewModal({
  definition,
  rulesetId,
  installedVersions,
  importing,
  onCancel,
  onConfirm,
}: {
  /** The parsed file, or null when nothing is waiting for review. */
  definition: RulesetDefinition | null;
  /** The namespaced id this file will be stored under, built by the caller. */
  rulesetId: string;
  /** Versions of this ruleset already installed, so an import that changes nothing says so. */
  installedVersions: number[];
  importing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useUiTranslation();
  // Stays mounted while the dialog closes, like the Agent import review beside it, so the exit
  // animation plays instead of the panel vanishing mid-frame.
  return (
    <Modal
      open={definition !== null}
      onClose={() => {
        if (!importing) onCancel();
      }}
      title={t("game.ruleset.import.title")}
      width="max-w-2xl"
      mobileFullscreen
      closeDisabled={importing}
    >
      {definition && (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/45 p-3 text-sm leading-6">
            <FileText className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" size="1rem" />
            <p className="text-[var(--muted-foreground)]">{t("game.ruleset.import.intro")}</p>
          </div>

          {installedVersions.includes(definition.version) && (
            <div role="status" className="rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-xs text-[var(--primary)]">
              {t("game.ruleset.import.alreadyInstalled", { version: definition.version })}
            </div>
          )}

          <div className="max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
            <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)]/45 p-3">
              <h3 className="text-sm font-semibold">{definition.name}</h3>
              <ReviewRow label={t("game.ruleset.import.idLabel")}>
                <code className="break-all">{rulesetId}</code>
                <span className="mt-0.5 block">{t("game.ruleset.import.idHint")}</span>
              </ReviewRow>
              <ReviewRow label={t("game.ruleset.import.versionLabel")}>{definition.version}</ReviewRow>
              {definition.edition && (
                <ReviewRow label={t("game.ruleset.import.editionLabel")}>{definition.edition}</ReviewRow>
              )}
              <ReviewRow label={t("game.ruleset.import.licenseLabel")}>
                {definition.license?.spdx || definition.license?.attribution ? (
                  <>
                    {definition.license.spdx && <span className="block">{definition.license.spdx}</span>}
                    {definition.license.attribution && <ReviewText>{definition.license.attribution}</ReviewText>}
                  </>
                ) : (
                  t("game.ruleset.import.licenseNone")
                )}
              </ReviewRow>
            </section>

            <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)]/45 p-3">
              <ReviewRow label={t("game.ruleset.import.coverageLabel")}>{definition.coverage.summary}</ReviewRow>
              <ReviewRow label={t("game.ruleset.import.resolutionLabel")}>
                {definition.resolution.kind === "dice-sum"
                  ? t("game.ruleset.import.resolutionDiceSum", {
                      dice: `${definition.resolution.dice.count}d${definition.resolution.dice.sides}`,
                    })
                  : definition.resolution.kind}
              </ReviewRow>
              <ReviewRow label={t("game.ruleset.import.combatLabel")}>
                {definition.coverage.combat
                  ? t("game.ruleset.import.combatCovered")
                  : t("game.ruleset.import.combatNotCovered")}
              </ReviewRow>
            </section>

            <section className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)]/45 p-3">
              <h4 className="text-xs font-semibold">{t("game.ruleset.import.gmTextLabel")}</h4>
              <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                {t("game.ruleset.import.gmTextHint")}
              </p>
              <ReviewText>{definition.gm.checkGuidance}</ReviewText>
              {definition.gm.sheetGuidance && <ReviewText>{definition.gm.sheetGuidance}</ReviewText>}
            </section>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={importing}
              onClick={onCancel}
              className="mari-chrome-control h-10 px-4 text-sm"
            >
              {t("chat.delete.dialog.cancel")}
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={onConfirm}
              className="mari-chrome-control mari-chrome-control--primary h-10 px-4 text-sm"
            >
              {t("game.ruleset.import.confirm")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
