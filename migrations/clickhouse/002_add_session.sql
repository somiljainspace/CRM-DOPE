ALTER TABLE events.analytics_events ADD COLUMN IF NOT EXISTS session_id String DEFAULT '' AFTER anonymous_id;
