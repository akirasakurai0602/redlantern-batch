import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

const MAX_PAGES = 5; // ← 取得ページ数（あとで増やせる）

export async function scrapeSpankbangPage() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );

  const allItems = [];

  // -------------------------
  // 📌 ページ巡回ループ
  // -------------------------
  for (let i = 1; i <= MAX_PAGES; i++) {
    const url = `https://spankbang.com/s/asian/${i}/`;
    console.log(`▶ Fetching page ${i}: ${url}`);

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });

      await page.waitForSelector('[data-testid="video-item"]', {
        timeout: 20000,
      });
    } catch (err) {
      console.log(`⚠ Page ${i} load failed, stopping.`);
      break;
    }

    const items = await page.evaluate(() => {
      const results = [];

      document.querySelectorAll('[data-testid="video-item"]').forEach((el) => {
        const a = el.querySelector("a");
        const img = el.querySelector("img");

        const url = a ? "https://spankbang.com" + a.getAttribute("href") : null;
        const thumbnail = img?.getAttribute("data-src") || img?.src || null;

        const titleEl = el.querySelector(
          '[data-testid="video-info-with-badge"] [title]'
        );
        const title = titleEl?.innerText?.trim() || "";

        const len = el.querySelector(
          '[data-testid="video-item-length"]'
        )?.innerText;
        const duration = len?.trim() || "";

        if (url && thumbnail) {
          results.push({
            url,
            title,
            thumbnail_url: thumbnail,
            duration,
            source: "spankbang",
            tags: ["asian"],
            is_asian: true,
          });
        }
      });

      return results;
    });

    console.log(`✔ Page ${i} → ${items.length} items`);

    if (items.length === 0) break;

    allItems.push(...items);
  }

  await browser.close();
  return allItems;
}
