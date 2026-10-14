-- Spielstände (ein Eintrag je Google-Konto) und Sitzungen (nur der Hash des Schlüssels)
CREATE TABLE saves (
  sub TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  runs INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL
);
CREATE TABLE sessions (
  hash TEXT PRIMARY KEY,
  sub TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  expires INTEGER NOT NULL
);
CREATE INDEX sessions_sub ON sessions(sub);
