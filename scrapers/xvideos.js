import axios from "axios";
import * as cheerio from "cheerio";

// 取得ページ数（必要に応じて増やせる）
const MAX_PAGES = 10;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function scrapeXVideosPage() {
  const BASE_URL = "https://www.xvideos.com/tags/asian";
  const items = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? BASE_URL : `${BASE_URL}/${page}`;
    console.log(`▶ XVideos: Page ${page} → ${url}`);

    try {
      const res = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        },
      });

      const $ = cheerio.load(res.data);

      $(".thumb-block, .thumb-inside, .video-thumb").each((i, el) => {
        const root = $(el);

        // ------------------------------
        // URL 取得
        // ------------------------------
        const a = root.find("a").first();
        const href = a.attr("href");
        if (!href || !href.startsWith("/video")) return;

        const videoUrl = "https://www.xvideos.com" + href;

        // ------------------------------
        // タイトル取得（最重要）
        // ------------------------------
        let title =
          root.find(".title").text().trim() ||
          a.attr("title")?.trim() ||
          root.find("img").attr("alt")?.trim() ||
          "";

        if (!title) return;

        // ------------------------------
        // サムネイル取得
        // ------------------------------
        let thumbnail =
          root.find("img").attr("data-src") ||
          root.find("img").attr("src") ||
          "";

        if (!thumbnail) return;

        if (thumbnail.startsWith("//")) {
          thumbnail = "https:" + thumbnail;
        }

        items.push({
          url: videoUrl,
          title,
          thumbnail_url: thumbnail,
          source: "xvideos",
          tags: ["asian"],
          is_asian: true,
        });
      });

      // Ban 回避：少し待つ
      await sleep(200 + Math.random() * 250);
    } catch (err) {
      console.warn(`⚠ XVideos page ${page} failed, skipping...`);
      continue;
    }
  }

  console.log(`🔥 XVideos fetched total: ${items.length} items`);
  return items;
}
