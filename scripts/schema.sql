-- One row per (word, pos). Word + pos is the natural key.
CREATE TABLE entries (
    id   TEXT PRIMARY KEY,          -- synthetic: pos || ':' || lemma
    lemma TEXT NOT NULL,
    pos   TEXT NOT NULL
);
CREATE INDEX idx_entries_lemma ON entries(lemma);

-- Every sense (word + pos + meaning)
CREATE TABLE senses (
    id         TEXT PRIMARY KEY,    -- e.g. "'hood%1:14:01::"
    entry_id   TEXT NOT NULL REFERENCES entries(id),
    synset_id  TEXT NOT NULL
);
CREATE INDEX idx_senses_entry  ON senses(entry_id);
CREATE INDEX idx_senses_synset ON senses(synset_id);

-- Concept table
CREATE TABLE synsets (
    id          TEXT PRIMARY KEY,   -- "02668615-n"
    pos         TEXT NOT NULL,      -- "n","v","a","s","r"
    ili         TEXT,               -- interlingual index, e.g. "i49755"
    definition  TEXT,
    lexfile     TEXT                -- from filename, e.g. "noun.artifact"
);
CREATE INDEX idx_synsets_pos ON synsets(pos);
CREATE INDEX idx_synsets_ili ON synsets(ili);

CREATE TABLE synset_members (
    synset_id TEXT NOT NULL REFERENCES synsets(id),
    lemma     TEXT NOT NULL,
    PRIMARY KEY (synset_id, lemma)
);
CREATE INDEX idx_members_lemma ON synset_members(lemma);

CREATE TABLE synset_examples (
    synset_id TEXT NOT NULL REFERENCES synsets(id),
    example   TEXT NOT NULL
);

-- Generic edge table: one row per (source, relation type, target)
CREATE TABLE relations (
    src_id TEXT NOT NULL,   -- synset id
    rel    TEXT NOT NULL,   -- "hypernym","hyponym","antonym",...
    dst_id TEXT NOT NULL    -- target synset id
);
CREATE INDEX idx_rel_src ON relations(src_id, rel);
CREATE INDEX idx_rel_dst ON relations(dst_id, rel);

-- Optional FTS over definitions
CREATE VIRTUAL TABLE synset_fts USING fts5(
    synset_id UNINDEXED, definition, tokenize='porter'
);
