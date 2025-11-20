import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

export async function scrapeSpankbangPage() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );

  await page.goto("https://spankbang.com/s/asian/", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  // 🔥 動画一覧が描画されるまで待機
  await page.waitForSelector('[data-testid="video-item"]', {
    timeout: 20000,
  });

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

      const lengthEl = el.querySelector('[data-testid="video-item-length"]');
      const duration = lengthEl?.innerText?.trim() || "";

      const resolutionEl = el.querySelector(
        '[data-testid="video-item-resolution"]'
      );
      const resolution = resolutionEl?.innerText?.trim() || "";

      if (url && thumbnail) {
        results.push({
          url,
          title,
          thumbnail_url: thumbnail,
          duration,
          resolution,
          source: "spankbang",
          tags: ["asian"],
          is_asian: true,
        });
      }
    });

    return results;
  });

  await browser.close();
  return items;
}
