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

  // ================================
  // 📌 画像キャプチャ設定
  // ================================
  await page.setRequestInterception(true);

  let imageUrls = new Map(); // key: vid, value: thumbnail URL

  page.on("request", (req) => {
    if (req.resourceType() === "image") {
      const url = req.url();

      if (url.includes("img.javynow.com")) {
        const match = url.match(/files\/(\d+)\/(\d+)\.jpg/);
        if (match) {
          const vid = match[2];
          imageUrls.set(vid, url);
        }
      }
    }
    req.continue();
  });

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );

  const BASE = "https://javynow.com/search/asian";

  const all = [];
  const seen = new Set();

  // ================================
  // 🔁 ページ巡回
  // ================================
  for (let i = 1; i <= MAX_PAGES; i++) {
    const url = i === 1 ? BASE : `${BASE}?p=${i}`;
    console.log(`▶ JavyNow Page ${i}: ${url}`);
    imageUrls.clear();

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
      await page.waitForSelector(".video", { timeout: 20000 });
    } catch (e) {
      console.log("⚠︎ JavyNow failed:", e.message);
      break;
    }

    // ================================
    // 🎯 メイン情報を取得
    // ================================
    const items = await page.evaluate(() => {
      const arr = [];

      document.querySelectorAll(".video").forEach((el) => {
        const a = el.querySelector(".video__thumb a");
        if (!a) return;

        const href = a.getAttribute("href");
        const vid = el.getAttribute("data-vid");
        const title =
          el.querySelector(".video__title")?.textContent?.trim() || "";
        const duration =
          el.querySelector(".video__duration__value")?.textContent?.trim() ||
          "";

        if (!href || !vid) return;

        arr.push({
          vid,
          url: "https://javynow.com" + href,
          title,
          duration,
        });
      });

      return arr;
    });

    // ================================
    // 🖼 サムネ紐付け & 重複排除
    // ================================
    for (const it of items) {
      it.thumbnail_url = imageUrls.get(it.vid) || null;
      it.tags = ["asian"];
      it.is_asian = true;
      it.source = "javynow";

      if (seen.has(it.url)) continue; // 重複防止
      seen.add(it.url);

      all.push(it); // ← pushは1回だけ
    }

    console.log(
      `✔ Page ${i}: Added ${items.length} items (unique so far: ${all.length})`
    );
  }

  await browser.close();

  console.log(`🔥 JavyNow fetched total unique: ${all.length}`);
  return all;
}
