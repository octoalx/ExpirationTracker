"""Export the supplied legacy DBF reference without modifying source files."""

import argparse
import collections
import csv
import hashlib
import json
from pathlib import Path
import re
import struct


def read_dbf(path):
    """Read fixed-width DBF fields; preserve character and numeric text exactly."""
    with path.open("rb") as stream:
        header = stream.read(32)
        count, header_size, record_size = struct.unpack_from("<IHH", header, 4)
        encoding = "cp866" if path.name.lower() in ("pos.dbf", "doc.dbf") else "cp1251"
        descriptors = stream.read(header_size - 32)
        fields, offset = [], 1
        for index in range(0, len(descriptors) - 31, 32):
            field = descriptors[index:index + 32]
            if field[0] == 13:
                break
            name = field[:11].split(b"\0")[0].decode("ascii")
            fields.append((name, offset, field[16]))
            offset += field[16]
        if offset != record_size:
            raise ValueError(f"Unsupported DBF record layout: {path.name}")
        stream.seek(header_size)
        for number in range(1, count + 1):
            record = stream.read(record_size)
            if len(record) != record_size or record[:1] not in (b" ", b"*"):
                raise ValueError(f"Invalid record {number}: {path.name}")
            yield number, record[:1] == b"*", {
                name: record[start:start + length].decode(encoding).strip()
                for name, start, length in fields
            }


def source_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def export(root):
    output = root / "Export"
    output.mkdir(exist_ok=True)
    sources = sorted(root.glob("*"))
    dbfs = [path for path in sources if path.suffix.lower() == ".dbf"]
    hashes = {path.name: source_hash(path) for path in dbfs}
    goods = {}
    stats = {}
    for path in dbfs:
        counts = collections.Counter()
        with (output / f"{path.stem}-raw.csv").open("w", encoding="utf-8-sig", newline="") as stream:
            writer = None
            for number, deleted, record in read_dbf(path):
                if writer is None:
                    writer = csv.writer(stream, delimiter=";")
                    writer.writerow(["DBF_RECORD", "DBF_DELETED", *record.keys()])
                writer.writerow([number, int(deleted), *record.values()])
                counts["total"] += 1
                counts["deleted" if deleted else "active"] += 1
                if path.name.lower() == "goods.dbf" and not deleted:
                    key = (record["ARTICUL"], record["IDSET"])
                    goods.setdefault(key, set()).add(record["NAME"])
        stats[path.name] = dict(counts)
    entries = collections.defaultdict(set)
    barcode_rows = 0
    for _, deleted, record in read_dbf(root / "barcode.dbf"):
        if deleted:
            continue
        barcode_rows += 1
        names = goods.get((record["ARTICUL"], record["IDSET"]), set())
        if len(names) != 1:
            raise ValueError(f"Missing or ambiguous goods key: {record['ARTICUL']}")
        code = record["BARCODE"]
        name = next(iter(names))
        if not re.fullmatch(r"[0-9]{8,14}", code) or not name or len(name) > 500:
            raise ValueError(f"Unsupported catalog entry: {code}")
        entries[code].add(name)
    if any(len(names) != 1 for names in entries.values()):
        raise ValueError("Conflicting names for the same barcode")
    catalog = output / "barcode-catalog.csv"
    with catalog.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream, delimiter=";")
        writer.writerow(["Штрих-код", "Наименование товара"])
        for code, names in entries.items():
            writer.writerow([code, next(iter(names))])
    with catalog.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(stream, delimiter=";")
        assert next(reader) == ["Штрих-код", "Наименование товара"]
        exported = 0
        for code, name in reader:
            assert entries[code] == {name}
            exported += 1
        assert exported == len(entries)
    assert hashes == {path.name: source_hash(path) for path in dbfs}
    report = {
        "encoding": "Windows-1251 goods/barcode/sprav; CP866 Doc/Pos; UTF-8 BOM output",
        "join": "barcode.ARTICUL + IDSET = goods.ARTICUL + IDSET",
        "tables": stats,
        "active_barcode_rows": barcode_rows,
        "unique_catalog_entries": exported,
        "identical_duplicate_rows": barcode_rows - exported,
        "barcode_lengths": dict(collections.Counter(map(len, entries))),
        "missing_joins": 0,
        "conflicting_names": 0,
        "invalid_entries": 0,
        "source_sha256": hashes,
        "catalog_sha256": source_hash(catalog),
        "source_files_unchanged": True,
        "csv_roundtrip_verified": True,
    }
    (output / "extraction-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / "README.txt").write_text(
        "Legacy database export\n\n"
        "barcode-catalog.csv: complete scanner reference, barcode and product name.\n"
        "*-raw.csv: all five DBF tables, including source row and deletion flag.\n"
        "CSV delimiter: semicolon. Encoding: UTF-8 with BOM.\n"
        "In Excel use Data > From Text/CSV and set barcode/ARTICUL columns to Text.\n"
        "CDX files are indexes. SDB files are not required for this verified join.\n"
        "Original files are unchanged. No website import was performed.\n"
        "Current website Excel import supports at most 10,000 rows; bulk CSV import\n"
        "must be implemented before loading this complete reference.\n"
        "See extraction-report.json for reconciliation and source hashes.\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    export(parser.parse_args().source.resolve())
