import { expect, test } from "@playwright/test";

test("Conversation background opacity applies immediately and survives reload", async ({ page, request }) => {
  test.skip(!test.info().project.name.includes("desktop"), "The settings panel fixture is desktop-only.");
  const filename = "conversation-opacity-smoke.svg";
  const backgroundUrl = `/api/backgrounds/file/${filename}`;
  let chatId = "";

  try {
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Conversation Background Opacity Smoke", mode: "conversation", characterIds: [] },
    });
    expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
    chatId = ((await chatResponse.json()) as { id: string }).id;
    await page.route(`**${backgroundUrl}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#245a70" d="M0 0h1600v900H0z"/></svg>',
      });
    });
    await page.addInitScript((activeChatId) => {
      localStorage.setItem("marinara-active-chat-id", activeChatId);
    }, chatId);
    await page.goto("/");

    await expect(page.locator("[data-conversation-background-gradient-veil]")).toHaveCount(0);

    const metadataResponse = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: { background: filename },
    });
    expect(metadataResponse.ok(), await metadataResponse.text()).toBeTruthy();
    await page.reload();

    const activeBackground = page.locator(`img.mari-background[src^="${backgroundUrl}"]`);
    await expect(activeBackground).toHaveCSS("opacity", "0.45");
    await expect(page.locator("[data-conversation-background-gradient-veil]")).toHaveCSS("opacity", "0.35");

    await page.locator('[data-tour="panel-settings"]').click();
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    const opacitySlider = page.getByLabel("Conversation background image opacity", { exact: true });
    await opacitySlider.fill("80");
    await expect(activeBackground).toHaveCSS("opacity", "0.8");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}').state
              ?.conversationBackgroundImageOpacity,
        ),
      )
      .toBe(80);

    await page.reload();
    await expect(activeBackground).toHaveCSS("opacity", "0.8");
    await expect(page.locator("[data-conversation-background-gradient-veil]")).toHaveCSS("opacity", "0.35");
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
  }
});
