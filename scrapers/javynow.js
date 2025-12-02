import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

const MAX_PAGES = 10;

export async function scrapeJavyNowPage() {
  const browser = await puppeteer.launch({
    headless: false,
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

  for (let i = 1; i <= MAX_PAGES; i++) {
    const url =
      i === 1
        ? "https://javynow.com/search/asian"
        : `https://javynow.com/search/asian?page=${i}`;

    console.log(`▶ JavyNow Page ${i}: ${url}`);

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });

      // 🔥 LazyLoad を強制実行 → data-src を src にセット
      await page.evaluate(() => {
        document.querySelectorAll("img[data-src]").forEach((img) => {
          if (img.dataset.src) {
            img.src = img.dataset.src; // ← 強制的に本物を読ませる
          }
        });
      });

      // ".video" が描画されるまで待機
      await page.waitForSelector(".video", { timeout: 20000 });
    } catch (e) {
      console.log(`⚠ Page ${i} failed, stopping.`);
      break;
    }

    const items = await page.evaluate(() => {
      const arr = [];

      document.querySelectorAll(".video").forEach((el) => {
        const a = el.querySelector(".video__thumb a");
        if (!a) return;

        const href = a.getAttribute("href");
        if (!href) return;

        const videoUrl = "https://javynow.com" + href;

        const img = el.querySelector(".video__thumb img");

        // 🔥 data-src 更新後なので src に高解像度が入る
        let thumb = img?.getAttribute("src") || "";

        if (!thumb) return;
        if (thumb.startsWith("//")) thumb = "https:" + thumb;

        const title =
          el.querySelector(".video__title")?.textContent?.trim() || "";

        const duration =
          el.querySelector(".video__duration__value")?.textContent?.trim() ||
          "";

        if (!title) return;

        arr.push({
          url: videoUrl,
          title,
          thumbnail_url: thumb,
          duration,
          source: "javynow",
          tags: ["asian"],
          is_asian: true,
        });
      });

      return arr;
    });

    console.log(`✔ Page ${i}: ${items.length} items`);
    allItems.push(...items);
  }

  await browser.close();
  console.log(`🔥 JavyNow fetched total: ${allItems.length}`);

  return allItems;
}
