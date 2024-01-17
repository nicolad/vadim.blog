/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://www.poshet.co",
  generateRobotsTxt: true, // (optional)
  exclude: ["/server-sitemap-index.xml"], // <= exclude here
  robotsTxtOptions: {
    additionalSitemaps: [
      "https://www.poshet.co/server-sitemap-index.xml", // <==== Add here
    ],
  },
};
