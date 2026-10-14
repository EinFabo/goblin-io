-- Ein Konto spielt immer nur auf einem Gerät (wie Clash Royale): das zuletzt geöffnete Gerät ist aktiv,
-- die anderen dürfen nicht mehr speichern, bis man dort „Hier weiterspielen“ wählt.
CREATE TABLE active (
  sub TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  name TEXT,
  at INTEGER NOT NULL
);
-- Anmeldeseite für die App: Google leitet mit einem ID-Token zurück, nonce schützt vor wiederverwendeten Tokens
ALTER TABLE links ADD COLUMN nonce TEXT;
