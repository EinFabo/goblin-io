-- App verbinden (exe/APK): die App holt einen Code, im Browser bestätigt ein angemeldetes Konto ihn,
-- dann holt die App ihre Sitzung ab. hash = SHA-256 des Geheimnisses, das nur die App kennt.
CREATE TABLE links (
  code TEXT PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  sub TEXT,
  name TEXT,
  picture TEXT,
  expires INTEGER NOT NULL
);
