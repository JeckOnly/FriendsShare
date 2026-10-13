export async function api(path, options = {}) {
  const { body, ...rest } = options;
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      ...rest,
      ...(body !== undefined
        ? {
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
          }
        : {}),
    });
  } catch {
    throw new Error("暂时没能连接，内容已保留，请重试。");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("暂时没能连接，请重试。");
  }
  if (!response.ok) {
    const error = new Error(data.error?.message || "暂时没能保存，请重试。");
    error.status = response.status;
    throw error;
  }
  return data;
}
export function chinaDay(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
export function displayTime(value) {
  const d = new Date(value),
    day = chinaDay(d),
    today = chinaDay();
  const time = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  if (day === today) return `今天 ${time}`;
  const date = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
    month: "numeric",
    day: "numeric",
  }).format(d);
  return `${date} ${time}`;
}
export function fullTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
export const normalizeTag = (v) =>
  v.normalize("NFKC").trim().replace(/^#+/, "").trim();
export function validTag(value) {
  const tag = normalizeTag(value);
  return tag.length > 0 && [...tag].length <= 20 && !/[\s#\/\p{Cc}]/u.test(tag);
}
export function readDraft(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
export function writeDraft(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be unavailable; server data remains independent. */
  }
}
