import sqlite3


def connect(path="wordnet.sqlite"):
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def senses_of(conn, word, pos=None):
    sql = """SELECT s.id AS sense_id, s.synset_id, sy.pos, sy.definition
             FROM entries e
             JOIN senses  s  ON s.entry_id = e.id
             JOIN synsets sy ON sy.id = s.synset_id
             WHERE e.lemma = ?"""
    args = [word]
    if pos:
        sql += " AND e.pos = ?"
        args.append(pos)
    return conn.execute(sql, args).fetchall()


def synonyms(conn, synset_id):
    return [r["lemma"] for r in conn.execute(
        "SELECT lemma FROM synset_members WHERE synset_id = ?", (synset_id,))]


def edges(conn, synset_id, rel=None):
    sql = "SELECT rel, dst_id FROM relations WHERE src_id = ?"
    args = [synset_id]
    if rel:
        sql += " AND rel = ?"
        args.append(rel)
    return conn.execute(sql, args).fetchall()


def hypernyms_up(conn, synset_id, max_depth=20):
    """Yield (depth, synset_id, definition) walking hypernym edges up."""
    frontier = [(0, synset_id)]
    seen = set()
    while frontier:
        d, sid = frontier.pop(0)
        if sid in seen or d > max_depth:
            continue
        seen.add(sid)
        row = conn.execute(
            "SELECT definition FROM synsets WHERE id = ?", (sid,)).fetchone()
        yield d, sid, row["definition"] if row else None
        for r in conn.execute(
            "SELECT dst_id FROM relations "
            "WHERE src_id = ? AND rel IN ('hypernym','instance_hypernym')",
                (sid,)):
            frontier.append((d + 1, r["dst_id"]))


def search_definitions(conn, query, limit=20):
    return conn.execute(
        "SELECT synset_id, definition FROM synset_fts "
        "WHERE synset_fts MATCH ? LIMIT ?", (query, limit)).fetchall()


# import wn
# conn = wn.connect()
# for r in wn.senses_of(conn, "'hood", "n"):
    # print(r["sense_id"], "→", r["synset_id"], "-", r["definition"])
# for d, sid, defn in wn.hypernyms_up(conn, "08242255-n"):
    # print("  " * d, sid, defn)
