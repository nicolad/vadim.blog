/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://www.vadim.blog",
  generateRobotsTxt: true, // (optional)
  exclude: ["/server-sitemap-index.xml"], // <= exclude here
  robotsTxtOptions: {
    additionalSitemaps: [
      "https://www.vadim.blog/server-sitemap-index.xml", // <==== Add here
    ],
  },
};
