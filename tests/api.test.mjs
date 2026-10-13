import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createStore } from "../server/store.mjs";
import { createApi } from "../server/api.mjs";
function store(file = ":memory:") {
  const s = createStore(file);
  s.db
    .prepare("INSERT OR IGNORE INTO users VALUES(?,?,?,?)")
    .run("lin", "local:lin", "小林", "/avatars/lin.png");
  s.db
    .prepare("INSERT OR IGNORE INTO users VALUES(?,?,?,?)")
    .run("he", "local:he", "阿禾", "/avatars/he.png");
  return s;
}
const post = (s, uid = "lin", extra = {}) =>
  s.createPost(uid, {
    body: "生活里的一点小事。",
    tags: [],
    requestKey: randomUUID(),
    ...extra,
  });
const comment = (s, p, uid = "he", extra = {}) =>
  s.createComment(uid, p.id, {
    body: "看到你的感想了。",
    requestKey: randomUUID(),
    ...extra,
  });

test("shared SQLite records survive close and restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "readerweb-test-")),
    file = join(directory, "data.sqlite");
  let s = store(file);
  const p = post(s);
  const c = comment(s, p);
  s.close();
  s = createStore(file);
  assert.equal(s.post(p.id).body, p.body);
  assert.equal(s.listComments(p.id)[0].id, c.id);
  assert.equal(s.listPosts().posts.length, 1);
  s.close();
  rmSync(directory, { recursive: true, force: true });
});
test("author ownership is enforced by the server for posts and comments", () => {
  const s = store(),
    p = post(s),
    c = comment(s, p);
  for (const operation of [
    () => s.editPost("he", p.id, { body: "改写", tags: [] }),
    () => s.deletePost("he", p.id),
    () => s.editComment("lin", c.id, { body: "改写" }),
    () => s.deleteComment("lin", c.id),
  ])
    assert.throws(operation, (e) => e.status === 403);
  assert.equal(s.post(p.id).body, p.body);
  s.close();
});
test("same submission is idempotent, changed payload conflicts", () => {
  const s = store(),
    input = { body: "今天很好。", tags: ["日常"], requestKey: randomUUID() };
  const a = s.createPost("lin", input),
    b = s.createPost("lin", input);
  assert.equal(a.id, b.id);
  assert.equal(s.listPosts().posts.length, 1);
  assert.throws(
    () => s.createPost("lin", { ...input, body: "不一样" }),
    (e) => e.status === 409,
  );
  const reply = { body: "同感。", requestKey: randomUUID() };
  const c = s.createComment("he", a.id, reply);
  assert.equal(s.createComment("he", a.id, reply).id, c.id);
  assert.equal(s.post(a.id).commentCount, 1);
  s.close();
});
test("nested replies retain their tree when a parent is deleted", () => {
  const s = store(),
    p = post(s),
    parent = comment(s, p),
    child = comment(s, p, "lin", { parentId: parent.id }),
    sibling = comment(s, p, "lin", { parentId: parent.id });
  s.deleteComment("he", parent.id);
  const all = s.listComments(p.id);
  assert.equal(all.find((c) => c.id === parent.id).body, null);
  assert.equal(all.find((c) => c.id === child.id).parentId, parent.id);
  assert.equal(all.find((c) => c.id === sibling.id).parentId, parent.id);
  assert.equal(s.post(p.id).commentCount, 2);
  assert.throws(
    () => comment(s, p, "lin", { parentId: parent.id }),
    (e) => e.status === 410,
  );
  comment(s, p, "he", { parentId: child.id });
  s.close();
});
test("a reply cannot point to another post; deleted posts close discussion", () => {
  const s = store(),
    a = post(s),
    b = post(s),
    c = comment(s, a);
  assert.throws(
    () => comment(s, b, "he", { parentId: c.id }),
    (e) => e.status === 400,
  );
  s.deletePost("lin", a.id);
  assert.equal(s.post(a.id).body, null);
  assert.throws(
    () => s.listComments(a.id),
    (e) => e.status === 410,
  );
  assert.throws(
    () => comment(s, a),
    (e) => e.status === 410,
  );
  assert.equal(s.listPosts().posts.length, 1);
  s.close();
});
test("normalized tags, combined date filter, deletion and original activity date", () => {
  const s = store(),
    a = post(s, "lin", { tags: ["ＧＰＴ", "日常"] }),
    b = post(s, "he", { tags: ["gpt"] });
  s.db
    .prepare("UPDATE posts SET created_at=? WHERE id=?")
    .run("2026-10-12T18:00:00Z", a.id);
  s.db
    .prepare("UPDATE posts SET created_at=? WHERE id=?")
    .run("2026-10-11T18:00:00Z", b.id);
  const tag = s.tags().find((t) => t.name === "GPT");
  assert.ok(tag);
  assert.equal(
    s.tags().filter((t) => t.name.toLowerCase() === "gpt").length,
    1,
  );
  assert.deepEqual(
    s.listPosts({ tag: tag.id, date: "2026-10-13" }).posts.map((p) => p.id),
    [a.id],
  );
  s.editPost("lin", a.id, { body: "编辑后", tags: ["gpt", "日常"] });
  comment(s, a);
  assert.equal(s.activity().find((d) => d.date === "2026-10-13").count, 1);
  s.deletePost("lin", a.id);
  assert.equal(
    s.activity().find((d) => d.date === "2026-10-13"),
    undefined,
  );
  assert.equal(
    s.tags().some((t) => t.name === "日常"),
    false,
  );
  s.close();
});
test("failed tag edits roll back and pagination stays ordered", () => {
  const s = store(),
    a = post(s);
  assert.throws(() =>
    s.editPost("lin", a.id, { body: "不得保存", tags: ["非法 标签"] }),
  );
  assert.equal(s.post(a.id).body, a.body);
  for (let i = 0; i < 24; i++) {
    const p = post(s);
    s.db
      .prepare("UPDATE posts SET created_at=? WHERE id=?")
      .run(new Date(1700000000000 + i * 1000).toISOString(), p.id);
  }
  const one = s.listPosts(),
    two = s.listPosts({ page: 1 });
  assert.equal(one.posts.length, 20);
  assert.equal(one.hasMore, true);
  assert.equal(two.posts.length, 5);
  assert.equal(new Set([...one.posts, ...two.posts].map((p) => p.id)).size, 25);
  s.close();
});
test("HTTP identity switch is local-only and client author fields are ignored", async () => {
  const s = store(),
    handle = createApi(s, { development: true });
  const call = (path, options = {}) =>
    handle(new Request("http://localhost:5173/api" + path, options), {
      loopback: true,
    });
  const session = await call("/dev/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "he" }),
  });
  assert.equal(session.status, 200);
  assert.match(session.headers.get("set-cookie"), /HttpOnly/);
  const response = await call("/posts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "readerweb_user=he",
    },
    body: JSON.stringify({
      body: "朋友的一句话",
      tags: [],
      requestKey: randomUUID(),
      authorId: "lin",
    }),
  });
  assert.equal((await response.json()).post.author.id, "he");
  const prod = createApi(s, { development: false });
  const denied = await prod(
    new Request("http://localhost/api/dev/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "lin" }),
    }),
    { loopback: true },
  );
  assert.equal(denied.status, 404);
  const spoof = await prod(
    new Request("http://localhost/api/posts", {
      headers: { "oai-authenticated-user-id": "lin" },
    }),
    { loopback: true },
  );
  assert.equal(spoof.status, 401);
  const remote = await handle(new Request("http://localhost/api/posts"), {
    loopback: false,
  });
  assert.equal(remote.status, 401);
  s.close();
});
test("invalid JSON shapes and cross-origin writes fail safely", async () => {
  const s = store(),
    handle = createApi(s, { development: true });
  const malformed = await handle(
    new Request("http://localhost/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    }),
    { loopback: true },
  );
  assert.equal(malformed.status, 400);
  const cross = await handle(
    new Request("http://localhost/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://elsewhere.example",
      },
      body: "{}",
    }),
    { loopback: true },
  );
  assert.equal(cross.status, 403);
  s.close();
});
