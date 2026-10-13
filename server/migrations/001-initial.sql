CREATE TABLE users (
  id TEXT PRIMARY KEY,
  identity_subject TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar TEXT
);
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  request_key TEXT,
  request_payload TEXT,
  UNIQUE(author_id, request_key)
);
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE
);
CREATE TABLE post_tags (
  post_id TEXT NOT NULL REFERENCES posts(id),
  tag_id TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY(post_id, tag_id)
);
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  parent_id TEXT REFERENCES comments(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  request_key TEXT,
  request_payload TEXT,
  UNIQUE(author_id, request_key),
  CHECK(parent_id IS NULL OR parent_id != id)
);
CREATE INDEX posts_time ON posts(created_at DESC, id DESC);
CREATE INDEX comments_post ON comments(post_id, created_at, id);
CREATE INDEX tags_post ON post_tags(tag_id, post_id);
PRAGMA user_version = 1;
