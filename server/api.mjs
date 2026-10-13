import { ApiError } from "./store.mjs";
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
export function createApi(store, { development = false } = {}) {
  return async function handle(request, { loopback = false } = {}) {
    const url = new URL(request.url),
      path = url.pathname,
      method = request.method;
    const devAllowed = development && loopback;
    const cookie = Object.fromEntries(
      (request.headers.get("cookie") || "")
        .split(";")
        .map((s) => s.trim().split("=")),
    );
    const me = devAllowed ? store.user(cookie.readerweb_user || "lin") : null;
    try {
      if (!["GET", "HEAD"].includes(method)) {
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin)
          throw new ApiError(403, "请求来源无效。", "FORBIDDEN");
        if (
          method !== "DELETE" &&
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          throw new ApiError(400, "请发送JSON格式内容。");
      }
      const body = async () => {
        try {
          const value = await request.json();
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error();
          return value;
        } catch {
          throw new ApiError(400, "内容格式无效。");
        }
      };
      if (path === "/api/me" && method === "GET")
        return json({
          user: me,
          users: devAllowed ? store.users() : [],
          localMode: devAllowed,
        });
      if (path === "/api/dev/session" && method === "POST") {
        if (!devAllowed)
          throw new ApiError(404, "没有找到这个接口。", "NOT_FOUND");
        const input = await body();
        const user = store.user(input.userId);
        if (!user) throw new ApiError(400, "这个账号不存在。");
        return json({ user }, 200, {
          "Set-Cookie": `readerweb_user=${user.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`,
        });
      }
      if (!me) throw new ApiError(401, "请先登录。", "UNAUTHENTICATED");
      if (path === "/api/tags" && method === "GET")
        return json({ tags: store.tags() });
      if (path === "/api/activity" && method === "GET")
        return json({ days: store.activity() });
      if (path === "/api/posts" && method === "GET")
        return json(
          store.listPosts({
            tag: url.searchParams.get("tag"),
            date: url.searchParams.get("date"),
            page: Number(url.searchParams.get("page") || 0),
          }),
        );
      if (path === "/api/posts" && method === "POST")
        return json({ post: store.createPost(me.id, await body()) }, 201);
      const match = path.match(/^\/api\/posts\/([^/]+)(\/comments)?$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        if (match[2]) {
          if (method === "GET")
            return json({ comments: store.listComments(id) });
          if (method === "POST")
            return json(
              { comment: store.createComment(me.id, id, await body()) },
              201,
            );
        } else {
          if (method === "GET") return json({ post: store.post(id) });
          if (method === "PATCH")
            return json({ post: store.editPost(me.id, id, await body()) });
          if (method === "DELETE") return json(store.deletePost(me.id, id));
        }
      }
      const comment = path.match(/^\/api\/comments\/([^/]+)$/);
      if (comment && method === "PATCH")
        return json({
          comment: store.editComment(
            me.id,
            decodeURIComponent(comment[1]),
            await body(),
          ),
        });
      if (comment && method === "DELETE")
        return json(store.deleteComment(me.id, decodeURIComponent(comment[1])));
      throw new ApiError(404, "没有找到这个接口。", "NOT_FOUND");
    } catch (error) {
      if (!(error instanceof ApiError)) console.error(error);
      return json(
        {
          error: {
            code: error.code || "SERVER_ERROR",
            message:
              error instanceof ApiError
                ? error.message
                : "暂时没能保存，请重试。",
          },
        },
        error.status || 500,
      );
    }
  };
}
