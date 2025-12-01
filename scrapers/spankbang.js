import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

// 取得ページ数（必要なら 10 や 20 に増やせる）
const MAX_PAGES = 5;

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

  // ============================
  //  🔁 ページ巡回ループ
  // ============================
  for (let i = 1; i <= MAX_PAGES; i++) {
    const url =
      i === 1
        ? "https://spankbang.com/s/asian/"
        : `https://spankbang.com/s/asian/${i}/`;

    console.log(`▶ Fetching SpankBang page ${i}: ${url}`);

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });

      await page.waitForSelector('[data-testid="video-item"]', {
        timeout: 20000,
      });
    } catch (e) {
      console.log(`⚠ Page ${i} failed → 停止`);
      break;
    }

    // ============================
    //  🔍 ページ内の video-item を抽出
    // ============================
    const items = await page.evaluate(() => {
      const results = [];

      document.querySelectorAll('[data-testid="video-item"]').forEach((el) => {
        const a = el.querySelector("a");
        const img = el.querySelector("img");

        const url = a ? "https://spankbang.com" + a.getAttribute("href") : null;
        if (!url) return;

        let thumbnail = img?.getAttribute("data-src") || img?.src || null;
        if (!thumbnail) return;

        // "//tbi.sb-cd.com/..." → "https://tbi.sb-cd.com/..."
        if (thumbnail.startsWith("//")) {
          thumbnail = "https:" + thumbnail;
        }

        const titleEl = el.querySelector(
          '[data-testid="video-info-with-badge"] [title]'
        );
        const title = titleEl?.textContent?.trim() || "";
        if (!title) return; // タイトル無しは除外

        const lenEl = el.querySelector('[data-testid="video-item-length"]');
        const duration = lenEl?.textContent?.trim() || "";

        results.push({
          url,
          title,
          thumbnail_url: thumbnail,
          duration,
          source: "spankbang",
          tags: ["asian"],
          is_asian: true,
        });
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
