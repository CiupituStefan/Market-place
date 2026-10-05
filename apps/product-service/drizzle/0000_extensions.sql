-- Trigram similarity for typo-tolerant product search (trusted extension: the
-- database owner can create it, no superuser needed on RDS).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
