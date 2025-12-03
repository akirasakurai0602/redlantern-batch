import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

const MAX_PAGES = 12;
const CONCURRENCY = 3;

const BASE = "https://spankbang.com";

const CATEGORIES = ["japanese", "korean", "chinese"]; // ← これだけ回す

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

  async function scrapeSingle(category, pageNum) {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    );

    const url =
      pageNum === 1
        ? `${BASE}/s/${category}/`
        : `${BASE}/s/${category}/${pageNum}/`;

    console.log(`▶ SpankBang [${category}] Page ${pageNum}: ${url}`);

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 80000,
      });

      // video-itemが表示されるのを待つ
      await page.waitForSelector('[data-testid="video-item"]', {
        timeout: 20000,
      });
    } catch (e) {
      console.log(`⚠ [${category}] Page ${pageNum} failed`);
      await page.close();
      return [];
    }

    const items = await page.evaluate(() => {
      function slugToTitle(href) {
        try {
          const m = href.match(/\/video\/([^\/]+)/);
          if (!m) return null;

          return decodeURIComponent(m[1])
            .replace(/\+/g, " ")
            .replace(/-/g, " ")
            .trim();
        } catch {
          return null;
        }
      }

      const results = [];

      document.querySelectorAll('[data-testid="video-item"]').forEach((el) => {
        const a = el.querySelector("a");
        if (!a) return;

        const url = "https://spankbang.com" + a.getAttribute("href");

        let img = el.querySelector("img");
        let thumbnail = img?.getAttribute("data-src") || img?.src || "";
        if (!thumbnail) return;
        if (thumbnail.startsWith("//")) thumbnail = "https:" + thumbnail;

        // 🔥 タイトル取得（最優先：h2）
        let title =
          el.querySelector(".video__title")?.textContent?.trim() ||
          el
            .querySelector('[data-testid="video-info-with-badge"] h2')
            ?.textContent?.trim() ||
          "";

        // 🔥 Fallback：slug からタイトル生成
        if (!title || title.length < 3) {
          const generated = slugToTitle(a.getAttribute("href"));
          if (generated) title = generated;
        }

        if (!title || title.length < 3) return;

        // duration の場所（英語版用）
        const durationEl = el.querySelector(
          ".video-item-length, .duration, [data-testid='video-item-length']"
        );
        const duration = durationEl?.textContent?.trim() || "";

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

    console.log(`✔ [${category}] Page ${pageNum} → ${items.length} items`);

    await page.close();
    return items;
  }

  // 全カテゴリ × 全ページのタスク生成
  const tasks = [];
  for (const cat of CATEGORIES) {
    for (let p = 1; p <= MAX_PAGES; p++) {
      tasks.push({ cat, p });
    }
  }

  // バッチ処理（3並列）
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((t) => scrapeSingle(t.cat, t.p))
    );

    results.forEach((items) => allItems.push(...items));
  }

  await browser.close();

  console.log(`🔥 Total SpankBang fetched: ${allItems.length}`);
  return allItems;
}
