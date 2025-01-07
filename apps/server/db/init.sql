-- FTS tables will live in a separate replica database
-- CREATE VIRTUAL TABLE messages_fts USING fts5(
--     content,
--     tokenize='porter unicode61'
-- );

-- CREATE VIRTUAL TABLE conversations_fts USING fts5(
--     title,
--     tokenize='porter unicode61'
-- ); 