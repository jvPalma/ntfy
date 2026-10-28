import { test, expect, openTopicMenu, selectPref, subscribe } from "./fixtures.js";
import { baseURL, unique } from "./env.js";

// A 1x1 PNG, so the attachment is rendered as an image
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

let topic;

// Browser notifications the app showed, recorded by the init script in beforeEach
const shown = (page) => page.evaluate(() => window.shownNotifications.map((n) => n.body));

test.beforeEach(async ({ page }) => {
  // Record browser notifications instead of showing them; headless Chrome can't show them anyway
  await page.addInitScript(() => {
    window.shownNotifications = [];
    if (!window.ServiceWorkerRegistration) {
      return; // E.g. about:blank
    }
    ServiceWorkerRegistration.prototype.showNotification = async (title, options) => {
      window.shownNotifications.push({ title, body: options?.body });
    };
  });

  // Fake timers (time still flows), so a test can jump to the poller's next 5-minute run. The
  // poller's startup sweep (after 2s) is fired right away, so it can't race live deliveries:
  // a message it stores first is never marked unread (see addNotifications).
  await page.clock.install();
  topic = unique("notif");
  await page.goto("/app");
  await page.clock.runFor(2000);
  await subscribe(page, topic);
});

test("message published via HTTP appears live", async ({ page, request }) => {
  const response = await request.post(`/${topic}`, {
    headers: { Title: "HTTP title", Tags: "warning,backup", Priority: "5" },
    data: "sent over HTTP",
  });
  expect(response.ok()).toBeTruthy();
  const item = page.getByRole("listitem", { name: "Notification" });
  await expect(item.getByText("sent over HTTP")).toBeVisible();
  await expect(item.getByText("HTTP title")).toBeVisible(); // prefixed with the warning emoji
  await expect(item.getByText("Tags: backup")).toBeVisible();
  await expect(item.getByRole("img", { name: "Priority 5" })).toBeVisible();
});

test("markdown message renders", async ({ page, request }) => {
  await request.post(`/${topic}`, { headers: { "Content-Type": "text/markdown" }, data: "**bold md** and _italic_" });
  await expect(page.locator("strong", { hasText: "bold md" })).toBeVisible();
  await expect(page.locator("em", { hasText: "italic" })).toBeVisible();
});

test("file attachment shows name and buttons", async ({ page, request }) => {
  const response = await request.put(`/${topic}`, { headers: { Filename: "report.bin" }, data: Buffer.alloc(3000, 7) });
  expect(response.ok()).toBeTruthy();
  const item = page.getByRole("listitem", { name: "Notification" });
  await expect(item.getByText("report.bin").first()).toBeVisible();
  await expect(item.getByRole("button", { name: "Copy attachment URL to clipboard" })).toBeVisible();
  await expect(item.getByRole("button", { name: /^Go to http/ })).toBeVisible();
});

test("image attachment opens in a lightbox", async ({ page, request }) => {
  await request.put(`/${topic}`, { headers: { Filename: "dot.png" }, data: png });
  await page.getByRole("img", { name: "Attachment image" }).click();
  // The lightbox shows a second copy, and hides the rest of the page from the accessibility tree
  await expect(page.locator('img[alt="Attachment image"]')).toHaveCount(2);
  await expect(page.getByRole("img", { name: "Attachment image" })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator('img[alt="Attachment image"]')).toHaveCount(1);
});

test("click URL shows link buttons", async ({ page, request }) => {
  await request.post(`/${topic}`, { headers: { Click: "https://example.com/clicked" }, data: "with a click URL" });
  const item = page.getByRole("listitem", { name: "Notification" });
  // Buttons are named by their tooltips
  await expect(item.getByRole("button", { name: "Go to https://example.com/clicked" })).toHaveText("Open link");
  await expect(item.getByRole("button", { name: "Copy link URL to clipboard" })).toHaveText("Copy link");
});

test("http action button sends the request", async ({ page, request }) => {
  // The action publishes to a second topic, so its effect is observable on the server
  const target = unique("target");
  const url = `${baseURL}/${target}`;
  await request.post("/", {
    data: {
      topic,
      message: "with actions",
      actions: [
        { action: "view", label: "Open site", url: "https://example.com" },
        { action: "http", label: "Ping", url, method: "POST", body: "pinged by action" },
      ],
    },
  });
  const item = page.getByRole("listitem", { name: "Notification" });
  await expect(item.getByRole("button", { name: "Go to https://example.com" })).toHaveText("Open site");
  await item.getByRole("button", { name: `Send HTTP POST to ${url}` }).click();
  await expect(item.getByRole("button", { name: `Send HTTP POST to ${url}` })).toHaveText(/Ping ✔/);
  await expect.poll(async () => (await request.get(`/${target}/json?poll=1`)).text()).toContain("pinged by action");
});

test("delete a single notification", async ({ page, request }) => {
  await request.post(`/${topic}`, { data: "keep me" });
  await request.post(`/${topic}`, { data: "delete me" });
  const items = page.getByRole("listitem", { name: "Notification" });
  await expect(items).toHaveCount(2);
  await items.filter({ hasText: "delete me" }).getByRole("button", { name: "Delete" }).click();
  await expect(items).toHaveCount(1);
  await expect(page.getByText("keep me")).toBeVisible();
});

test("clear all notifications", async ({ page, request }) => {
  await request.post(`/${topic}`, { data: "to be cleared" });
  await expect(page.getByText("to be cleared")).toBeVisible();
  await openTopicMenu(page, topic);
  await page.getByRole("menuitem", { name: "Clear all notifications" }).click();
  await expect(page.getByText("to be cleared")).toHaveCount(0);
  await expect(page.getByText("You haven't received any notifications for this topic yet.")).toBeVisible();
});

test("unread messages are counted until the topic is opened", async ({ page, request }) => {
  // Look at another topic, so messages to the first one stay unread
  const other = unique("other");
  await subscribe(page, other);
  await request.post(`/${topic}`, { data: "unread one" });
  await request.post(`/${topic}`, { data: "unread two" });
  const row = page.getByRole("button", { name: topic, exact: true });
  await expect(row).toContainText("2");
  await expect(page).toHaveTitle("(2) ntfy");

  await row.click();
  await expect(page.getByRole("listitem", { name: "Notification" })).toHaveCount(2);
  await expect(page).toHaveTitle("ntfy");
});

test("mark a notification as read", async ({ page, request }) => {
  const other = unique("other");
  await subscribe(page, other);
  await request.post(`/${topic}`, { data: "mark me" });
  await expect(page).toHaveTitle("(1) ntfy");

  // The all-notifications view shows it without marking it read
  await page.getByRole("button", { name: "All notifications" }).click();
  const item = page.getByRole("listitem", { name: "Notification" }).filter({ hasText: "mark me" });
  await item.getByRole("button", { name: "Mark as read" }).click();
  await expect(item.getByRole("button", { name: "Mark as read" })).toHaveCount(0);
  await expect(page).toHaveTitle("ntfy");
});

test("a poll racing the WebSocket keeps the message unread", async ({ page, request }) => {
  // A poll that was already in flight when the WebSocket delivered a message returns it a second
  // time; storing that copy must not reset its unread marker. Hold the poll to force the overlap.
  const other = unique("other");
  await subscribe(page, other);
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(`**/${topic}/json?poll=1*`, async (route) => {
    await held;
    await route.continue();
  });
  await page.clock.fastForward("05:00");

  await request.post(`/${topic}`, { data: "delivered twice" });
  await expect(page).toHaveTitle("(1) ntfy");
  const polled = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith(`/${topic}/json`));
  release();
  expect(await (await polled).text()).toContain("delivered twice");
  await page.waitForTimeout(1000); // Let the poller store what it fetched
  await expect(page).toHaveTitle("(1) ntfy");
});

test("a message the poll stores before the WebSocket is still unread", async ({ page, request }) => {
  // The poll stores it as read; the WebSocket delivery that follows replaces it, unread, and notifies
  // Hold live messages until the poll has stored the message
  const held = [];
  let release;
  await page.routeWebSocket(/\/ws(\?|$)/, (ws) => {
    const server = ws.connectToServer();
    server.onMessage((m) => (JSON.parse(m).event === "message" && !release ? held.push(() => ws.send(m)) : ws.send(m)));
  });
  await page.reload();
  await page.clock.runFor(2000);
  const other = unique("other");
  await subscribe(page, other);

  await request.post(`/${topic}`, { data: "poll first" });
  await expect.poll(() => held.length).toBe(1);
  const polled = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith(`/${topic}/json`));
  await page.clock.fastForward("05:00");
  expect(await (await polled).text()).toContain("poll first");
  await page.waitForTimeout(1000); // Let the poller store what it fetched
  release = true;
  held.forEach((send) => send());

  await expect(page).toHaveTitle("(1) ntfy");
  await expect.poll(() => shown(page)).toEqual(["poll first"]);
});

test("all notifications view shows every topic", async ({ page, request }) => {
  const other = unique("other");
  await subscribe(page, other);
  await request.post(`/${topic}`, { data: "first topic message" });
  await request.post(`/${other}`, { data: "second topic message" });
  await page.getByRole("button", { name: "All notifications" }).click();
  await expect(page.getByText("first topic message")).toBeVisible();
  await expect(page.getByText("second topic message")).toBeVisible();
});

test("notifications survive a reload", async ({ page, request }) => {
  await request.post(`/${topic}`, { data: "still here" });
  await expect(page.getByText("still here")).toBeVisible();
  await page.reload();
  await expect(page.getByText("still here")).toBeVisible();
});

test("messages published before subscribing are shown", async ({ page, request }) => {
  const other = unique("earlier");
  await request.post(`/${other}`, { data: "published earlier" });
  await subscribe(page, other);
  await expect(page.getByText("published earlier")).toBeVisible();
});

test.describe("sequences", () => {
  test("an update replaces the message", async ({ page, request }) => {
    await request.post(`/${topic}/download`, { data: "Downloading" });
    const items = page.getByRole("listitem", { name: "Notification" });
    await expect(items).toHaveText(/Downloading/);
    await request.post(`/${topic}/download`, { data: "Download complete" });
    await expect(items).toHaveText(/Download complete/);
    await expect(items).toHaveCount(1);
  });

  test("an update the WebSocket missed replaces the message", async ({ page, request }) => {
    await request.post(`/${topic}/download`, { data: "Downloading" });
    const items = page.getByRole("listitem", { name: "Notification" });
    await expect(items).toHaveText(/Downloading/);

    // Drop live messages, so only the poller's 5-minute catch-up sees the update
    await page.routeWebSocket(/\/ws(\?|$)/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((m) => JSON.parse(m).event !== "message" && ws.send(m));
    });
    await page.reload();
    await page.clock.runFor(2000);
    await request.post(`/${topic}/download`, { data: "Download complete" });
    const polled = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith(`/${topic}/json`));
    await page.clock.fastForward("05:00");
    await polled;
    await expect(items.first()).toHaveText(/Download complete/);
    await expect(items).toHaveCount(1);
  });

  test("deleting removes the message", async ({ page, request }) => {
    await request.post(`/${topic}/download`, { data: "Downloading" });
    await expect(page.getByText("Downloading")).toBeVisible();
    await request.delete(`/${topic}/download`);
    await expect(page.getByRole("listitem", { name: "Notification" })).toHaveCount(0);
  });

  test("clearing marks the message as read", async ({ page, request }) => {
    const other = unique("other");
    await subscribe(page, other);
    await request.post(`/${topic}/download`, { data: "Downloading" });
    await expect(page).toHaveTitle("(1) ntfy");
    await request.put(`/${topic}/download/clear`);
    await expect(page).toHaveTitle("ntfy");
  });
});

test.describe("browser notifications", () => {
  test("a new message is shown", async ({ page, request }) => {
    await request.post(`/${topic}`, { data: "pop up" });
    await expect.poll(() => shown(page)).toEqual(["pop up"]);
  });

  test("not for a muted topic", async ({ page, request }) => {
    const other = unique("other");
    await subscribe(page, other);
    await openTopicMenu(page, topic);
    await page.getByRole("menuitem", { name: "Mute notifications" }).click();
    await request.post(`/${topic}`, { data: "muted" });
    await request.post(`/${other}`, { data: "not muted" });
    await expect.poll(() => shown(page)).toEqual(["not muted"]);
  });

  test("not below the minimum priority", async ({ page, request }) => {
    await page.getByRole("button", { name: "Settings" }).click();
    await selectPref(page, "Minimum priority", "High priority and higher");
    await request.post(`/${topic}`, { headers: { Priority: "3" }, data: "default priority" });
    await request.post(`/${topic}`, { headers: { Priority: "4" }, data: "high priority" });
    await expect.poll(() => shown(page)).toEqual(["high priority"]);
  });
});

// Fork: "ntfy jv" message rendering (openspec/changes/web-message-rendering)
test.describe("fork message rendering", () => {
  const markdown = (request, data) => request.post(`/${topic}`, { headers: { "Content-Type": "text/markdown" }, data });
  const items = (page) => page.getByRole("listitem", { name: "Notification" });
  const css = (locator, property) => locator.evaluate((el, p) => getComputedStyle(el)[p], property);

  test("fonts are IBM Plex Sans and JetBrains Mono, all self-hosted", async ({ page, request }) => {
    await request.post(`/${topic}`, { data: "font check" });
    const item = items(page);
    await expect(item.getByText("font check")).toBeVisible();
    expect(await css(item.getByText("font check"), "fontFamily")).toContain("IBM Plex Sans");
    expect(await css(item.locator(".ntfy-date"), "fontFamily")).toContain("JetBrains Mono NF");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px "IBM Plex Sans"'))).toBe(true);
    // Reload with a request listener, so the fonts and every other asset are seen being fetched
    const hosts = new Set();
    page.on("request", (r) => r.url().startsWith("http") && hosts.add(new URL(r.url()).host));
    await page.reload();
    await expect(items(page).getByText("font check")).toBeVisible();
    expect([...hosts]).toEqual([new URL(baseURL).host]);
  });

  test("card text is 80 % of upstream", async ({ page, request }) => {
    await request.post(`/${topic}`, { data: "compact body" });
    const item = items(page);
    await expect(item.getByText("compact body")).toBeVisible();
    expect(await css(item.getByText("compact body"), "fontSize")).toBe("12.8px");
    expect(await css(item.locator(".ntfy-date"), "fontSize")).toBe("11.2px");
  });

  test("markdown tables render and scroll inside the card", async ({ page, request }) => {
    await markdown(request, "| a | b |\n|---|---|\n| 1 | 2 |");
    const table = items(page).locator("table");
    await expect(table.locator("th")).toHaveText(["a", "b"]);
    await expect(table.locator("td")).toHaveText(["1", "2"]);

    await page.setViewportSize({ width: 390, height: 800 });
    const cols = Array.from({ length: 12 }, (_, i) => `column-${i}`);
    await markdown(request, `| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|\n| ${cols.join(" | ")} |`);
    await expect(items(page).locator("th", { hasText: "column-11" })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(await page.locator("#main").evaluate((m) => m.scrollWidth <= m.clientWidth)).toBe(true);
  });

  test("a plain-text message with pipes is not a table", async ({ page, request }) => {
    await request.post(`/${topic}`, { data: "| a | b |\n|---|---|\n| 1 | 2 |" });
    await expect(items(page).getByText("| 1 | 2 |")).toBeVisible();
    await expect(items(page).locator("table")).toHaveCount(0);
  });

  test("markdown stays safe", async ({ page, request }) => {
    await markdown(request, '[unsafe link](javascript:alert(1))\n\n<img src=x onerror="alert(1)">\n\n`<b>not bold</b>`');
    const link = items(page).getByRole("link", { name: "unsafe link" });
    await expect(link).toHaveAttribute("href", "");
    await expect(items(page).locator(".ntfy-markdown img")).toHaveCount(0);
    await expect(items(page).locator(".ntfy-markdown code", { hasText: "<b>not bold</b>" })).toBeVisible();
    await expect(items(page).locator(".ntfy-markdown b")).toHaveCount(0);
  });

  for (const colorScheme of ["light", "dark"]) {
    test(`bash block is Monokai Night in ${colorScheme}`, async ({ page, request }) => {
      await page.emulateMedia({ colorScheme });
      await markdown(request, '```bash\n# say hi\necho "$HOME"\n```');
      const comment = items(page).locator(".hljs-comment", { hasText: "# say hi" });
      await expect(comment).toHaveCSS("color", "rgb(117, 113, 94)");
      await expect(items(page).locator("pre.ntfy-code")).toHaveCSS("background-color", "rgb(31, 31, 31)");
      await expect(items(page).locator(".hljs-variable", { hasText: "$HOME" })).toHaveCSS("color", "rgb(253, 151, 31)");
    });
  }

  test("an alias and an unknown language", async ({ page, request }) => {
    await markdown(request, "```yml\nkey: value\n```\n\n```brainfuck\n+++.\n```");
    await expect(items(page).locator(".hljs-attr", { hasText: "key" })).toHaveCSS("color", "rgb(166, 226, 46)");
    const unknown = items(page).locator("pre.ntfy-code", { hasText: "+++." });
    await expect(unknown).toHaveCSS("color", "rgb(221, 221, 221)");
    await expect(unknown.locator("span")).toHaveCount(0);
  });

  test("the highlighter only loads for code with a language", async ({ page, request }) => {
    const requested = [];
    page.on("request", (r) => requested.push(r.url()));
    const loaded = () => requested.some((url) => url.includes("codeHighlight"));
    await markdown(request, "**no code here**");
    await expect(page.locator("strong", { hasText: "no code here" })).toBeVisible();
    expect(loaded()).toBe(false);
    await markdown(request, "```bash\necho hi\n```");
    await expect(items(page).locator(".hljs-built_in", { hasText: "echo" })).toBeVisible();
    expect(loaded()).toBe(true);
  });

  test("copy button copies only the code", async ({ page, context, request }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await markdown(request, "Before\n\n```bash\n# comment\necho one\n```\n\nAfter");
    const button = items(page).getByRole("button", { name: "Copy code" });
    await expect(button).toHaveText("\u{F018F} copy");
    await button.focus();
    await expect(button).toBeFocused();
    await button.click();
    await expect(button).toHaveText("\u{F012C} copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("# comment\necho one");
    await expect(page.getByText("Copied to clipboard")).toHaveCount(0);
    // The highlighting is still there after the button changed
    await expect(items(page).locator(".hljs-comment", { hasText: "# comment" })).toHaveCSS("color", "rgb(117, 113, 94)");
    await expect(button).toHaveText("\u{F018F} copy", { timeout: 5000 });
  });

  test("a failed copy says so", async ({ page, request }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
    });
    await page.reload();
    await markdown(request, "```bash\necho fail\n```");
    await items(page).getByRole("button", { name: "Copy code" }).click();
    await expect(page.getByText("Could not copy code")).toBeVisible();
  });
});

// Fork: chat order inside a topic (openspec/changes/web-message-rendering, web-topic-view)
test.describe("fork chat order", () => {
  const scrollMainToTop = (page) =>
    page.evaluate(() => {
      document.getElementById("main").scrollTop = 0;
    });
  const items = (page) => page.getByRole("listitem", { name: "Notification" });
  // Publishes n messages to a new topic, then subscribes, so they all arrive in one poll
  const topicWith = async (page, request, n) => {
    const name = unique("chat");
    for (let i = 1; i <= n; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await request.post(`/${name}`, { data: `msg ${i}` });
      expect(response.ok()).toBeTruthy();
    }
    await subscribe(page, name);
    return name;
  };

  test("a topic lists oldest to newest, top to bottom", async ({ page, request }) => {
    // Message times have one-second resolution, so space the messages out to get a defined order
    for (let i = 1; i <= 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request.post(`/${topic}`, { data: `msg ${i}` });
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(1100);
    }
    await expect(items(page)).toHaveCount(3);
    await expect(items(page).nth(0)).toContainText("msg 1");
    await expect(items(page).nth(2)).toContainText("msg 3");
  });

  test("a long topic opens at the newest message, above the message bar", async ({ page, request }) => {
    await topicWith(page, request, 50);
    const newest = items(page).last();
    await expect(newest).toBeInViewport({ ratio: 1 });
    const bar = await page.getByPlaceholder("Type a message here").boundingBox();
    const box = await newest.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
  });

  test("scrolling up loads older messages without jumping", async ({ page, request }) => {
    await topicWith(page, request, 50);
    await expect(items(page)).toHaveCount(20);
    await expect(items(page).last()).toBeInViewport();
    const anchorText = await items(page).first().locator("p").nth(1).innerText();
    const anchor = items(page).filter({ has: page.getByText(anchorText, { exact: true }) });
    const before = await anchor.evaluate((el) => {
      document.getElementById("main").scrollTop = 0;
      return el.getBoundingClientRect().top;
    });
    await expect(items(page)).toHaveCount(40);
    const after = await anchor.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(5);
    // The whole history is reachable by scrolling up again
    await expect
      .poll(async () => {
        await scrollMainToTop(page);
        return items(page).count();
      })
      .toBe(50);
  });

  test("a new message scrolls into view, even while reading history", async ({ page, request }) => {
    const name = await topicWith(page, request, 30);
    await expect(items(page)).toHaveCount(20);
    await scrollMainToTop(page);
    // Message times have one-second resolution; publish in a later second so it is the newest
    await page.waitForTimeout(1100);
    await request.post(`/${name}`, { data: "late message" });
    await expect(items(page).filter({ hasText: "late message" })).toBeInViewport({ ratio: 1 });
  });

  test("all notifications stay newest first", async ({ page, request }) => {
    for (let i = 1; i <= 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request.post(`/${topic}`, { data: `msg ${i}` });
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(1100);
    }
    await expect(items(page)).toHaveCount(3);
    await page.getByRole("button", { name: "All notifications" }).click();
    await expect(items(page).nth(0)).toContainText("msg 3");
    await expect(items(page).nth(2)).toContainText("msg 1");
  });
});
