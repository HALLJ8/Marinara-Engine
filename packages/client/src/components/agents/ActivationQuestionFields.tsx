import { useTranslation } from "react-i18next";
import { MAX_CUSTOM_AGENT_ACTIVATION_QUESTION_LENGTH } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";

export function ActivationQuestionFields({
  question,
  threshold,
  maxSkip,
  enabled,
  onChange,
}: {
  question: string;
  threshold: number;
  maxSkip: number | "";
  enabled: boolean;
  onChange: (values: { question?: string; threshold?: number; maxSkip?: number | "" }) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <label className="block text-xs font-medium" htmlFor="agent-activation-question">
        {t("agents.activation.question")}
      </label>
      <textarea
        id="agent-activation-question"
        disabled={!enabled}
        value={question}
        maxLength={MAX_CUSTOM_AGENT_ACTIVATION_QUESTION_LENGTH}
        rows={3}
        placeholder={t("agents.activation.placeholder")}
        onChange={(event) => onChange({ question: event.target.value })}
        className="w-full resize-y rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] disabled:opacity-50"
      />
      {!enabled && (
        <p className="text-xs text-[var(--muted-foreground)]">
          {t("agents.activation.chooseDefault")}{" "}
          <button
            type="button"
            className="text-[var(--primary)] underline"
            onClick={() => useUIStore.getState().openRightPanel("connections")}
          >
            {t("agents.activation.openConnections")}
          </button>
        </p>
      )}
      <p className="text-xs text-[var(--muted-foreground)]">{t("agents.activation.help")}</p>
      {question.trim() && (
        <fieldset disabled={!enabled} className="space-y-3 disabled:opacity-50">
          <label className="block text-xs" htmlFor="agent-activation-threshold">
            {t("agents.activation.threshold", { value: threshold.toFixed(2) })}
          </label>
          <input
            id="agent-activation-threshold"
            className="w-full accent-[var(--primary)]"
            type="range"
            min={0.05}
            max={0.95}
            step={0.05}
            value={threshold}
            onChange={(event) => onChange({ threshold: Number(event.target.value) })}
          />
          <p className="text-xs text-[var(--muted-foreground)]">{t("agents.activation.thresholdHelp")}</p>
          <label htmlFor="agent-activation-max-skip" className="block text-xs">
            {t("agents.activation.maxSkip")}
          </label>
          <input
            id="agent-activation-max-skip"
            type="number"
            min={1}
            max={100}
            value={maxSkip}
            placeholder={t("agents.activation.noCeiling")}
            onChange={(event) =>
              onChange({
                maxSkip:
                  event.target.value === ""
                    ? ""
                    : Math.min(100, Math.max(1, Math.trunc(Number(event.target.value)) || 1)),
              })
            }
            className="w-32 rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm ring-1 ring-[var(--border)]"
          />
          <p className="text-xs text-[var(--muted-foreground)]">{t("agents.activation.maxSkipHelp")}</p>
        </fieldset>
      )}
    </section>
  );
}
