import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeXVideosPage() {
  const url = "https://www.xvideos.com/tags/asian";

  const res = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });

  const $ = cheerio.load(res.data);
  const items = [];

  // XVideos は thumb-block / thumb-inside / video-link が混在する
  $(".thumb-block, .thumb-inside, .video-thumb").each((i, el) => {
    const root = $(el);

    // ------------------------------
    // URL 取得
    // ------------------------------
    const a = root.find("a").first();
    const href = a.attr("href");
    if (!href || !href.startsWith("/video")) return;

    const url = "https://www.xvideos.com" + href;

    // ------------------------------
    // タイトル取得（最重要）
    // ------------------------------
    let title =
      root.find(".title").text().trim() ||
      a.attr("title")?.trim() ||
      root.find("img").attr("alt")?.trim() ||
      "";

    if (!title) return; // タイトル無しは不正データ → 排除

    // ------------------------------
    // サムネイル取得
    // ------------------------------
    let thumbnail =
      root.find("img").attr("data-src") || root.find("img").attr("src") || "";

    if (!thumbnail) return;

    // XVideos CDN の // → https に修正
    if (thumbnail.startsWith("//")) {
      thumbnail = "https:" + thumbnail;
    }

    items.push({
      url,
      title,
      thumbnail_url: thumbnail,
      source: "xvideos",
      tags: ["asian"],
      is_asian: true,
    });
  });

  console.log(`✔ XVideos fetched: ${items.length} items`);

  return items;
}
