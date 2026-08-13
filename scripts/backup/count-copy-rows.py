#!/usr/bin/env python3
import json
import re
import sys


if len(sys.argv) != 3:
    raise SystemExit("usage: count-copy-rows.py DATA_SQL OUTPUT_JSON")

wanted = {
    "auth.users",
    "storage.buckets",
    "storage.objects",
    "public.profiles",
    "public.users",
    "public.inquiries",
    "public.inquiry_messages",
}
counts = {name: 0 for name in wanted}
current = None
copy_pattern = re.compile(r'^COPY (?P<schema>"?[^". ]+"?)\.(?P<table>"?[^" (]+"?) \(')

with open(sys.argv[1], encoding="utf-8", errors="strict") as dump_file:
    for line in dump_file:
        if current is None:
            match = copy_pattern.match(line)
            if match:
                schema = match.group("schema").strip('"')
                table = match.group("table").strip('"')
                candidate = f"{schema}.{table}"
                current = candidate if candidate in wanted else "ignored"
        elif line == "\\.\n":
            current = None
        elif current != "ignored":
            counts[current] += 1

with open(sys.argv[2], "w", encoding="utf-8") as count_file:
    json.dump(counts, count_file, sort_keys=True)
