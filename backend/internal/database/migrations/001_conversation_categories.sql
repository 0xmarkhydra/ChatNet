CREATE TABLE IF NOT EXISTS conversation_categories (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name VARCHAR(40) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
 color VARCHAR(16) NOT NULL CHECK (color IN ('indigo','blue','green','orange','pink','slate')),
 UNIQUE(user_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_categories_name ON conversation_categories(user_id,lower(name));
CREATE TABLE IF NOT EXISTS conversation_category_assignments (
 user_id BIGINT NOT NULL,
 conversation_id BIGINT NOT NULL,
 category_id BIGINT NOT NULL,
 PRIMARY KEY (user_id,conversation_id),
 FOREIGN KEY (conversation_id,user_id) REFERENCES conversation_members(conversation_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY (user_id,category_id) REFERENCES conversation_categories(user_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_conversation_category_filter ON conversation_category_assignments(user_id,category_id,conversation_id);
