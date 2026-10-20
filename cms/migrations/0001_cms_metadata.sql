-- Additive only. Apply once with Wrangler migrations after deployment approval.
-- Existing table names, record IDs, content and public API fields are preserved.
ALTER TABLE page_content ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1));
ALTER TABLE page_content ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN alt_text TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1));
ALTER TABLE media ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
UPDATE media SET updated_at = created_at WHERE updated_at = '';
CREATE INDEX IF NOT EXISTS skills_public_order ON skills(is_published, sort_order);
CREATE INDEX IF NOT EXISTS projects_public_order ON projects(is_published, sort_order);
CREATE INDEX IF NOT EXISTS posts_public_order ON posts(status, sort_order, published_at);
CREATE INDEX IF NOT EXISTS media_public_order ON media(is_published, sort_order);
