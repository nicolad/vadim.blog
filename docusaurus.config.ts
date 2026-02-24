import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const config: Config = {
  title: "Vadim's blog",
  tagline: "Software engineering, AI, and web development insights by Vadim Nicolai",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://vadim.blog",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "nicolad", // Usually your GitHub org/user name.
  projectName: "vadim.blog", // Usually your repo name.

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },
  headTags: [
    {
      tagName: "meta",
      attributes: {
        name: "description",
        content:
          "Vadim Nicolai's blog on software engineering, AI, web development, and technology insights.",
      },
    },
    {
      tagName: "script",
      attributes: {
        type: "application/ld+json",
      },
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "Vadim's blog",
        url: "https://vadim.blog",
        description:
          "Software engineering, AI, and web development insights by Vadim Nicolai",
        author: {
          "@type": "Person",
          name: "Vadim Nicolai",
          url: "https://www.linkedin.com/in/vadimnicolai/",
        },
      }),
    },
  ],
  themes: ["@docusaurus/theme-mermaid"],
  presets: [
    [
      "classic",
      {
        docs: false,
        blog: {
          routeBasePath: "/", // Serve the blog at the site's root
          blogSidebarCount: "ALL",
          blogDescription:
            "Articles on AI engineering, LLM agents, eval-driven development, edge computing, and TypeScript/Rust by Vadim Nicolai.",
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          editUrl: "https://github.com/nicolad/vadim.blog/edit/main",
          // Useful options to enforce blogging best practices
          onInlineTags: "ignore",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/docusaurus-social-card.jpg",
    colorMode: {
      defaultMode: "dark",
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "Vadim's blog",
      logo: {
        alt: "Vadim's blog logo",
        src: "img/logo.svg",
      },
    },
    footer: {
      style: "dark",
      links: [
        {
          items: [
            {
              label: "LinkedIn",
              href: "https://www.linkedin.com/in/vadimnicolai/",
            },
            {
              label: "GitHub",
              href: "https://github.com/nicolad",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
