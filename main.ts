import { Hono } from "https://deno.land/x/hono@v3.4.1/mod.ts";
import {
  DOMParser,
} from "https://deno.land/x/deno_dom@v0.1.37/deno-dom-wasm.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";

const app = new Hono();
const endpoint = Deno.env.get("ENDPOINT") || "";
const aPubUrl = Deno.env.get("APUB_URL") || "";

async function getNikkanArticle(url: string): Promise<string> {
  const res = await fetch(url);
  const text = await res.text();
  // parse text
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const title = doc?.querySelector("header.article-title h1")?.textContent
    .trim();
  const body = doc?.querySelectorAll("div#news p");

  let content = title + "\n\n";
  for (let i = 0; i < body!.length; i++) {
    const p = body![i];
    content += p.textContent.replaceAll("。", "。\n").replace(/」$/ig, "」\n") +
      "\n";
  }
  content += url;
  return content;
}

async function postToMastodon(content: string): Promise<void> {
  const res = await fetch(aPubUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "text": content,
    }),
  });
  console.log(res);
  if (res.status !== 200) {
    throw new Error("Failed to post to Mastodon");
  }
}

app.post(endpoint, async (c) => {
  const json = await c.req.json();
  const url = json.url;
  // get Article
  const content = await getNikkanArticle(url);
  // post to mastodon
  await postToMastodon(content);

  c.status(200);
  return c.json({ result: "ok" });
});

Deno.serve(app.fetch);
