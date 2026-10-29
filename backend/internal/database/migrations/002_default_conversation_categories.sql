-- Remember initialization separately so deleting a default tag is permanent.
CREATE TABLE IF NOT EXISTS conversation_category_defaults (
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION seed_conversation_category_defaults(owner_id BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE initialized_id BIGINT;
BEGIN
 -- Share the same per-user lock as category creation to preserve the 50-tag quota.
 PERFORM id FROM users WHERE id=owner_id FOR UPDATE;
 INSERT INTO conversation_category_defaults(user_id) VALUES(owner_id)
 ON CONFLICT DO NOTHING RETURNING user_id INTO initialized_id;
 IF initialized_id IS NULL THEN RETURN; END IF;
 INSERT INTO conversation_categories(user_id,name,color)
 SELECT owner_id,d.name,d.color
 FROM (VALUES (1,'Gia đình','pink'),(2,'Bạn bè','blue'),(3,'Công việc','orange'),(4,'Trả lời sau','green')) AS d(position,name,color)
 WHERE NOT EXISTS (
  SELECT 1 FROM conversation_categories c WHERE c.user_id=owner_id AND lower(c.name)=lower(d.name)
 )
 ORDER BY d.position
 LIMIT GREATEST(0,50-(SELECT count(*) FROM conversation_categories WHERE user_id=owner_id))
 ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION initialize_conversation_category_defaults()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM seed_conversation_category_defaults(NEW.id);
 RETURN NEW;
END $$;

DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='users_conversation_category_defaults' AND tgrelid='users'::regclass) THEN
  CREATE TRIGGER users_conversation_category_defaults AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION initialize_conversation_category_defaults();
 END IF;
END $$;

SELECT seed_conversation_category_defaults(u.id) FROM users u
WHERE NOT EXISTS (SELECT 1 FROM conversation_category_defaults d WHERE d.user_id=u.id);
