import fs from "fs/promises";
import Link from "next/link";
import path from "path";

export const metadata = {
  title: "Tech Insights | vadim.blog",
  description:
    "Explore the latest in technology trends, insights, and innovations on vadim.blog",
};

export default async function Page() {
  const posts = await getPosts();
  return (
    <div className="prose prose-sm md:prose-base lg:prose-lg prose-slate">
      <h2>Latest Posts</h2>
      <ul className="list-disc">
        {posts.map(({ post, params }) => (
          <li key={params.slug}>
            <Link href={`/${params.slug}`} className="decoration-transparent">
              {post.title}
            </Link>
            <br />
          </li>
        ))}
      </ul>
    </div>
  );
}

const getPosts = async () => {
  const files = await fs.readdir(path.join(process.cwd(), "app"));
  const slugs = files?.filter(
    (file) =>
      !(
        file.includes("default") ||
        file.includes("api") ||
        file.includes("layout") ||
        file.includes("sitemap") ||
        file.includes("css")
      )
  );

  let posts = [];

  for (const slug of slugs) {
    const file = await fs.readFile(
      path.join(process.cwd(), "app", `${slug}/page.tsx`),
      "utf8"
    );

    const firstH1Match = file.match(/<h1>([\s\S]*?)<\/h1>/);
    const firstH1 = firstH1Match ? firstH1Match[1].trim() : null;

    posts.push({
      params: {
        slug,
      },
      post: {
        title: firstH1,
      },
    });
  }

  return posts;
};
