import { Hono } from "https://deno.land/x/hono@v3.4.1/mod.ts";
import {
  DOMParser,
} from "https://deno.land/x/deno_dom@v0.1.37/deno-dom-wasm.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";

const app = new Hono();
const endpoint = Deno.env.get("ENDPOINT") || "";
const aPubUrl = Deno.env.get("APUB_URL") || "";

interface Article {
  text: string;
  images: string[];
}

async function getNikkanArticle(url: string): Promise<Article> {
  const res = await fetch(url);
  const text = await res.text();

  // parse text
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  const main = doc?.querySelector("#articleMain");
  const innerHtml = main?.innerHTML;
  const imgUrls = innerHtml?.match(/background-image: url\((.+?)\)/g)?.map((s) =>
    s.replace(/background-image: url\((.+?)\)/, "$1").replace('w200', 'w500')
  );

  const title = doc?.querySelector("header.article-title h1")?.textContent
    .trim();
  const body = doc?.querySelectorAll("div#news p");
  if (!title || !body) {
    throw new Error("Failed to parse article");
  }

  let content = `${title}\n\n`;
  for (let i = 0; i < body.length; i++) {
    const p = body[i];
    content += `${p.textContent.replaceAll("。", "。\n").replace(/」$/ig, "」\n")}\n`;
  }
  content += url;
  return {
    text: content,
    images: imgUrls || [],
  };
}
async function postToApub(article: Article): Promise<string> {
  const res = await fetch(aPubUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(article),
  });
  console.log(res);
  if (res.status !== 200) {
    throw new Error("Failed to post to Mastodon");
  }

  return res.json();
}

app.post(endpoint, async (c) => {
  const json = await c.req.json();
  const url = json.url;
  // get Article
  const article = await getNikkanArticle(url);
  // post to mastodon
  const postedUrl = await postToApub(article);
  console.log(postedUrl);

  c.status(200);
  return c.json({ result: "ok" });
});

Deno.serve(app.fetch);
