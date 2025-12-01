import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

const MAX_PAGES = 15; // ← 取得ページ数
const CONCURRENCY = 3; // ← 同時に開くページ数（3〜5推奨）

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

  const allItems = [];

  // ======================================
  // 🔥 指定ページを1つだけ処理する関数
  // ======================================
  async function scrapeSinglePage(pageNum) {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    );

    const url =
      pageNum === 1
        ? "https://spankbang.com/s/asian/"
        : `https://spankbang.com/s/asian/${pageNum}/`;

    console.log(`▶ SpankBang Fetch Page ${pageNum}: ${url}`);

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });

      await page.waitForSelector('[data-testid="video-item"]', {
        timeout: 20000,
      });

      const items = await page.evaluate(() => {
        const results = [];

        document
          .querySelectorAll('[data-testid="video-item"]')
          .forEach((el) => {
            const a = el.querySelector("a");
            const img = el.querySelector("img");

            const url = a
              ? "https://spankbang.com" + a.getAttribute("href")
              : null;
            if (!url) return;

            let thumbnail = img?.getAttribute("data-src") || img?.src || null;
            if (!thumbnail) return;

            if (thumbnail.startsWith("//")) {
              thumbnail = "https:" + thumbnail;
            }

            const titleEl = el.querySelector(
              '[data-testid="video-info-with-badge"] [title]'
            );
            const title = titleEl?.textContent?.trim() || "";
            if (!title) return;

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

      console.log(`✔ Page ${pageNum} → ${items.length} items`);

      await page.close();
      return items;
    } catch (err) {
      console.log(`⚠ Page ${pageNum} failed`);
      await page.close();
      return [];
    }
  }

  // ======================================
  // 🔥 並列実行（バッチ処理）
  // ======================================
  const pageNumbers = Array.from({ length: MAX_PAGES }, (_, i) => i + 1);

  for (let i = 0; i < pageNumbers.length; i += CONCURRENCY) {
    const batch = pageNumbers.slice(i, i + CONCURRENCY);

    console.log(`🚀 Running batch: ${batch.join(", ")}`);

    const results = await Promise.all(batch.map((p) => scrapeSinglePage(p)));

    results.forEach((items) => allItems.push(...items));
  }

  await browser.close();
  console.log(`🔥 SpankBang total fetched: ${allItems.length}`);

  return allItems;
}
