import { ISitemapField, getServerSideSitemap } from "next-sitemap";
import fs from "fs/promises";

export async function GET(request: Request) {
  // Method to source urls from cms
  // const urls = await fetch('https//example.com/api')

  const allposts = await fs.readdir(process.cwd() + "/_posts");

  const urls = allposts.map((post) => {
    return {
      loc: `https://www.poshet.co/blog/${post.replace(".mdx", "")}`,
      lastmod: new Date().toISOString(),
    } as ISitemapField;
  });

  return getServerSideSitemap([...urls]);
}
