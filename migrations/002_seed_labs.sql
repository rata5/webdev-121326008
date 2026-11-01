-- 002: the labs that exist on day one, so the lab list is never empty in a fresh database.
INSERT INTO labs (name, room, capacity) VALUES
  ('Computer Lab 1', '1203', 24),
  ('Computer Lab 2', '1205', 20),
  ('Networks Lab', '1412', 16);
