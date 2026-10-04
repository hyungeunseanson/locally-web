#!/usr/bin/env python3
"""Read-only lifecycle visibility. There is deliberately no apply/delete mode."""
import argparse
import json
import os
import urllib.parse
from collections import Counter
import datetime as dt
from storage_byte_backup import SupabaseStorageSource, BackupError, ValidationError, parse_utc


def read_rows(source, table, fields):
    rows, offset = [], 0
    while True:
        query = urllib.parse.urlencode({"select": fields, "order": "asset_id.asc,parent_type.asc,parent_id.asc" if table == "media_asset_references" else "asset_id.asc" if table == "media_deletion_journal" else "id.asc", "limit": 500, "offset": offset})
        with source._request("GET", "/rest/v1/" + table + "?" + query) as response:
            page = json.load(response)
        if not isinstance(page, list):
            raise ValidationError("lifecycle inventory unavailable")
        rows.extend(page)
        if len(rows) > 10000:
            raise ValidationError("operator plan ceiling exceeded")
        if len(page) < 500:
            return rows
        offset += len(page)


def plan(assets, references, journal, minimum_age_seconds=None, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    refs = Counter(row["asset_id"] for row in references)
    visibility, candidates, excluded = Counter(), [], Counter()
    for asset in assets:
        visibility[(asset["provider"], asset["business_scope"], asset["state"])] += 1
        if asset["state"] != "pending":
            continue
        if asset["backup_pinned"] or asset["migration_pinned"]:
            excluded["pinned"] += 1
        elif refs[asset["id"]]:
            excluded["referenced"] += 1
        elif minimum_age_seconds is None or minimum_age_seconds <= 0:
            excluded["minimum_age_not_configured"] += 1
        elif (now - parse_utc(asset["created_at"])).total_seconds() < minimum_age_seconds:
            excluded["younger_than_policy"] += 1
        else:
            candidates.append(asset["id"])
    return {"mode": "dry-run", "physicalDeletionEnabled": False, "historicalObjectsConsidered": 0,
            "visibility": [{"provider": p, "businessScope": b, "state": s, "count": n} for (p,b,s),n in sorted(visibility.items())],
            "deletionJournal": dict(Counter(row["state"] for row in journal)), "excludedPending": dict(excluded),
            "ageEligibleAssetIds": sorted(candidates)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--minimum-age-seconds", type=int)
    args = parser.parse_args()
    source = SupabaseStorageSource("https://uhinvcydgzqlpnvieyal.supabase.co", os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))
    assets = read_rows(source, "media_assets", "id,provider,business_scope,state,created_at,backup_pinned,migration_pinned")
    references = read_rows(source, "media_asset_references", "asset_id,parent_type,parent_id")
    rows = read_rows(source, "media_deletion_journal", "asset_id,state")
    print(json.dumps(plan(assets, references, rows, args.minimum_age_seconds), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except BackupError as error:
        print(json.dumps({"status": "failed", "diagnosticCode": error.code}))
        raise SystemExit(1)
