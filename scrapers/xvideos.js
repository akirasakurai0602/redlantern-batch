import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeXVideosPage() {
  const url = "https://www.xvideos.com/tags/asian";

  const res = await axios.get(url);
  const $ = cheerio.load(res.data);

  const items = [];

  $(".thumb-block").each((i, el) => {
    const link = $(el).find("a").attr("href");
    const title = $(el).find("a").attr("title");
    const thumb = $(el).find("img").attr("data-src");

    if (link) {
      items.push({
        url: "https://www.xvideos.com" + link,
        title: title || "",
        thumbnail_url: thumb || "",
        source: "xvideos",
        tags: ["asian"],
        is_asian: true,
      });
    }
  });

  return items;
}
