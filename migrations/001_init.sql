CREATE TABLE IF NOT EXISTS urls (
  id          SERIAL PRIMARY KEY,
  original_url TEXT NOT NULL,
  short_code  VARCHAR(10) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  click_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
CREATE INDEX IF NOT EXISTS idx_urls_expires_at ON urls(expires_at);

CREATE TABLE IF NOT EXISTS clicks (
  id         BIGSERIAL PRIMARY KEY,
  url_id     INTEGER REFERENCES urls(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer   TEXT
);

CREATE INDEX IF NOT EXISTS idx_clicks_url_id ON clicks(url_id);
CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON clicks(clicked_at);
