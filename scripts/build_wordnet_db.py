#!/usr/bin/env python3
"""
Load the english-wordnet-2025-plus-json export into SQLite.

Assumed shapes
--------------
entries-*.json  ->  { "<lemma>": { "<pos>": { "sense": [ {"id":..,"synset":..}, .. ] }, .. }, .. }

noun.*.json / verb.*.json / adj.*.json / adv.*.json
                ->  { "<synset-id>": {
                        "definition":   [str, ..],
                        "members":      [str, ..],
                        "partOfSpeech": "n"|"v"|"a"|"s"|"r",
                        "ili":          "iNNNNN" | null,
                        "<relation>":   [synset-id, ..],   # 0..N relation keys
                        "example":      [str, ..]          # if present
                    }, .. }
"""

import json
import sqlite3
import glob
import os
from pathlib import Path

SRC = Path("./english-wordnet-2025")            # directory containing the *.json files
DB = Path("wordnet.sqlite")

# Relation keys we expect as top-level list-valued keys on a synset.
# Anything not in this set is treated as metadata, not an edge.
RELATION_KEYS = {
    # noun / general
    "hypernym", "hyponym", "instance_hypernym", "instance_hyponym",
    "mero_member", "mero_part", "mero_substance", "mero_location",
    "holo_member", "holo_part", "holo_substance", "holo_location",
    # verb
    "entails", "causes", "verb_group", "also_see",
    # adjective / adverb
    "similar_to", "participle", "pertainym", "derivation",
    # cross-POS
    "antonym", "domain_topic", "has_domain_topic",
    "domain_region", "has_domain_region",
    "domain_usage",  "has_domain_usage",
    "exemplifies",   "is_exemplified_by",
}

# Non-relation, non-list-of-target metadata keys we do NOT want as edges.
NON_RELATION_KEYS = {
    "definition", "members", "partOfSpeech", "ili",
    "example", "examples", "gloss", "id", "pos",
}

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE entries (
    id    TEXT PRIMARY KEY,
    lemma TEXT NOT NULL,
    pos   TEXT NOT NULL
);
CREATE INDEX idx_entries_lemma ON entries(lemma);

CREATE TABLE senses (
    id        TEXT PRIMARY KEY,
    entry_id  TEXT NOT NULL,
    synset_id TEXT NOT NULL
);
CREATE INDEX idx_senses_entry  ON senses(entry_id);
CREATE INDEX idx_senses_synset ON senses(synset_id);

CREATE TABLE synsets (
    id         TEXT PRIMARY KEY,
    pos        TEXT NOT NULL,
    ili        TEXT,
    definition TEXT,
    lexfile    TEXT
);
CREATE INDEX idx_synsets_pos ON synsets(pos);
CREATE INDEX idx_synsets_ili ON synsets(ili);

CREATE TABLE synset_members (
    synset_id TEXT NOT NULL,
    lemma     TEXT NOT NULL,
    PRIMARY KEY (synset_id, lemma)
);
CREATE INDEX idx_members_lemma ON synset_members(lemma);

CREATE TABLE synset_examples (
    synset_id TEXT NOT NULL,
    example   TEXT NOT NULL
);

CREATE TABLE relations (
    src_id TEXT NOT NULL,
    rel    TEXT NOT NULL,
    dst_id TEXT NOT NULL
);
CREATE INDEX idx_rel_src ON relations(src_id, rel);
CREATE INDEX idx_rel_dst ON relations(dst_id, rel);

CREATE VIRTUAL TABLE synset_fts USING fts5(
    synset_id UNINDEXED, definition, tokenize='porter'
);
"""


def entry_id(lemma: str, pos: str) -> str:
    return f"{pos}:{lemma}"


def load_entries(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    for fp in sorted(glob.glob(str(SRC / "entries-*.json"))):
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)

        for lemma, posmap in data.items():
            if not isinstance(posmap, dict):
                continue
            for pos, payload in posmap.items():
                eid = entry_id(lemma, pos)
                cur.execute(
                    "INSERT OR IGNORE INTO entries(id, lemma, pos) VALUES (?,?,?)",
                    (eid, lemma, pos),
                )
                senses = (payload or {}).get("sense", []) or []
                for s in senses:
                    sid = s.get("id")
                    syn = s.get("synset")
                    if sid and syn:
                        cur.execute(
                            "INSERT OR REPLACE INTO senses(id, entry_id, synset_id) "
                            "VALUES (?,?,?)",
                            (sid, eid, syn),
                        )
        conn.commit()
        print(f"  entries: {os.path.basename(fp)}")


def load_synsets(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    patterns = ["noun.*.json", "verb.*.json", "adj.*.json", "adv.*.json"]
    for pat in patterns:
        for fp in sorted(glob.glob(str(SRC / pat))):
            lexfile = os.path.basename(fp).removesuffix(".json")
            with open(fp, encoding="utf-8") as f:
                data = json.load(f)

            for sid, s in data.items():
                if not isinstance(s, dict):
                    continue
                pos = s.get("partOfSpeech") or lexfile.split(".")[0]
                ili = s.get("ili")
                defs = s.get("definition") or []
                if isinstance(defs, str):
                    defs = [defs]
                definition = "; ".join(
                    d for d in defs if isinstance(d, str)) or None

                cur.execute(
                    "INSERT OR REPLACE INTO synsets(id, pos, ili, definition, lexfile) "
                    "VALUES (?,?,?,?,?)",
                    (sid, pos, ili, definition, lexfile),
                )

                # synonyms
                for m in s.get("members") or []:
                    if isinstance(m, str):
                        cur.execute(
                            "INSERT OR IGNORE INTO synset_members(synset_id, lemma) "
                            "VALUES (?,?)",
                            (sid, m),
                        )

                # examples, if any
                for ex in s.get("example") or s.get("examples") or []:
                    if isinstance(ex, str):
                        cur.execute(
                            "INSERT INTO synset_examples(synset_id, example) VALUES (?,?)",
                            (sid, ex),
                        )

                # every remaining list-valued key that looks like a relation
                for key, val in s.items():
                    if key in NON_RELATION_KEYS:
                        continue
                    if key not in RELATION_KEYS:
                        # unknown key with a list of strings — treat as a relation
                        # anyway, so we don't silently drop new relation types.
                        if not (isinstance(val, list) and
                                all(isinstance(x, str) for x in val)):
                            continue
                    for tgt in val or []:
                        if isinstance(tgt, str):
                            cur.execute(
                                "INSERT INTO relations(src_id, rel, dst_id) "
                                "VALUES (?,?,?)",
                                (sid, key, tgt),
                            )
            conn.commit()
            print(f"  synsets: {os.path.basename(fp)}")


def populate_fts(conn: sqlite3.Connection) -> None:
    conn.execute(
        "INSERT INTO synset_fts(synset_id, definition) "
        "SELECT id, COALESCE(definition,'') FROM synsets"
    )
    conn.commit()


def main() -> None:
    if DB.exists():
        DB.unlink()
    conn = sqlite3.connect(DB)
    conn.executescript(SCHEMA)
    print("Loading entries…")
    load_entries(conn)
    print("Loading synsets…")
    load_synsets(conn)
    print("Building FTS…")
    populate_fts(conn)
    conn.execute("ANALYZE")
    conn.commit()
    conn.close()
    print(f"\nDone → {DB}  ({DB.stat().st_size/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
