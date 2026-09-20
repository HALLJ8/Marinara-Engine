import type { CapabilityIntegrationHost, CapabilityIntegrationProvider } from "@marinara-engine/shared";
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import {
  generateImage,
  saveImageToDisk,
  removeSavedImageFromDisk,
  stageImageToDisk,
  sweepStagedImages,
} from "../image/image-generation.js";
import {
  generateVideo,
  saveVideoToDisk,
  removeSavedVideoFromDisk,
  resolveVideoRequestDuration,
  resolveVideoReferencePublicUploadOptions,
} from "../video/video-generation.js";

/** Bind each package to the live host services, including their queues, security checks and logging. */
export function createCapabilityIntegrationHost(): CapabilityIntegrationHost {
  const providers = new WeakMap<CapabilityIntegrationProvider, BaseLLMProvider>();
  const expose = (provider: BaseLLMProvider): CapabilityIntegrationProvider => {
    const facade = Object.freeze({
      get maxContextValue() {
        return provider.maxContextValue;
      },
      get maxTokensOverrideValue() {
        return provider.maxTokensOverrideValue;
      },
      chat: provider.chat.bind(provider),
      chatComplete: provider.chatComplete.bind(provider),
      embed: provider.embed.bind(provider),
    });
    providers.set(facade, provider);
    return facade;
  };
  return Object.freeze({
    llm: Object.freeze({
      createProvider: (...args: Parameters<typeof createLLMProvider>) => expose(createLLMProvider(...args)),
      withFallback(options: Parameters<CapabilityIntegrationHost["llm"]["withFallback"]>[0]) {
        const primary = providers.get(options.primary);
        if (!primary) throw new Error("Fallback requires a provider created by this package's host integrations.");
        return expose(withConnectionFallbackProvider({ ...options, primary }));
      },
    }),
    images: Object.freeze({
      generate: generateImage,
      save: saveImageToDisk,
      remove: removeSavedImageFromDisk,
      stage: stageImageToDisk,
      sweepStaged: sweepStagedImages,
    }),
    videos: Object.freeze({
      generate: generateVideo,
      save: saveVideoToDisk,
      remove: removeSavedVideoFromDisk,
      resolveDuration: resolveVideoRequestDuration,
      resolveReferenceUpload: resolveVideoReferencePublicUploadOptions,
    }),
  });
}
