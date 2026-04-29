import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, devices } from "playwright";

const baseUrl =
  process.env.SITE_URL || pathToFileURL(path.join(process.cwd(), "index.html")).href;
const artifactDir = path.join(process.cwd(), "output", "playwright");
const headless = process.env.HEADLESS !== "0";

const scenarios = [
  {
    label: "desktop",
    options: {
      viewport: { width: 1440, height: 1280 }
    }
  },
  {
    label: "mobile",
    options: {
      ...devices["iPhone 13"]
    }
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyScenario(browser, scenario) {
  const context = await browser.newContext(scenario.options);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(baseUrl, { waitUntil: "load" });

  await page.waitForSelector(".hero-image");
  await page.waitForSelector(".about");
  await page.waitForSelector(".calendar iframe");
  await page.waitForSelector(".hero-slide.is-active");

  const title = await page.title();
  assert(
    title === "Brawley Little League",
    `Unexpected page title for ${scenario.label}: ${title}`
  );

  const heroImage = page.locator(".hero-image");
  const activeHeroSlide = page.locator(".hero-slide.is-active");
  const aboutSection = page.locator(".about");
  const calendarSection = page.locator(".calendar");
  const calendarLink = page.locator(".calendar-link");
  const iframe = page.locator(".calendar iframe");

  await Promise.all([
    heroImage.scrollIntoViewIfNeeded(),
    iframe.scrollIntoViewIfNeeded()
  ]);

  assert(await heroImage.isVisible(), `${scenario.label} hero image should be visible`);
  assert(
    await activeHeroSlide.isVisible(),
    `${scenario.label} active carousel slide should be visible`
  );
  assert(await aboutSection.isVisible(), `${scenario.label} about section should be visible`);
  assert(
    await calendarLink.isVisible(),
    `${scenario.label} full calendar link should be visible`
  );
  assert(
    (await calendarLink.getAttribute("href"))?.includes(
      "7b6826790f3f7a243587a0074b5cebb38e057ccf52dde75b68b6b0a3515b5cc6%40group.calendar.google.com"
    ),
    `${scenario.label} full calendar link should target the team calendar`
  );
  assert(await iframe.isVisible(), `${scenario.label} calendar iframe should be visible`);

  const heroBox = await heroImage.boundingBox();
  const aboutBox = await aboutSection.boundingBox();
  const calendarBox = await calendarSection.boundingBox();

  assert(heroBox && heroBox.height > 180, `${scenario.label} hero image height is too small`);
  assert(aboutBox, `${scenario.label} about section bounds were unavailable`);
  assert(calendarBox, `${scenario.label} calendar section bounds were unavailable`);

  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));

  assert(
    metrics.scrollWidth <= metrics.clientWidth + 1,
    `${scenario.label} layout overflows horizontally`
  );

  if (scenario.label === "mobile") {
    assert(
      calendarBox.y > aboutBox.y,
      "Mobile layout should stack the calendar below the about section"
    );
  }

  await page.screenshot({
    path: path.join(artifactDir, `site-${scenario.label}.png`),
    fullPage: true
  });

  assert(pageErrors.length === 0, `Page errors on ${scenario.label}: ${pageErrors.join(" | ")}`);
  assert(
    consoleErrors.length === 0,
    `Console errors on ${scenario.label}: ${consoleErrors.join(" | ")}`
  );

  await context.close();

  return {
    scenario: scenario.label,
    title,
    viewport: scenario.options.viewport || scenario.options.screen,
    heroHeight: heroBox.height,
    layoutWidth: metrics.clientWidth
  };
}

async function main() {
  await mkdir(artifactDir, { recursive: true });

  const browser = await chromium.launch({ headless });

  try {
    const results = [];

    for (const scenario of scenarios) {
      results.push(await verifyScenario(browser, scenario));
    }

    console.log("Verification passed.");
    console.log(JSON.stringify({ baseUrl, headless, results }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  if (String(error.message).includes("Executable doesn't exist")) {
    console.error("Chromium is not installed for Playwright.");
    console.error("Run: npx playwright install chromium");
  }

  console.error(error);
  process.exit(1);
});
