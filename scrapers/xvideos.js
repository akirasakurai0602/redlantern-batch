import axios from "axios";
import * as cheerio from "cheerio";

const MAX_PAGES = 10;
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ================================
// 🔥 XVideos（japan/korean/chinese）完全版
// ================================
export async function scrapeXVideosPage() {
  const categories = [
    { tag: "japan", is_asian: true },
    { tag: "korean", is_asian: true },
    { tag: "chinese", is_asian: true },
  ];

  const allItems = [];
  const seen = new Set(); // 重複排除（URLキー）

  for (const cat of categories) {
    const BASE_URL = `https://www.xvideos.com/tags/${cat.tag}`;

    console.log(`\n### 🚀 XVideos CATEGORY: ${cat.tag} ###`);

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? BASE_URL : `${BASE_URL}/${page}`;
      console.log(`▶ XVideos: [${cat.tag}] Page ${page}: ${url}`);

      try {
        const res = await axios.get(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          },
        });

        const $ = cheerio.load(res.data);
        let count = 0;

        $(".thumb-block, .thumb-inside, .video-thumb").each((i, el) => {
          const root = $(el);

          // -----------------------------
          // URL
          // -----------------------------
          const a = root.find("a").first();
          const href = a.attr("href");
          if (!href || !href.startsWith("/video")) return;

          const videoUrl = "https://www.xvideos.com" + href;

          // 重複排除
          if (seen.has(videoUrl)) return;
          seen.add(videoUrl);

          // -----------------------------
          // Title（強化版）
          // -----------------------------
          let title =
            root.find(".title").text().trim() ||
            a.attr("title")?.trim() ||
            root.find("img").attr("alt")?.trim() ||
            root.find("p").text().trim() ||
            "";

          if (!title) return;

          // -----------------------------
          // Thumbnail
          // -----------------------------
          let thumbnail =
            root.find("img").attr("data-src") ||
            root.find("img").attr("src") ||
            "";

          if (!thumbnail) return;
          if (thumbnail.startsWith("//")) {
            thumbnail = "https:" + thumbnail;
          }

          // -----------------------------
          // Duration（3パターン対応）
          // -----------------------------
          let duration =
            root.find(".duration").text().trim() ||
            root.find(".thumb-under-duration").text().trim() ||
            root.find(".video-duration").text().trim() ||
            null;

          // -----------------------------
          // Push
          // -----------------------------
          allItems.push({
            url: videoUrl,
            title,
            thumbnail_url: thumbnail,
            duration,
            source: "xvideos",
            tags: [cat.tag],
            is_asian: cat.is_asian,
          });

          count++;
        });

        console.log(`✔ [${cat.tag}] Page ${page} → ${count} unique items`);

        await sleep(200 + Math.random() * 250);
      } catch (err) {
        console.warn(`⚠ XVideos [${cat.tag}] page ${page} failed, skip`);
        continue;
      }
    }
  }

  console.log(`\n🔥 XVideos Total fetched: ${allItems.length}\n`);
  return allItems;
}
