import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import {
  SquaresFourIcon,
  HashIcon,
  ChatCircleIcon,
  ArrowUpIcon,
  ArrowLeftIcon,
  DotsThreeIcon,
  XIcon,
  ListIcon,
  CaretDownIcon,
  PencilSimpleIcon,
  TrashIcon,
  CheckIcon,
  MinusCircleIcon,
  PlusCircleIcon,
  ArrowBendDownRightIcon,
  CalendarBlankIcon,
  SpinnerGapIcon,
  LeafIcon,
} from "@phosphor-icons/react";
import {
  api,
  chinaDay,
  displayTime,
  fullTime,
  normalizeTag,
  validTag,
  readDraft,
  writeDraft,
} from "./api";

function useRoute() {
  const current = () => ({
    pathname: window.location.pathname,
    search: window.location.search,
  });
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const listener = () => setRoute(current());
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  const navigate = (url) => {
    window.history.pushState({}, "", url);
    setRoute(current());
  };
  return [route, navigate];
}
function Avatar({ user, size = 26 }) {
  return (
    <img
      className="avatar"
      width={size}
      height={size}
      src={user?.avatar || "/avatars/lin.png"}
      alt=""
    />
  );
}
function Time({ value, edited = false }) {
  return (
    <span className="time">
      <time dateTime={value} title={fullTime(value)}>
        {displayTime(value)}
      </time>
      {edited && <span> · 已编辑</span>}
    </span>
  );
}
function useFocusTrap(ref, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const elements = () => [
      ...ref.current.querySelectorAll(
        'button:not(:disabled),a[href],input,textarea,[tabindex="0"]',
      ),
    ];
    elements()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const all = elements(),
          first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
}
function ConfirmDialog({ item, close }) {
  const ref = useRef(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useFocusTrap(ref, () => {
    if (!busy) close();
  });
  async function confirm() {
    setBusy(true);
    try {
      await item.action();
      close();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <section
        ref={ref}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <h2 id="confirm-title">{item.title}</h2>
        <p>{item.message}</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="secondary-button" onClick={close} disabled={busy}>
            再想想
          </button>
          <button className="danger-button" onClick={confirm} disabled={busy}>
            {busy ? "删除中…" : "删除"}
          </button>
        </div>
      </section>
    </div>
  );
}
function MoreMenu({ edit, remove, label }) {
  const [open, setOpen] = useState(false),
    ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const click = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const key = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", click);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="more-menu" ref={ref}>
      <button
        className="icon-button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <DotsThreeIcon size={20} />
      </button>
      {open && (
        <div className="menu-popover">
          <button
            onClick={() => {
              setOpen(false);
              edit();
            }}
          >
            <PencilSimpleIcon size={16} />
            编辑
          </button>
          <button
            className="delete-menu"
            onClick={() => {
              setOpen(false);
              remove();
            }}
          >
            <TrashIcon size={16} />
            删除
          </button>
        </div>
      )}
    </div>
  );
}
function TagInput({ values, setValues, allTags }) {
  const [input, setInput] = useState(""),
    [error, setError] = useState(""),
    id = useId(),
    inputRef = useRef(null);
  function add(value = input) {
    const name = normalizeTag(value);
    if (!name) return;
    if (!validTag(name)) {
      setError("标签最多20个字符，不含空格。");
      inputRef.current?.setCustomValidity("标签最多20个字符，不含空格。");
      return;
    }
    if (values.some((v) => v.toLowerCase() === name.toLowerCase())) {
      setInput("");
      return;
    }
    if (values.length >= 3) {
      setError("最多添加3个标签。");
      return;
    }
    setValues([...values, name]);
    setInput("");
    setError("");
    inputRef.current?.setCustomValidity("");
  }
  return (
    <div className="tag-input-wrap">
      <div className="tag-input-row">
        {values.map((name) => (
          <span className="selected-tag" key={name}>
            <HashIcon size={12} />
            {name}
            <button
              type="button"
              aria-label={`移除标签${name}`}
              onClick={() => setValues(values.filter((v) => v !== name))}
            >
              <XIcon size={12} />
            </button>
          </span>
        ))}
        {values.length < 3 && (
          <label className="tag-field">
            <HashIcon size={15} />
            <input
              ref={inputRef}
              aria-label="添加标签"
              list={id}
              value={input}
              placeholder="添加标签"
              maxLength={40}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
                e.target.setCustomValidity("");
              }}
              onBlur={() => add()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <datalist id={id}>
              {allTags
                .filter(
                  (t) =>
                    !values.some(
                      (v) => v.toLowerCase() === t.name.toLowerCase(),
                    ),
                )
                .map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
            </datalist>
          </label>
        )}
      </div>
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
function PostComposer({ user, tags, selectedTag, onPublish }) {
  const key = `readerweb:post-draft:${user.id}`;
  const initial = useMemo(() => readDraft(key, { body: "", tags: [] }), [key]);
  const [body, setBody] = useState(initial.body),
    [values, setValues] = useState(initial.tags),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    ref = useRef(null),
    submission = useRef(null),
    prefill = useRef(null);
  useEffect(() => {
    writeDraft(key, { body, tags: values });
  }, [key, body, values]);
  useEffect(() => {
    if (
      !body &&
      (values.length === 0 ||
        (values.length === 1 && values[0] === prefill.current))
    ) {
      setValues(selectedTag ? [selectedTag.name] : []);
      prefill.current = selectedTag?.name || null;
    }
  }, [selectedTag?.id]);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height =
        Math.min(380, Math.max(70, ref.current.scrollHeight)) + "px";
    }
  }, [body]);
  async function submit(e) {
    e?.preventDefault();
    if (busy || !body.trim()) return;
    if ([...body.trim()].length > 5000) {
      setError("感想最多5000个字符。");
      return;
    }
    const snapshot = JSON.stringify([body, values]);
    if (submission.current?.snapshot !== snapshot)
      submission.current = { snapshot, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await onPublish({
        body,
        tags: values,
        requestKey: submission.current.key,
      });
      setBody("");
      setValues(selectedTag ? [selectedTag.name] : []);
      submission.current = null;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="post-composer" onSubmit={submit}>
      <textarea
        ref={ref}
        aria-label="写一条生活感想"
        placeholder="今天有什么想说的？"
        value={body}
        maxLength={10000}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key === "Enter" &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <TagInput values={values} setValues={setValues} allTags={tags} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="composer-footer">
        <span>这里的朋友都能看到</span>
        <div className="composer-submit">
          {body.length > 4500 && (
            <span className="character-count">{[...body].length}/5000</span>
          )}
          <button
            className="primary-button"
            type="submit"
            disabled={!body.trim() || busy}
          >
            {busy ? (
              <SpinnerGapIcon className="spin" size={15} />
            ) : (
              <ArrowUpIcon size={15} weight="bold" />
            )}
            {busy ? "发布中" : "发布"}
          </button>
        </div>
      </div>
    </form>
  );
}
function BodyText({ body }) {
  const parts = (body || "").split(/(https?:\/\/[^\s<>]+)/g);
  return parts.map((part, i) => {
    if (!/^https?:\/\//.test(part)) return part;
    const match = part.match(/^(.*?)([，。；！、）.,;!?]*$)/);
    const href = match?.[1] || part;
    try {
      new URL(href);
      return (
        <React.Fragment key={i}>
          <a href={href} target="_blank" rel="noopener noreferrer">
            {href}
          </a>
          {match?.[2]}
        </React.Fragment>
      );
    } catch {
      return part;
    }
  });
}
function PostBody({ body, preview }) {
  const ref = useRef(null),
    [expanded, setExpanded] = useState(!preview),
    [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !preview) return;
    const measure = () => {
      if (!expanded) setOverflow(el.scrollHeight > el.clientHeight + 2);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [body, preview, expanded]);
  return (
    <>
      <div
        ref={ref}
        className={`post-body ${preview && !expanded ? "body-clamped" : ""}`}
      >
        <BodyText body={body} />
      </div>
      {preview && (overflow || expanded) && (
        <button
          className="text-button expand-button"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      )}
    </>
  );
}
function ContentEditor({
  body,
  tags = [],
  allTags = [],
  onSave,
  onCancel,
  comment = false,
}) {
  const [value, setValue] = useState(body),
    [labels, setLabels] = useState(tags.map((t) => t.name)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e) {
    e.preventDefault();
    if (busy || !value.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onSave({ body: value, ...(!comment ? { tags: labels } : {}) });
      onCancel();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <form className="content-editor" onSubmit={save}>
      <textarea
        aria-label={comment ? "编辑评论" : "编辑感想"}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        rows={comment ? 3 : 5}
        onKeyDown={(e) => {
          if (
            (e.ctrlKey || e.metaKey) &&
            e.key === "Enter" &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            save(e);
          }
        }}
      />
      {!comment && (
        <TagInput values={labels} setValues={setLabels} allTags={allTags} />
      )}
      <div className="editor-actions">
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onCancel}
        >
          取消
        </button>
        <button className="primary-button" disabled={busy || !value.trim()}>
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
function PostCard({
  post,
  user,
  tags,
  onOpen,
  onTag,
  onChange,
  confirm,
  preview = true,
}) {
  const [editing, setEditing] = useState(false);
  return (
    <article className={`post-card ${!preview ? "detail-post" : ""}`}>
      <header className="post-meta">
        <Avatar user={post.author} />
        <strong>{post.author.name}</strong>
        <Time
          value={post.createdAt}
          edited={post.updatedAt !== post.createdAt}
        />
        {post.author.id === user.id && (
          <MoreMenu
            label="感想操作"
            edit={() => setEditing(true)}
            remove={() =>
              confirm({
                title: "删除这条感想？",
                message: "这条感想和下面的评论将不再显示。",
                action: async () => {
                  await api(`/posts/${post.id}`, { method: "DELETE" });
                  await onChange();
                },
              })
            }
          />
        )}
      </header>
      {editing ? (
        <ContentEditor
          body={post.body}
          tags={post.tags}
          allTags={tags}
          onCancel={() => setEditing(false)}
          onSave={async (input) => {
            await api(`/posts/${post.id}`, { method: "PATCH", body: input });
            await onChange();
          }}
        />
      ) : (
        <>
          <PostBody body={post.body} preview={preview} />
          {post.tags.length > 0 && (
            <div className="post-tags">
              {post.tags.map((t) => (
                <button
                  key={t.id}
                  className="post-tag"
                  onClick={() => onTag(t.id)}
                >
                  <HashIcon size={12} />
                  {t.name}
                </button>
              ))}
            </div>
          )}
          {preview && (
            <footer className="post-actions">
              <button onClick={() => onOpen(post.id)}>
                <ChatCircleIcon size={17} />
                {post.commentCount ? `评论 ${post.commentCount}` : "说两句"}
              </button>
            </footer>
          )}
        </>
      )}
    </article>
  );
}
function Heatmap({ days, selected, onSelect }) {
  const titleId = useId(),
    today = chinaDay(),
    cells = useMemo(() => {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 77);
      return Array.from({ length: 84 }, (_, i) => {
        const date = new Date(d);
        date.setUTCDate(d.getUTCDate() + i);
        return date.toISOString().slice(0, 10);
      });
    }, [today]);
  const values = new Map(days.map((d) => [d.date, d.count])),
    refs = useRef([]),
    [hint, setHint] = useState(""),
    [focused, setFocused] = useState(
      Math.max(0, cells.indexOf(selected || today)),
    );
  const monthColumns = new Map();
  let previous = "";
  cells.forEach((date, i) => {
    if (date.slice(0, 7) !== previous) {
      const column = Math.floor(i / 7) + 1;
      monthColumns.set(column, {
        column,
        label: `${Number(date.slice(5, 7))}月`,
      });
      previous = date.slice(0, 7);
    }
  });
  const months = [...monthColumns.values()];
  function key(e, i) {
    const offsets = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    if (offsets[e.key] !== undefined) {
      e.preventDefault();
      const next = Math.max(
        0,
        Math.min(cells.indexOf(today), i + offsets[e.key]),
      );
      setFocused(next);
      refs.current[next]?.focus();
    }
  }
  return (
    <section className="heatmap-section" aria-labelledby={titleId}>
      <div className="section-heading">
        <h2 id={titleId}>最近的分享</h2>
        <span>大家 · 近12周</span>
      </div>
      <div className="heat-grid" role="group" aria-label="每天的感想数量">
        {cells.map((date, i) => {
          const count = values.get(date) || 0,
            future = date > today;
          return (
            <button
              key={date}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              disabled={future}
              tabIndex={i === focused ? 0 : -1}
              aria-label={`${date}，${count}条感想${date === selected ? "，已选中" : ""}`}
              aria-pressed={date === selected}
              title={`${date} · ${count}条感想`}
              className={`heat-cell level-${Math.min(count, 3)} ${date === today ? "is-today" : ""} ${date === selected ? "is-selected" : ""} ${future ? "future" : ""}`}
              onKeyDown={(e) => key(e, i)}
              onFocus={() => {
                setFocused(i);
                setHint(
                  `${date.slice(5).replace("-", "月")}日 · ${count}条感想`,
                );
              }}
              onBlur={() => setHint("")}
              onMouseEnter={() =>
                setHint(
                  `${date.slice(5).replace("-", "月")}日 · ${count}条感想`,
                )
              }
              onMouseLeave={() => setHint("")}
              onClick={() => onSelect(date === selected ? null : date)}
            />
          );
        })}
      </div>
      <div className="heat-months">
        {months.map((m, i) => (
          <span key={i} style={{ gridColumn: m.column }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="heat-bottom">
        {hint ? (
          <span className="heat-hint" aria-live="polite">
            {hint}
          </span>
        ) : (
          <span>一点一滴，都是生活</span>
        )}
        <div
          className="heat-legend"
          aria-label="少到多：0条、1条、2条、3条及以上"
        >
          <span>少</span>
          {[0, 1, 2, 3].map((v) => (
            <i className={`level-${v}`} key={v} />
          ))}
          <span>多</span>
        </div>
      </div>
    </section>
  );
}
function Sidebar({
  user,
  users,
  tags,
  days,
  filters,
  selectTag,
  selectDate,
  clear,
  switchUser,
  close,
}) {
  const [accounts, setAccounts] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function change(id) {
    setBusy(true);
    try {
      await switchUser(id);
      setAccounts(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="sidebar-brand">
        <span className="brand-name">
          随记
          <span className="brand-dot">
            <LeafIcon size={15} weight="fill" />
          </span>
        </span>
        {close && (
          <button
            className="icon-button mobile-close"
            aria-label="关闭菜单"
            onClick={close}
          >
            <XIcon size={20} />
          </button>
        )}
      </div>
      <Heatmap days={days} selected={filters.date} onSelect={selectDate} />
      <nav className="sidebar-nav" aria-label="感想导航">
        <button
          className={`nav-item ${!filters.tag ? "active" : ""}`}
          aria-current={!filters.tag ? "page" : undefined}
          onClick={clear}
        >
          <SquaresFourIcon
            size={18}
            weight={!filters.tag ? "fill" : "regular"}
          />
          全部感想
        </button>
      </nav>
      <section className="sidebar-tags">
        <h2>全部标签</h2>
        {tags.length === 0 ? (
          <p className="empty-tags">发布时，可以添加一个标签</p>
        ) : (
          tags.map((t) => (
            <button
              key={t.id}
              className={`tag-nav ${filters.tag === t.id ? "selected" : ""}`}
              aria-pressed={filters.tag === t.id}
              onClick={() => selectTag(filters.tag === t.id ? null : t.id)}
            >
              <HashIcon size={17} />
              <span>{t.name}</span>
              {filters.tag === t.id && (
                <span className="tag-selected-mark">
                  <CheckIcon size={14} />
                </span>
              )}
            </button>
          ))
        )}
      </section>
      <div className="account-wrap">
        <button
          className="account-button"
          aria-expanded={accounts}
          onClick={() => setAccounts(!accounts)}
        >
          <Avatar user={user} size={28} />
          <span>{user.name}</span>
          <CaretDownIcon size={13} />
        </button>
        {accounts && (
          <div className="account-menu">
            <span className="account-caption">本地体验账号</span>
            {users.map((u) => (
              <button key={u.id} disabled={busy} onClick={() => change(u.id)}>
                <Avatar user={u} size={25} />
                {u.name}
                {u.id === user.id && <CheckIcon size={15} />}
              </button>
            ))}
            {error && <p className="error">{error}</p>}
          </div>
        )}
      </div>
    </>
  );
}
function Drawer({ children, close }) {
  const ref = useRef(null);
  useFocusTrap(ref, close);
  return (
    <div
      className="drawer-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside
        className="drawer"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="导航菜单"
      >
        {children}
      </aside>
    </div>
  );
}
function ReplyBox({
  target,
  user,
  postId,
  drafts,
  setDrafts,
  onSent,
  onCancel,
}) {
  const id = target?.id || "root",
    storageKey = `readerweb:reply:${user.id}:${postId}:${id}`;
  const stored = readDraft(storageKey, ""),
    body = drafts[id] ?? stored;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    submission = useRef(null);
  function setBody(value) {
    setDrafts((prev) => ({ ...prev, [id]: value }));
    writeDraft(storageKey, value);
  }
  async function send(e) {
    e?.preventDefault();
    if (busy || !body.trim()) return;
    if ([...body.trim()].length > 2000) {
      setError("评论最多2000个字符。");
      return;
    }
    if (submission.current?.body !== body)
      submission.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const result = await api(`/posts/${postId}/comments`, {
        method: "POST",
        body: {
          body,
          parentId: target?.id || null,
          requestKey: submission.current.key,
        },
      });
      setBody("");
      submission.current = null;
      await onSent(result.comment);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className={`reply-box ${target ? "nested-reply-box" : ""}`}
      onSubmit={send}
    >
      {target && <div className="reply-target">回复 @{target.author.name}</div>}
      <textarea
        aria-label={target ? `回复${target.author.name}` : "评论这条感想"}
        autoFocus={!!target}
        placeholder={target ? "写下你的回复……" : "说说你的想法吧……"}
        value={body}
        rows={target ? 2 : 2}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (
            (e.metaKey || e.ctrlKey) &&
            e.key === "Enter" &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="reply-footer">
        {onCancel && (
          <button type="button" className="text-button" onClick={onCancel}>
            取消
          </button>
        )}
        <button className="primary-button" disabled={busy || !body.trim()}>
          <ArrowUpIcon size={14} />
          {busy ? "发送中" : "发送"}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 600);
  useEffect(() => {
    const q = matchMedia("(max-width: 599px)"),
      update = () => setNarrow(q.matches);
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return narrow;
}
function CommentTree({ comments, user, postId, refresh, confirm }) {
  const narrow = useNarrow(),
    maxDepth = narrow ? 2 : 4;
  const [collapsed, setCollapsed] = useState(new Set()),
    [replyId, setReplyId] = useState(null),
    [editing, setEditing] = useState(null),
    [drafts, setDrafts] = useState({}),
    [focusId, setFocusId] = useState(null),
    originScroll = useRef(0),
    rootRef = useRef(null);
  useEffect(() => {
    setDrafts({});
    setReplyId(null);
    setEditing(null);
  }, [user.id]);
  const nodes = useMemo(() => {
    const map = new Map(comments.map((c) => [c.id, { ...c, children: [] }]));
    for (const c of map.values()) {
      if (c.parentId && map.has(c.parentId))
        map.get(c.parentId).children.push(c);
    }
    return map;
  }, [comments]);
  function count(node) {
    let n = 0,
      stack = [...node.children];
    while (stack.length) {
      const c = stack.pop();
      if (!c.deleted) n++;
      stack.push(...c.children);
    }
    return n;
  }
  const visible = (node) => !node.deleted || count(node) > 0;
  const roots =
    focusId && nodes.has(focusId)
      ? [nodes.get(focusId)]
      : [...nodes.values()].filter((c) => !c.parentId);
  function collapse(id) {
    setCollapsed((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  }
  function focus(node) {
    if (!focusId) originScroll.current = window.scrollY;
    setFocusId(node.id);
    requestAnimationFrame(() =>
      rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  }
  async function sent(c) {
    await refresh();
    setReplyId(null);
    const depth = (() => {
      let d = 0,
        node = nodes.get(c.parentId);
      while (node?.parentId) {
        d++;
        node = nodes.get(node.parentId);
      }
      return d + 1;
    })();
    if (c.parentId && depth > maxDepth) setFocusId(c.parentId);
    requestAnimationFrame(() =>
      document
        .getElementById(`comment-${c.id}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  }
  function render(node, depth = 0) {
    if (!visible(node)) return null;
    const folded = collapsed.has(node.id),
      children = node.children.filter(visible),
      descendants = count(node);
    return (
      <div
        key={node.id}
        className={`thread-node ${children.length ? "has-children" : ""} ${folded ? "is-folded" : ""}`}
        id={`comment-${node.id}`}
      >
        <span className="thread-tail" aria-hidden="true" />
        <div className="comment-avatar">
          <Avatar user={node.author} size={26} />
          {children.length > 0 && (
            <button
              className="collapse-control"
              aria-label={`${folded ? "展开" : "折叠"}${node.author.name}的回复`}
              aria-expanded={!folded}
              onClick={() => collapse(node.id)}
            >
              {folded ? (
                <PlusCircleIcon size={15} />
              ) : (
                <MinusCircleIcon size={15} />
              )}
            </button>
          )}
        </div>
        <div className="comment-main">
          <div className="comment-meta">
            <strong>{node.author.name}</strong>
            <Time
              value={node.createdAt}
              edited={!node.deleted && node.updatedAt !== node.createdAt}
            />
            {!node.deleted && node.author.id === user.id && (
              <MoreMenu
                label="评论操作"
                edit={() => {
                  setEditing(node.id);
                  setReplyId(null);
                }}
                remove={() =>
                  confirm({
                    title: "删除这条评论？",
                    message: "正文会移除，已经收到的回复会保留。",
                    action: async () => {
                      await api(`/comments/${node.id}`, { method: "DELETE" });
                      await refresh();
                    },
                  })
                }
              />
            )}
          </div>
          {folded ? (
            <button
              className="folded-summary"
              onClick={() => collapse(node.id)}
            >
              {node.deleted
                ? "该评论已删除"
                : node.body.length > 35
                  ? node.body.slice(0, 35) + "…"
                  : node.body}
              <span>还有{descendants}条回复 · 展开</span>
            </button>
          ) : (
            <>
              {editing === node.id ? (
                <ContentEditor
                  body={node.body}
                  comment
                  onCancel={() => setEditing(null)}
                  onSave={async (input) => {
                    await api(`/comments/${node.id}`, {
                      method: "PATCH",
                      body: input,
                    });
                    await refresh();
                  }}
                />
              ) : (
                <>
                  <div
                    className={`comment-body ${node.deleted ? "deleted-comment" : ""}`}
                  >
                    {node.deleted ? (
                      "该评论已删除"
                    ) : (
                      <BodyText body={node.body} />
                    )}
                  </div>
                  {!node.deleted && (
                    <div className="comment-actions">
                      <button
                        onClick={() => {
                          setReplyId(node.id);
                          setEditing(null);
                        }}
                      >
                        <ChatCircleIcon size={14} />
                        回复
                      </button>
                    </div>
                  )}
                </>
              )}
              {replyId === node.id && !node.deleted && (
                <ReplyBox
                  key={`${user.id}:${node.id}`}
                  target={node}
                  user={user}
                  postId={postId}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  onSent={sent}
                  onCancel={() => setReplyId(null)}
                />
              )}
            </>
          )}
        </div>
        {!folded && children.length > 0 && (
          <div className="thread-children">
            {depth < maxDepth ? (
              children.map((c) => render(c, depth + 1))
            ) : (
              <button className="continue-thread" onClick={() => focus(node)}>
                <ArrowBendDownRightIcon size={16} />
                继续看这段回复<span>{descendants}</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="discussion" ref={rootRef}>
      <div className="discussion-heading">
        <h2>
          说两句<span>{comments.filter((c) => !c.deleted).length}</span>
        </h2>
      </div>
      {focusId && nodes.has(focusId) ? (
        <div className="branch-context">
          <button
            className="text-button"
            onClick={() => {
              setFocusId(null);
              requestAnimationFrame(() =>
                window.scrollTo({ top: originScroll.current }),
              );
            }}
          >
            <ArrowLeftIcon size={14} />
            返回完整讨论
          </button>
          <p>
            {nodes.get(focusId).parentId &&
            nodes.has(nodes.get(focusId).parentId)
              ? `回应 ${nodes.get(nodes.get(focusId).parentId).author.name}：${nodes.get(nodes.get(focusId).parentId).body?.slice(0, 80) || "该评论已删除"}`
              : "这段回复的上下文"}
          </p>
        </div>
      ) : replyId === null ? (
        <ReplyBox
          key={`${user.id}:root`}
          user={user}
          postId={postId}
          drafts={drafts}
          setDrafts={setDrafts}
          onSent={sent}
        />
      ) : (
        <button
          className="text-button root-reply-link"
          onClick={() => setReplyId(null)}
        >
          写一条评论
        </button>
      )}
      <div className="comment-tree">
        {roots.filter(visible).length ? (
          roots.map((c) => render(c))
        ) : (
          <p className="empty-discussion">还没有评论，聊聊你的想法吧。</p>
        )}
      </div>
    </div>
  );
}
function Detail({ id, user, tags, onBack, onTag, onMutation, confirm }) {
  const [post, setPost] = useState(null),
    [comments, setComments] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function refresh() {
    const data = await api(`/posts/${id}`);
    setPost(data.post);
    if (!data.post.deleted) {
      const result = await api(`/posts/${id}/comments`);
      setComments(result.comments);
    } else setComments([]);
    onMutation();
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setPost(null);
    (async () => {
      try {
        const p = await api(`/posts/${id}`);
        if (!active) return;
        setPost(p.post);
        if (!p.post.deleted) {
          const c = await api(`/posts/${id}/comments`);
          if (active) setComments(c.comments);
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <>
      <div className="page-heading detail-heading">
        <button className="back-button" onClick={onBack}>
          <ArrowLeftIcon size={17} />
          全部感想
        </button>
      </div>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <Empty
          text={error}
          action={() => {
            setError("");
            setLoading(true);
            refresh()
              .catch((e) => setError(e.message))
              .finally(() => setLoading(false));
          }}
          actionLabel="重试"
        />
      ) : post?.deleted ? (
        <Empty
          text="这条感想已删除。"
          action={onBack}
          actionLabel="回到全部感想"
        />
      ) : (
        <>
          <PostCard
            post={post}
            user={user}
            tags={tags}
            onTag={onTag}
            onChange={refresh}
            confirm={confirm}
            preview={false}
          />
          <CommentTree
            key={`${id}:${user.id}`}
            comments={comments}
            user={user}
            postId={id}
            refresh={refresh}
            confirm={confirm}
          />
        </>
      )}
    </>
  );
}
function Skeleton() {
  return (
    <div className="skeleton-list" aria-label="正在加载感想" role="status">
      {[0, 1, 2].map((n) => (
        <div className="skeleton-card" key={n}>
          <span />
          <i />
          <i />
          <i />
        </div>
      ))}
    </div>
  );
}
function Empty({ text, action, actionLabel }) {
  return (
    <div className="empty-state">
      <p>{text}</p>
      {action && (
        <button className="text-button" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function App() {
  const menuTrigger = useRef(null);
  const [route, navigate] = useRoute(),
    [me, setMe] = useState(null),
    [users, setUsers] = useState([]),
    [tags, setTags] = useState([]),
    [days, setDays] = useState([]),
    [posts, setPosts] = useState([]),
    [hasMore, setHasMore] = useState(false),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [loadingMore, setLoadingMore] = useState(false),
    [error, setError] = useState(""),
    [bootError, setBootError] = useState(""),
    [reload, setReload] = useState(0),
    [drawer, setDrawer] = useState(false),
    [confirmation, setConfirmation] = useState(null),
    [toast, setToast] = useState(null);
  const postId = route.pathname.match(/^\/p\/([^/]+)$/)?.[1] || null,
    home = useRef({ url: "/", scroll: 0 }),
    [feedSearch, setFeedSearch] = useState(
      route.pathname === "/" ? route.search : "",
    );
  const filters = useMemo(() => {
      const q = new URLSearchParams(feedSearch);
      return { tag: q.get("tag"), date: q.get("date") };
    }, [feedSearch]),
    selectedTag = tags.find((t) => t.id === filters.tag);
  const meta = async () => {
    const results = await Promise.all([api("/tags"), api("/activity")]);
    setTags(results[0].tags);
    setDays(results[1].days);
  };
  async function boot() {
    setBootError("");
    try {
      const data = await api("/me");
      if (!data.user) throw new Error("这个小空间需要登录后访问。");
      setMe(data.user);
      setUsers(data.users);
      await meta();
    } catch (e) {
      setBootError(e.message);
    }
  }
  useEffect(() => {
    boot();
  }, []);
  useEffect(() => {
    if (route.pathname === "/") {
      setFeedSearch(route.search);
      home.current.url = "/" + route.search;
    }
  }, [route.pathname, route.search]);
  useEffect(() => {
    if (!me) return;
    let active = true;
    setLoading(true);
    setError("");
    setPage(0);
    const q = new URLSearchParams(feedSearch);
    api("/posts?" + q)
      .then((data) => {
        if (active) {
          setPosts(data.posts);
          setHasMore(data.hasMore);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [feedSearch, reload, !!me]);
  useEffect(() => {
    if (!postId)
      requestAnimationFrame(() =>
        window.scrollTo({ top: home.current.scroll }),
      );
    else window.scrollTo({ top: 0 });
  }, [postId]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.title = postId ? "一条感想 · 随记" : "随记 · 朋友的生活感想";
  }, [postId]);
  function mutation() {
    meta().catch((e) => setError(e.message));
    setReload((v) => v + 1);
  }
  function closeDrawer() {
    setDrawer(false);
    requestAnimationFrame(() => menuTrigger.current?.focus());
  }
  function select(changes) {
    const q = new URLSearchParams(feedSearch);
    for (const [key, value] of Object.entries(changes)) {
      value ? q.set(key, value) : q.delete(key);
    }
    home.current.scroll = 0;
    navigate("/" + (q.size ? "?" + q.toString() : ""));
    setFeedSearch(q.toString() ? "?" + q.toString() : "");
    if (drawer) closeDrawer();
    window.scrollTo({ top: 0 });
  }
  function open(id) {
    home.current = { url: "/" + feedSearch, scroll: window.scrollY };
    navigate(`/p/${id}`);
  }
  function back() {
    navigate(home.current.url);
  }
  async function publish(input) {
    const data = await api("/posts", { method: "POST", body: input });
    mutation();
    const matches =
      (!filters.tag || data.post.tags.some((t) => t.id === filters.tag)) &&
      (!filters.date ||
        chinaDay(new Date(data.post.createdAt)) === filters.date);
    setToast({
      message: matches ? "感想已发布" : "已发布，当前筛选下暂不显示",
      ...(matches
        ? {}
        : { action: () => open(data.post.id), label: "查看感想" }),
    });
  }
  async function more() {
    if (loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const q = new URLSearchParams(feedSearch);
      q.set("page", page + 1);
      const data = await api("/posts?" + q);
      setPosts((prev) => [
        ...prev,
        ...data.posts.filter((p) => !prev.some((v) => v.id === p.id)),
      ]);
      setHasMore(data.hasMore);
      setPage(page + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }
  const sidebarProps = {
    user: me,
    users,
    tags,
    days,
    filters,
    selectTag: (id) => select({ tag: id }),
    selectDate: (date) => select({ date }),
    clear: () => select({ tag: null, date: null }),
    switchUser: async (id) => {
      const data = await api("/dev/session", {
        method: "POST",
        body: { userId: id },
      });
      setMe(data.user);
      if (drawer) closeDrawer();
      setToast({ message: `现在以${data.user.name}的身份分享` });
    },
  };
  if (!me)
    return (
      <div className="boot-screen">
        {bootError ? (
          <>
            <p>{bootError}</p>
            <button className="secondary-button" onClick={boot}>
              重试
            </button>
          </>
        ) : (
          <>
            <SpinnerGapIcon className="spin" size={22} />
            <span>正在打开随记…</span>
          </>
        )}
      </div>
    );
  return (
    <>
      <div className="mobile-topbar" inert={drawer || !!confirmation}>
        <button
          className="icon-button"
          aria-label="打开菜单"
          ref={menuTrigger}
          onClick={() => setDrawer(true)}
        >
          <ListIcon size={23} />
        </button>
        <span>随记</span>
        <Avatar user={me} size={26} />
      </div>
      <div className="app-layout" inert={drawer || !!confirmation}>
        <aside className="desktop-sidebar">
          <Sidebar {...sidebarProps} />
        </aside>
        <main className="main-column">
          <div hidden={!!postId}>
            <div className="page-heading">
              <h1>{selectedTag ? `# ${selectedTag.name}` : "全部感想"}</h1>
            </div>
            <PostComposer
              key={me.id}
              user={me}
              tags={tags}
              selectedTag={selectedTag}
              onPublish={publish}
            />
            {(filters.tag || filters.date) && (
              <div className="filter-bar" aria-label="当前筛选">
                {filters.tag && (
                  <button onClick={() => select({ tag: null })}>
                    <HashIcon size={13} />
                    {selectedTag?.name || "标签"}
                    <XIcon size={12} />
                  </button>
                )}
                {filters.date && (
                  <button onClick={() => select({ date: null })}>
                    <CalendarBlankIcon size={13} />
                    {filters.date}
                    <XIcon size={12} />
                  </button>
                )}
                <button
                  className="clear-filters"
                  onClick={() => select({ tag: null, date: null })}
                >
                  清除
                </button>
              </div>
            )}
            {loading && !posts.length ? (
              <Skeleton />
            ) : (
              <div className="post-feed">
                {posts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    user={me}
                    tags={tags}
                    onOpen={open}
                    onTag={(id) => select({ tag: id })}
                    onChange={mutation}
                    confirm={setConfirmation}
                  />
                ))}
                {!posts.length && !error && (
                  <Empty
                    text={
                      filters.tag || filters.date
                        ? "这个标签或日期下还没有感想。"
                        : "写下第一条生活感想吧。"
                    }
                    action={
                      filters.tag || filters.date
                        ? () => select({ tag: null, date: null })
                        : () =>
                            document
                              .querySelector(
                                'textarea[aria-label="写一条生活感想"]',
                              )
                              ?.focus()
                    }
                    actionLabel={
                      filters.tag || filters.date ? "清除筛选" : "写一条感想"
                    }
                  />
                )}
              </div>
            )}
            {error && (
              <p className="feed-error error" role="alert">
                {error}
                <button
                  className="text-button"
                  onClick={() => setReload((v) => v + 1)}
                >
                  重试
                </button>
              </p>
            )}
            {hasMore && !loading && (
              <button
                className="load-more"
                onClick={more}
                disabled={loadingMore}
              >
                {loadingMore ? "加载中…" : "加载更多"}
              </button>
            )}
            {!loading && posts.length > 0 && !hasMore && (
              <p className="feed-end">每一点日常，都值得被记下。</p>
            )}
          </div>
          {postId && (
            <Detail
              key={postId}
              id={postId}
              user={me}
              tags={tags}
              onBack={back}
              onTag={(id) => select({ tag: id })}
              onMutation={mutation}
              confirm={setConfirmation}
            />
          )}
        </main>
      </div>
      {drawer && (
        <Drawer close={closeDrawer}>
          <Sidebar {...sidebarProps} close={closeDrawer} />
        </Drawer>
      )}
      {confirmation && (
        <ConfirmDialog
          item={confirmation}
          close={() => setConfirmation(null)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckIcon size={17} />
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action();
                setToast(null);
              }}
            >
              {toast.label}
            </button>
          )}
          <button
            className="toast-close"
            aria-label="关闭提示"
            onClick={() => setToast(null)}
          >
            <XIcon size={14} />
          </button>
        </div>
      )}
    </>
  );
}
