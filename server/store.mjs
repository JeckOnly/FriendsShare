import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export class ApiError extends Error {
  constructor(status, message, code = "VALIDATION_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, message, code) => {
  throw new ApiError(status, message, code);
};
export function normalizeTag(value) {
  if (typeof value !== "string") fail(400, "标签名称无效。");
  const name = value.normalize("NFKC").trim().replace(/^#+/, "").trim();
  if (!name || [...name].length > 20 || /[\s#\/\p{Cc}]/u.test(name))
    fail(400, "标签需为1–20个字符，不含空格或特殊分隔符。");
  return { name, normalized: name.toLowerCase() };
}
function text(value, max) {
  if (typeof value !== "string" || !value.trim())
    fail(400, "写一点内容再发送吧。");
  const body = value.trim();
  if ([...body].length > max) fail(400, `最多可以输入${max}个字符。`);
  return body;
}
function requestKey(value) {
  if (typeof value !== "string" || !/^[\w-]{1,100}$/.test(value))
    fail(400, "提交标识无效，请重新发送。");
  return value;
}
export function createStore(filename, { seed = false } = {}) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;",
  );
  const fresh = db.prepare("PRAGMA user_version").get().user_version === 0;
  if (fresh)
    db.exec(
      readFileSync(
        new URL("./migrations/001-initial.sql", import.meta.url),
        "utf8",
      ),
    );
  const tx = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const user = (id) =>
    db.prepare("SELECT id, name, avatar FROM users WHERE id=?").get(id);
  const users = () =>
    db.prepare("SELECT id, name, avatar FROM users ORDER BY id").all();
  const author = (id) => user(id) || fail(401, "请先登录。", "UNAUTHENTICATED");
  const tags = () =>
    db
      .prepare(
        "SELECT t.id, t.name FROM tags t WHERE EXISTS (SELECT 1 FROM post_tags pt JOIN posts p ON p.id=pt.post_id WHERE pt.tag_id=t.id AND p.deleted=0) ORDER BY t.normalized_name",
      )
      .all();
  const postTags = (id) =>
    db
      .prepare(
        "SELECT t.id,t.name FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=? ORDER BY t.normalized_name",
      )
      .all(id);
  function shapePost(p) {
    return {
      id: p.id,
      author: user(p.author_id),
      body: p.deleted ? null : p.body,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      deleted: !!p.deleted,
      tags: p.deleted ? [] : postTags(p.id),
      commentCount: p.deleted
        ? 0
        : db
            .prepare(
              "SELECT COUNT(*) AS n FROM comments WHERE post_id=? AND deleted=0",
            )
            .get(p.id).n,
    };
  }
  function getPost(id, { active = false } = {}) {
    const p = db.prepare("SELECT * FROM posts WHERE id=?").get(id);
    if (!p) fail(404, "没有找到这条感想。", "NOT_FOUND");
    if (active && p.deleted)
      fail(410, "这条感想已删除。", "CONTENT_UNAVAILABLE");
    return p;
  }
  function prepareTags(values = []) {
    if (!Array.isArray(values) || values.length > 3)
      fail(400, "最多添加3个标签。");
    const unique = new Map(
      values.map((v) => {
        const t = normalizeTag(v);
        return [t.normalized, t];
      }),
    );
    return [...unique.values()];
  }
  function linkTags(postId, list) {
    db.prepare("DELETE FROM post_tags WHERE post_id=?").run(postId);
    for (const tag of list) {
      let saved = db
        .prepare("SELECT id FROM tags WHERE normalized_name=?")
        .get(tag.normalized);
      if (!saved) {
        saved = { id: randomUUID() };
        db.prepare("INSERT INTO tags VALUES(?,?,?)").run(
          saved.id,
          tag.name,
          tag.normalized,
        );
      }
      db.prepare("INSERT INTO post_tags VALUES(?,?)").run(postId, saved.id);
    }
  }
  function listPosts({ tag, date, page = 0 } = {}) {
    const conditions = ["p.deleted=0"],
      args = [];
    if (tag) {
      conditions.push(
        "EXISTS (SELECT 1 FROM post_tags WHERE post_id=p.id AND tag_id=?)",
      );
      args.push(tag);
    }
    if (date) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date
      )
        fail(400, "日期格式无效。");
      conditions.push("strftime('%Y-%m-%d',p.created_at,'+8 hours')=?");
      args.push(date);
    }
    if (!Number.isInteger(page) || page < 0 || page > 10000)
      fail(400, "页码无效。");
    const rows = db
      .prepare(
        `SELECT p.* FROM posts p WHERE ${conditions.join(" AND ")} ORDER BY p.created_at DESC,p.id DESC LIMIT 21 OFFSET ?`,
      )
      .all(...args, page * 20);
    return {
      posts: rows.slice(0, 20).map(shapePost),
      hasMore: rows.length > 20,
    };
  }
  function createPost(userId, input) {
    author(userId);
    const body = text(input.body, 5000),
      list = prepareTags(input.tags),
      key = requestKey(input.requestKey);
    const payload = JSON.stringify({
      body,
      tags: list.map((t) => t.normalized).sort(),
    });
    return tx(() => {
      const prior = db
        .prepare("SELECT * FROM posts WHERE author_id=? AND request_key=?")
        .get(userId, key);
      if (prior) {
        if (prior.request_payload !== payload)
          fail(409, "这个提交标识已用于另一份内容。", "CONFLICT");
        return shapePost(prior);
      }
      const id = randomUUID(),
        now = new Date().toISOString();
      db.prepare(
        "INSERT INTO posts(id,author_id,body,created_at,updated_at,request_key,request_payload) VALUES(?,?,?,?,?,?,?)",
      ).run(id, userId, body, now, now, key, payload);
      linkTags(id, list);
      return shapePost(getPost(id));
    });
  }
  function editPost(userId, id, input) {
    author(userId);
    return tx(() => {
      const p = getPost(id, { active: true });
      if (p.author_id !== userId)
        fail(403, "只能修改自己写的感想。", "FORBIDDEN");
      const body = text(input.body, 5000),
        list = prepareTags(input.tags);
      db.prepare("UPDATE posts SET body=?,updated_at=? WHERE id=?").run(
        body,
        new Date().toISOString(),
        id,
      );
      linkTags(id, list);
      return shapePost(getPost(id));
    });
  }
  function deletePost(userId, id) {
    const p = getPost(id);
    author(userId);
    if (p.author_id !== userId) fail(403, "只能删除自己的感想。", "FORBIDDEN");
    db.prepare(
      "UPDATE posts SET deleted=1,body='',updated_at=? WHERE id=?",
    ).run(new Date().toISOString(), id);
    return { ok: true };
  }
  function shapeComment(c) {
    return {
      id: c.id,
      postId: c.post_id,
      parentId: c.parent_id,
      author: user(c.author_id),
      body: c.deleted ? null : c.body,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      deleted: !!c.deleted,
    };
  }
  function getComment(id) {
    return (
      db.prepare("SELECT * FROM comments WHERE id=?").get(id) ||
      fail(404, "没有找到这条评论。", "NOT_FOUND")
    );
  }
  function listComments(postId) {
    getPost(postId, { active: true });
    return db
      .prepare("SELECT * FROM comments WHERE post_id=? ORDER BY created_at,id")
      .all(postId)
      .map(shapeComment);
  }
  function createComment(userId, postId, input) {
    author(userId);
    const body = text(input.body, 2000),
      key = requestKey(input.requestKey),
      parent = input.parentId || null;
    if (parent !== null && typeof parent !== "string")
      fail(400, "回复对象无效。");
    const payload = JSON.stringify({ postId, parent, body });
    return tx(() => {
      getPost(postId, { active: true });
      const prior = db
        .prepare("SELECT * FROM comments WHERE author_id=? AND request_key=?")
        .get(userId, key);
      if (prior) {
        if (prior.request_payload !== payload)
          fail(409, "这个提交标识已用于另一份内容。", "CONFLICT");
        return shapeComment(prior);
      }
      if (parent) {
        const target = getComment(parent);
        if (target.post_id !== postId) fail(400, "回复必须属于同一条感想。");
        if (target.deleted)
          fail(410, "这条评论已删除，文字已为你保留。", "CONTENT_UNAVAILABLE");
      }
      const id = randomUUID(),
        now = new Date().toISOString();
      db.prepare(
        "INSERT INTO comments(id,post_id,author_id,parent_id,body,created_at,updated_at,request_key,request_payload) VALUES(?,?,?,?,?,?,?,?,?)",
      ).run(id, postId, userId, parent, body, now, now, key, payload);
      return shapeComment(getComment(id));
    });
  }
  function editComment(userId, id, input) {
    const c = getComment(id);
    author(userId);
    getPost(c.post_id, { active: true });
    if (c.author_id !== userId) fail(403, "只能修改自己的评论。", "FORBIDDEN");
    if (c.deleted) fail(410, "这条评论已删除。", "CONTENT_UNAVAILABLE");
    db.prepare("UPDATE comments SET body=?,updated_at=? WHERE id=?").run(
      text(input.body, 2000),
      new Date().toISOString(),
      id,
    );
    return shapeComment(getComment(id));
  }
  function deleteComment(userId, id) {
    const c = getComment(id);
    author(userId);
    getPost(c.post_id, { active: true });
    if (c.author_id !== userId) fail(403, "只能删除自己的评论。", "FORBIDDEN");
    db.prepare(
      "UPDATE comments SET deleted=1,body='',updated_at=? WHERE id=?",
    ).run(new Date().toISOString(), id);
    return { ok: true };
  }
  function activity() {
    return db
      .prepare(
        "SELECT strftime('%Y-%m-%d',created_at,'+8 hours') AS date,COUNT(*) AS count FROM posts WHERE deleted=0 GROUP BY date",
      )
      .all();
  }
  const store = {
    db,
    user,
    users,
    tags,
    listPosts,
    post: (id) => shapePost(getPost(id)),
    createPost,
    editPost,
    deletePost,
    listComments,
    createComment,
    editComment,
    deleteComment,
    activity,
    close: () => db.close(),
  };
  if (fresh && seed) seedDemo(store);
  return store;
}
export function seedDemo(store) {
  const { db } = store;
  db.prepare("INSERT OR IGNORE INTO users VALUES(?,?,?,?)").run(
    "lin",
    "local:lin",
    "小林",
    "/avatars/lin.png",
  );
  db.prepare("INSERT OR IGNORE INTO users VALUES(?,?,?,?)").run(
    "he",
    "local:he",
    "阿禾",
    "/avatars/he.png",
  );
  const samples = [
    [
      "lin",
      0,
      "傍晚出去散步，走到河边时刚好看见一片很亮的云。\n\n最近总想着把每一天安排得满满的，今天忽然觉得，能这样慢慢走一会儿，也已经很好了。",
      ["日常", "心情"],
    ],
    [
      "he",
      1,
      "今天把手机留在家里，去楼下买了一束花。\n回来才发现，没看消息的那半个小时，居然记得路上发生的好多小事。",
      ["日常"],
    ],
    [
      "lin",
      2,
      "读到一句话：“生活不是用来完成的，而是用来感受的。”\n\n放下书的时候，窗外有风吹过树叶。好像也没想明白什么，但心里安静了一点。",
      ["读书", "心情"],
    ],
    [
      "he",
      3,
      "雨天适合听旧歌。听到大学时常放的那首，突然想起从宿舍走到食堂的那条路。\n原来很多记忆不是消失了，只是在等一个声音。",
      ["音乐", "日常"],
    ],
    [
      "lin",
      5,
      "给自己做了一顿很普通的晚饭：番茄炒蛋，米饭，还有一小碗汤。认真吃完，洗了碗。\n\n这样的一天，也值得记一下。",
      ["日常"],
    ],
    [
      "he",
      8,
      "朋友发来一张她家猫睡在书上的照片。聊了两句，整个下午的疲惫好像就轻了一点。\n有些陪伴真的不用很多话。",
      ["朋友"],
    ],
    [
      "lin",
      13,
      "周末没有安排。睡到自然醒，给植物浇水，读了二十页书。\n能允许自己什么都不赶，是最近学到的一件小事。",
      ["心情", "读书"],
    ],
    [
      "he",
      18,
      "下班路上绕去看了一眼海。天已经暗下来，人很少。\n站了一会儿再回家，好像把今天也放下了。",
      ["散步"],
    ],
    [
      "lin",
      24,
      "第一次试着自己烤面包，样子不太好看，但屋子里都是香味。\n切第一片的时候觉得：做一件新鲜的小事，还是会开心。",
      ["日常"],
    ],
    [
      "he",
      32,
      "昨晚和老朋友聊到很晚。没有讨论什么大事，只说最近吃了什么、路过了哪里。\n很喜欢这种不用解释太多的关系。",
      ["朋友"],
    ],
    [
      "lin",
      43,
      "一早拉开窗帘，阳光正好落在桌角。\n今天的第一件事是，坐在那里喝完了一杯茶。",
      ["日常"],
    ],
    [
      "he",
      57,
      "重新翻起一本以前看不进去的书。这一次居然读得很慢，也很喜欢。\n书没变，大概是自己有了一点不同。",
      ["读书"],
    ],
    [
      "lin",
      69,
      "走路回家，顺手买了一袋刚炒好的栗子。握在手里热乎乎的。\n秋天总有一些很小的好。",
      ["日常"],
    ],
  ];
  let first;
  samples.forEach(([uid, days, body, tags], i) => {
    const p = store.createPost(uid, {
      body,
      tags,
      requestKey: `seed-post-${i}`,
    });
    const at = new Date(Date.now() - days * 86400000 - 3600000).toISOString();
    db.prepare("UPDATE posts SET created_at=?,updated_at=? WHERE id=?").run(
      at,
      at,
      p.id,
    );
    if (!i) first = p.id;
  });
  const c1 = store.createComment("he", first, {
    body: "很喜欢这种什么都不赶的时刻。最近也开始下班后走一小段路。",
    requestKey: "seed-c1",
  });
  const c2 = store.createComment("lin", first, {
    body: "是的，走着走着就不那么着急了。你一般走去哪儿？",
    parentId: c1.id,
    requestKey: "seed-c2",
  });
  const c3 = store.createComment("he", first, {
    body: "小区旁边的公园。现在桂花开了，有一段路特别香。",
    parentId: c2.id,
    requestKey: "seed-c3",
  });
  const c4 = store.createComment("lin", first, {
    body: "听起来好舒服。周末想去看看。",
    parentId: c3.id,
    requestKey: "seed-c4",
  });
  const c5 = store.createComment("he", first, {
    body: "那就约一个慢慢散步的下午。",
    parentId: c4.id,
    requestKey: "seed-c5",
  });
  store.createComment("lin", first, {
    body: "好啊，带两杯热茶。",
    parentId: c5.id,
    requestKey: "seed-c6",
  });
  store.createComment("lin", first, {
    body: "有时也会拍一张照片，留给之后的自己。",
    parentId: c1.id,
    requestKey: "seed-c7",
  });
  store.createComment("he", first, {
    body: "看完也想出门透透气了。",
    requestKey: "seed-c8",
  });
}
