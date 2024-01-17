import React from "react";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Icons } from "@/components/icons";

import Link from "next/link";
import Image from "next/image";

type Props = { params: { slug: string } };

export default async function Post({ params }: Props) {
  const props = await getPost(params);

  if (!props.content) return <div>404</div>;
  return (
    <article className="prose prose-sm md:prose-base lg:prose-lg prose-slate mx-auto pb-16">
      <Link
        className="flex items-center gap-2 mb-2 decoration-transparent"
        href="/blog"
      >
        <Icons.ChevronLeft size={16} /> Posts
      </Link>

      {/* image */}
      {props.frontMatter.image && (
        <div className="relative w-full h-48 sm:h-72 mb-16">
          <Image
            src={props.frontMatter.image}
            className="object-cover object-center rounded-lg"
            fill
            alt={"image for " + props.frontMatter.title}
          />
        </div>
      )}

      <h1>{props.frontMatter.title}</h1>
      <span className="my-0 py-0 flex items-center gap-2">
        <Icons.Calendar size={16} />{" "}
        {new Date(props.frontMatter.date).toLocaleString("en-US", {
          dateStyle: "long",
        })}
      </span>
      {/* Author */}
      <span id="author" className="flex items-center">
        <Icons.UserCircleIcon size={16} />{" "}
        <span className="ml-2">{`Written by: ${props.frontMatter.author}`}</span>
      </span>
      {/* @ts-expect-error Server Component*/}
      <MDXRemote source={props.content} />
    </article>
  );
}

export async function generateMetadata({ params }: any) {
  const blog = await getPost(params);

  if (!blog.frontMatter) return {};
  return {
    title: blog.frontMatter.title,
    description: blog.frontMatter.description,
    openGraph: {
      images: [blog.frontMatter.image],
      title: blog.frontMatter.title,
      description: blog.frontMatter.description,
      url: `https://www.poshet.co/blog/${params.slug}`,
    },
    alternates: {
      canonical: `https://www.poshet.co/blog/${params.slug}`,
    },
  };
}

export async function generateStaticParams() {
  const files = await fs.readdir(path.join(process.cwd(), "_posts"));
  const slugs = files.map((file) => file.replace(/\.mdx?$/, ""));

  return slugs.map((slug) => ({ params: { slug } }));
}

async function getPost({ slug }: { slug: string }) {
  let markdownFile;

  try {
    markdownFile = await fs.readFile(
      path.join("_posts", slug + ".mdx"),
      "utf-8"
    );
  } catch (e) {
    return {};
  }

  const { data: frontMatter, content } = matter(markdownFile);

  return {
    frontMatter,
    slug,
    content,
  };
}
