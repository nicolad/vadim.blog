import fs from "fs/promises";
import matter from "gray-matter";
import Link from "next/link";
import path from "path";

export const metadata = {
  title: "Tech Insights & Trends | Poshet Digital Blog",
  description:
    "Explore the latest in technology trends, insights, and innovations on Poshet Digital's blog. Stay updated with expert analysis and discussions.",
};

export default async function Page() {
  const posts = await getPosts();
  console.log(posts[0].post.date);
  return (
    <div className="prose prose-sm md:prose-base lg:prose-lg prose-slate">
      <h1>Blog</h1>
      <ul className="list-disc">
        {posts.map(({ post, params }) => (
          <li key={params.slug}>
            <Link
              href={`/blog/${params.slug}`}
              className="decoration-transparent"
            >
              {post.title}
            </Link>
            <br />
            <small>{post.date}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

const getPosts = async () => {
  const files = await fs.readdir(path.join(process.cwd(), "_posts"));

  const slugs = files.map((file) => file.replace(/\.mdx?$/, ""));

  let posts = [];

  for (const slug of slugs) {
    const file = await fs.readFile(
      path.join(process.cwd(), "_posts", `${slug}.mdx`),
      "utf8"
    );

    const { data } = matter(file);

    posts.push({
      params: {
        slug,
      },
      post: data,
    });
  }

  return posts.sort((a, b) => {
    return new Date(b.post.date).getTime() - new Date(a.post.date).getTime();
  });
};
