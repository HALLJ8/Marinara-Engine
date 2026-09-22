/**
 * What every local model slot is currently costing, for `/api/health` and from there
 * for the Copy Diagnostics report.
 *
 * The existing `GPU:` line in that report is the *browser's* GPU, which says nothing
 * about the machine running the sidecars when the client is a phone or another PC.
 * These lines are about the server, and they are useful on their own for existing
 * "my local model won't load" reports, before any decision model is involved.
 *
 * Nothing here blocks: it reads a cached probe and the slots' own status, so the
 * health endpoint stays fast even when `nvidia-smi` is missing or slow.
 */
import type { SidecarHealthSection, SidecarSlotFootprint } from "@marinara-engine/shared";
import {
  assessSidecarLoad,
  estimateSlotBytes,
  getGpuProbe,
  getMeasuredProcessBytes,
  resolveSharedDevice,
} from "./sidecar-footprint.js";
import { sidecarModelService } from "./sidecar-model.service.js";
import { sidecarProcessService } from "./sidecar-process.service.js";
import { utilitySidecarService } from "../utility-sidecar/utility-sidecar.service.js";

function mainSlot(): SidecarSlotFootprint {
  const status = sidecarModelService.getStatus();
  const running = sidecarProcessService.isReady();
  // gpuLayers 0 means the model runs on the CPU, so it is weighed against system
  // memory rather than counted against the card.
  const onCpu = status.config.gpuLayers === 0;
  const measuredBytes = running && !onCpu ? getMeasuredProcessBytes(sidecarProcessService.getProcessId()) : null;
  return {
    slot: "main",
    configured: status.modelDownloaded,
    running,
    model: status.modelDisplayName,
    fileBytes: status.modelSize,
    contextSize: status.config.contextSize,
    backend: status.runtime.variant ?? status.config.backend,
    estimatedBytes: status.modelDownloaded
      ? estimateSlotBytes({ fileBytes: status.modelSize, contextSize: status.config.contextSize, measuredBytes })
      : null,
    measured: measuredBytes !== null,
    onCpu,
  };
}

function utilitySlot(): SidecarSlotFootprint {
  const status = utilitySidecarService.getStatus();
  const active = status.activeModelId ? status.models[status.activeModelId] : undefined;
  const onCpu = status.settings.gpuLayers === 0;
  const measuredBytes = status.ready && !onCpu ? getMeasuredProcessBytes(utilitySidecarService.getProcessId()) : null;
  return {
    slot: "utility",
    configured: !!active,
    running: status.ready,
    model: status.activeModelId,
    fileBytes: active?.bytes ?? null,
    contextSize: status.settings.contextSize,
    backend: status.runtimeInstalled ? "llama_cpp" : null,
    estimatedBytes: active
      ? estimateSlotBytes({
          fileBytes: active.bytes ?? null,
          contextSize: status.settings.contextSize,
          measuredBytes,
        })
      : null,
    measured: measuredBytes !== null,
    onCpu,
  };
}

/**
 * The decision slot, which has no managed runtime in this build.
 *
 * Reported as unconfigured rather than omitted, so the report's shape does not change
 * when the managed decision sidecar arrives and so a reader can tell "not installed"
 * from "this build does not know about it".
 */
function decisionSlot(): SidecarSlotFootprint {
  return {
    slot: "decision",
    configured: false,
    running: false,
    model: null,
    fileBytes: null,
    contextSize: null,
    backend: null,
    estimatedBytes: null,
    measured: false,
    onCpu: false,
  };
}

export function buildSidecarHealthSection(): SidecarHealthSection {
  const gpu = getGpuProbe();
  const slots = [mainSlot(), utilitySlot(), decisionSlot()];
  // With one NVIDIA GPU every slot shares it. With several, llama.cpp's launch
  // diagnostics do not name the card a slot landed on, so no device is resolved and
  // no verdict is claimed rather than a wrong one asserted.
  const device = resolveSharedDevice(gpu.devices, null);
  const load =
    device && slots.some((slot) => slot.configured && !slot.onCpu) ? assessSidecarLoad({ slots, device }) : null;
  return { gpu, slots, load, decisionConsent: null };
}
