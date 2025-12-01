import axios from "axios";
import * as cheerio from "cheerio";

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

        // =============================
        // URL
        // =============================
        const a = root.find("a").first();
        const href = a.attr("href");
        if (!href || !href.startsWith("/video")) return;

        const videoUrl = "https://www.xvideos.com" + href;

        // =============================
        // Title
        // =============================
        let title =
          root.find(".title").text().trim() ||
          a.attr("title")?.trim() ||
          root.find("img").attr("alt")?.trim() ||
          "";

        if (!title) return;

        // =============================
        // Thumbnail
        // =============================
        let thumbnail =
          root.find("img").attr("data-src") ||
          root.find("img").attr("src") ||
          "";

        if (!thumbnail) return;

        if (thumbnail.startsWith("//")) {
          thumbnail = "https:" + thumbnail;
        }

        // =============================
        // ⭐ Duration（3パターン対応）
        // =============================
        let duration =
          root.find(".duration").text().trim() ||
          root.find(".video-duration").text().trim() ||
          root.find(".thumb-under-duration").text().trim() ||
          "";

        // 空なら undefined に
        if (!duration) duration = null;

        // =============================
        // push
        // =============================
        items.push({
          url: videoUrl,
          title,
          thumbnail_url: thumbnail,
          duration,
          source: "xvideos",
          tags: ["asian"],
          is_asian: true,
        });
      });

      await sleep(200 + Math.random() * 250); // BAN 回避
    } catch (err) {
      console.warn(`⚠ XVideos page ${page} failed, skipping...`);
      continue;
    }
  }

  console.log(`🔥 XVideos fetched total: ${items.length} items`);
  return items;
}
