import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-host-integrations-"));
process.env.DATA_DIR = dataDir;
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const requests: Array<{ path: string; body: Record<string, unknown>; headers: Record<string, unknown> }> = [];
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw || "{}");
  requests.push({ path: request.url!, body, headers: request.headers });
  response.setHeader("content-type", "application/json");
  if (request.url?.startsWith("/failure/")) {
    response.writeHead(500).end(JSON.stringify({ error: { message: "fixture provider failure" } }));
  } else if (request.url?.endsWith("/images/generations")) {
    response.end(JSON.stringify({ data: [{ b64_json: png }] }));
  } else {
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: "host result",
              tool_calls: [{ id: "call-1", type: "function", function: { name: "fixture", arguments: "{}" } }],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
      }),
    );
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const { createCapabilityIntegrationHost } =
    await import("../../packages/server/src/services/capability-packages/capability-integrations.service.js");
  const image = await import("../../packages/server/src/services/image/image-generation.js");
  const video = await import("../../packages/server/src/services/video/video-generation.js");
  const host = createCapabilityIntegrationHost();
  assert.equal(
    host.images.generate,
    image.generateImage,
    "Packages must share the host's provider implementation and queue",
  );
  assert.equal(host.videos.generate, video.generateVideo);
  assert.equal(host.videos.save, video.saveVideoToDisk);
  assert.equal(host.videos.resolveDuration("xai", "xai", { durationSeconds: 30 }), 15);

  const provider = host.llm.createProvider("openai", `${base}/v1`, "fixture-secret", 8192, null, 512, false, false, {
    customParameters: { seed: 42 },
    customHeaders: { "X-Fixture-Session": "chat-1" },
  });
  assert.equal(provider.maxContextValue, 8192);
  assert.equal(provider.maxTokensOverrideValue, 512);
  assert.equal("apiKey" in provider, false);
  assert.equal("baseUrl" in provider, false);
  assert.ok(Object.isFrozen(provider));
  const result = await provider.chatComplete([{ role: "user", content: "A synthetic prompt" }], {
    model: "gpt-4o-mini",
    maxTokens: 128,
    tools: [
      {
        type: "function",
        function: { name: "fixture", description: "Synthetic tool", parameters: { type: "object" } },
      },
    ],
  });
  assert.equal(result.content, "host result");
  assert.equal(result.toolCalls[0]?.function.name, "fixture");
  assert.equal(result.usage?.totalTokens, 10);
  assert.equal(requests.at(-1)?.body.seed, 42, "Stored connection defaults must reach the host provider");
  assert.equal(requests.at(-1)?.headers["x-fixture-session"], "chat-1");

  const failure = host.llm.createProvider("openai", `${base}/failure/v1`, "fixture-secret");
  let notice: string | undefined;
  const fallback = host.llm.withFallback({
    primary: failure,
    primaryConnectionId: "fixture-primary",
    fallbackBaseUrl: `${base}/fallback/v1`,
    category: "agents",
    fallbackConnection: {
      id: "fixture-backup",
      provider: "openai",
      baseUrl: `${base}/fallback/v1`,
      apiKey: "fixture-backup-secret",
      model: "gpt-4o-mini",
    },
    onFallback: (value) => {
      notice = value.connectionId;
    },
  });
  assert.equal(
    (await fallback.chatComplete([{ role: "user", content: "Fallback fixture" }], { model: "gpt-4o-mini" })).content,
    "host result",
  );
  assert.equal(notice, "fixture-backup");
  assert.ok(requests.some((value) => value.path.startsWith("/failure/")));
  assert.ok(requests.some((value) => value.path.startsWith("/fallback/")));
  assert.throws(
    () =>
      createCapabilityIntegrationHost().llm.withFallback({
        primary: provider,
        primaryConnectionId: "foreign",
        fallbackBaseUrl: "",
        category: "agents",
        fallbackConnection: null,
      }),
    /created by this package/,
  );
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    provider.chatComplete([{ role: "user", content: "Cancelled" }], { model: "gpt-4o-mini", signal: abort.signal }),
    /abort/i,
  );

  const generated = await host.images.generate("openai", `${base}/v1`, "fixture-secret", "openai", {
    prompt: "a synthetic landscape",
    model: "local-flux",
    allowLocalUrls: true,
  });
  assert.equal(generated.base64, png);
  const staged = host.images.stage("fixture-chat", png, "png");
  assert.equal(existsSync(join(dataDir, "gallery", staged.filePath)), false);
  staged.promote();
  assert.deepEqual(readFileSync(join(dataDir, "gallery", staged.filePath)), Buffer.from(png, "base64"));
  staged.compensate();
  assert.equal(existsSync(join(dataDir, "gallery", staged.filePath)), false);
  assert.throws(() => host.images.save("../../outside", png, "png"), /path|directory|outside|escape/i);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  rmSync(dataDir, { recursive: true, force: true });
}
console.info(
  "Host integrations preserve provider defaults, tools, usage, fallback, cancellation, media services and safe gallery writes.",
);
