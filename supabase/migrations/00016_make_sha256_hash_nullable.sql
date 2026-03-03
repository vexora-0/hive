-- Make sha256_hash nullable since hashing is skipped on the client
ALTER TABLE photos ALTER COLUMN sha256_hash DROP NOT NULL;
