import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getEntryPath } from "@/utils/contentEntry";
import getSortedPosts from "@/utils/getSortedPosts";
import { getLocalizedTitle } from "@/utils/localizedTitle";
import { SITE } from "@/config";
import { useTranslations } from "@/i18n/utils";

export async function generateLocaleRss(locale: "en" | "es" | "zh") {
  const t = useTranslations(locale);
  const prefix = locale === "es" ? "/es" : locale === "zh" ? "/zh" : "";
  const contentLocale = locale;
  const isMatchingLocale = (id: string) =>
    id.startsWith(`${contentLocale}/`) ||
    (locale === "en" && !id.startsWith("es/") && !id.startsWith("zh/"));

  const [blogPosts, galleryPosts] = await Promise.all([
    getCollection("blog", ({ id }) => isMatchingLocale(id)),
    SITE.showGalleries && SITE.showGalleriesInIndex
      ? getCollection("galleries", ({ id }) => isMatchingLocale(id))
      : Promise.resolve([]),
  ]);
  const sortedPosts = getSortedPosts([...blogPosts, ...galleryPosts]);
  return rss({
    title: SITE.title,
    description: locale === "es" ? t("index.heroDesc") : SITE.desc,
    site: SITE.website,
    items: sortedPosts.map(entry => ({
      link: `${prefix}${getEntryPath(entry)}`,
      title: getLocalizedTitle(entry.id, entry.data.title, locale),
      description: entry.data.description,
      pubDate: new Date(
        "modDatetime" in entry.data && entry.data.modDatetime
          ? entry.data.modDatetime
          : entry.data.pubDatetime
      ),
    })),
  });
}

export const GET = () => generateLocaleRss("en");
