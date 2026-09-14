import hashlib
import importlib.util
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SPEC = importlib.util.spec_from_file_location("recovery", Path(__file__).with_name("r2-public-image-recovery.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def conditional_error():
    error_type = MODULE.RECONCILE.ClientError
    try:
        error = error_type(
            {"Error": {"Code": "PreconditionFailed", "Message": "conditional conflict"}, "ResponseMetadata": {"HTTPStatusCode": 412}},
            "PutObject",
        )
        if (error.response.get("Error") or {}).get("Code") == "PreconditionFailed":
            return error
    except (TypeError, KeyError):
        pass
    return error_type("PreconditionFailed", 412)


class FakeClient:
    def __init__(self, concurrent=False, conflict=False, fail_after=None):
        self.objects = {}
        self.concurrent = concurrent
        self.conflict = conflict
        self.fail_after = fail_after
        self.put_calls = []
        self.copy_calls = []
        self.delete_calls = []

    def put_object(self, **kwargs):
        self.put_calls.append(kwargs)
        if self.fail_after is not None and len(self.put_calls) > self.fail_after:
            raise RuntimeError("bounded injected failure")
        key = kwargs["Key"]
        body = kwargs["Body"].read()
        if self.concurrent:
            self.concurrent = False
            self.objects[key] = {
                "body": b"conflict" if self.conflict else body,
                "contentType": kwargs["ContentType"], "cacheControl": kwargs["CacheControl"],
                "metadata": kwargs["Metadata"],
            }
            raise conditional_error()
        if key in self.objects:
            raise conditional_error()
        self.objects[key] = {"body": body, "contentType": kwargs["ContentType"], "cacheControl": kwargs["CacheControl"], "metadata": kwargs["Metadata"]}

    def head_object(self, Bucket, Key):
        item = self.objects[Key]
        return {"ContentLength": len(item["body"]), "ContentType": item["contentType"], "CacheControl": item["cacheControl"], "Metadata": item["metadata"]}

    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.objects[Key]["body"])}


def original_item(root, body=b"source-bytes", name="original"):
    source_sha = hashlib.sha256(body).hexdigest()
    source_key_sha = hashlib.sha256(name.encode()).hexdigest()
    key = f"originals/v1/{source_key_sha[:2]}/{source_key_sha}/{source_sha}.jpg"
    (root / "objects").mkdir(exist_ok=True)
    path = root / "objects" / name
    path.write_bytes(body)
    return {"key": key, "path": f"objects/{path.name}", "bytes": len(body), "sha256": source_sha, "contentType": "image/jpeg", "sourceKeySha256": source_key_sha, "sourceByteSha256": source_sha, "sourceSize": len(body)}


def recovery_plan(originals=None, derivatives=None, r2_state="a" * 64, conflicts=None):
    originals = originals or []
    derivatives = derivatives or []
    proofs = {}
    for item in [*originals, *derivatives]:
        proofs[item["sourceKeySha256"]] = {
            "sourceKeySha256": item["sourceKeySha256"],
            "sourceByteSha256": item["sourceByteSha256"],
            "sourceSize": item["sourceSize"],
            "contentType": "image/jpeg",
        }
    budget = {
        "maxSourceDownloads": len(proofs), "maxSourceBytes": sum(item["sourceSize"] for item in proofs.values()),
        "maxOriginalCreates": len(originals), "maxDerivativeCreates": len(derivatives), "maxTransforms": len(derivatives),
    }
    execution = {
        "version": 2, "scope": MODULE.EXPECTED_SCOPE,
        "sourceSnapshotDigest": "b" * 64, "r2StateDigest": r2_state,
        "cursor": 0, "nextCursor": 0, "budget": budget,
        "planUsage": {
            "sourceGets": {"attempts": len(proofs), "successes": len(proofs), "failures": 0, "bytes": sum(item["sourceSize"] for item in proofs.values())},
            "transforms": {"attempts": len(derivatives), "successes": len(derivatives), "failures": 0},
        },
        "lifecycleBudget": {
            "maxSourceGetAttempts": MODULE.HARD_LIMITS["maxSourceDownloads"],
            "maxSourceBytes": MODULE.HARD_LIMITS["maxSourceBytes"],
            "maxTransformAttempts": budget["maxTransforms"],
            "maxR2CreateAttempts": len(originals) + len(derivatives),
        },
        "sourceProofs": list(proofs.values()), "originals": originals, "derivatives": derivatives,
        "conflicts": conflicts or [],
    }
    digest = hashlib.sha256(MODULE.stable_json(execution).encode()).hexdigest()
    plan = {"version": 2, "generatedAt": "2026-09-14T00:00:00.000Z", "execution": execution, "planDigest": digest, "progress": {}}
    state = {
        "version": 1, "planDigest": digest, "limits": execution["lifecycleBudget"],
        "usage": {
            "sourceGets": {
                "plan": dict(execution["planUsage"]["sourceGets"]),
                "preApply": {
                    "attempts": len(proofs), "successes": len(proofs), "failures": 0,
                    "bytes": sum(item["sourceSize"] for item in proofs.values()),
                },
                **{phase: {"attempts": 0, "successes": 0, "failures": 0, "bytes": 0} for phase in ("apply", "postApply")},
            },
            "transforms": {"attempts": len(derivatives), "successes": len(derivatives), "failures": 0},
            "r2Creates": {"attempts": 0, "successes": 0, "exactSkips": 0, "failures": 0},
        },
    }
    return plan, state


class RecoveryConditionalWriteTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.item = original_item(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def test_conditional_original_create_and_second_run_exact_skip(self):
        client = FakeClient()
        self.assertEqual(MODULE.create_original(client, "bucket", self.root, self.item, "now"), "created")
        self.assertEqual(MODULE.create_original(client, "bucket", self.root, self.item, "now"), "concurrent_exact_skip")
        self.assertEqual(len(client.put_calls), 2)
        self.assertTrue(all(call["IfNoneMatch"] == "*" for call in client.put_calls))
        self.assertEqual(client.copy_calls, [])
        self.assertEqual(client.delete_calls, [])

    def test_concurrent_exact_writer_is_verified_without_overwrite(self):
        client = FakeClient(concurrent=True)
        self.assertEqual(MODULE.create_original(client, "bucket", self.root, self.item, "now"), "concurrent_exact_skip")
        self.assertEqual(len(client.put_calls), 1)

    def test_concurrent_conflict_fails_closed(self):
        client = FakeClient(concurrent=True, conflict=True)
        with self.assertRaisesRegex(RuntimeError, "Original conflict"):
            MODULE.create_original(client, "bucket", self.root, self.item, "now")
        self.assertEqual(len(client.put_calls), 1)

    def test_plan_requires_exact_digest_and_rejects_conflicts(self):
        plan, _state = recovery_plan()
        digest = plan["planDigest"]
        MODULE.validate_plan(plan, digest)
        with self.assertRaisesRegex(RuntimeError, "confirmation"):
            MODULE.validate_plan(plan, "0" * 64)
        with self.assertRaisesRegex(RuntimeError, "contains conflicts"):
            changed = json.loads(json.dumps(plan))
            changed["execution"]["conflicts"] = [{"reason": "conflict"}]
            changed["planDigest"] = hashlib.sha256(MODULE.stable_json(changed["execution"]).encode()).hexdigest()
            MODULE.validate_plan(changed, changed["planDigest"])

    def test_every_execution_field_is_digest_bound_before_writes(self):
        plan, state = recovery_plan([self.item])
        for mutate in (
            lambda value: value["execution"].update(r2StateDigest="c" * 64),
            lambda value: value["execution"].update(sourceSnapshotDigest="e" * 64),
            lambda value: value["execution"]["budget"].update(maxOriginalCreates=2),
            lambda value: value["execution"]["originals"][0].update(sha256="d" * 64),
            lambda value: value["execution"]["sourceProofs"][0].update(sourceSize=999),
            lambda value: value["execution"]["originals"].append(dict(value["execution"]["originals"][0])),
        ):
            changed = json.loads(json.dumps(plan))
            mutate(changed)
            client = FakeClient()
            with self.assertRaisesRegex(RuntimeError, "confirmation"):
                MODULE.apply_plan(client, "bucket", changed, self.root / "plan.json", self.root / "result.json", plan["planDigest"], state, self.root / "budget.json")
            self.assertEqual(client.put_calls, [])

        duplicate_authority = json.loads(json.dumps(plan))
        duplicate_authority["originals"] = duplicate_authority["execution"]["originals"]
        client = FakeClient()
        with self.assertRaisesRegex(RuntimeError, "document structure"):
            MODULE.apply_plan(
                client, "bucket", duplicate_authority, self.root / "plan.json", self.root / "result.json",
                duplicate_authority["planDigest"], state, self.root / "budget.json",
            )
        self.assertEqual(client.put_calls, [])

    def test_apply_requires_completed_preapply_verification_before_any_write(self):
        plan, state = recovery_plan([self.item])
        state["usage"]["sourceGets"]["preApply"] = {
            "attempts": 0, "successes": 0, "failures": 0, "bytes": 0,
        }
        client = FakeClient()
        with self.assertRaisesRegex(RuntimeError, "pre-apply source verification is incomplete"):
            MODULE.apply_plan(
                client, "bucket", plan, self.root / "plan.json", self.root / "result.json",
                plan["planDigest"], state, self.root / "budget.json",
            )
        self.assertEqual(client.put_calls, [])

    def test_rehashed_invalid_schema_namespace_budget_and_files_are_rejected_before_writes(self):
        plan, state = recovery_plan([self.item])
        mutations = (
            lambda value: value["execution"].update(version=99),
            lambda value: value["execution"]["scope"].update(bucket="unexpected"),
            lambda value: value["execution"]["budget"].update(maxOriginalCreates=51),
            lambda value: value["execution"]["originals"][0].update(key="unexpected/object.jpg"),
            lambda value: value["execution"]["originals"][0].update(path="../outside"),
        )
        for mutate in mutations:
            changed = json.loads(json.dumps(plan))
            mutate(changed)
            changed["planDigest"] = hashlib.sha256(MODULE.stable_json(changed["execution"]).encode()).hexdigest()
            changed_state = json.loads(json.dumps(state))
            changed_state["planDigest"] = changed["planDigest"]
            changed_state["limits"] = changed["execution"]["lifecycleBudget"]
            client = FakeClient()
            with self.assertRaises(RuntimeError):
                MODULE.apply_plan(client, "bucket", changed, self.root / "plan.json", self.root / "result.json", changed["planDigest"], changed_state, self.root / "budget.json")
            self.assertEqual(client.put_calls, [])

        changed = json.loads(json.dumps(plan))
        (self.root / self.item["path"]).write_bytes(b"tampered")
        client = FakeClient()
        with self.assertRaisesRegex(RuntimeError, "artifact"):
            MODULE.apply_plan(client, "bucket", changed, self.root / "plan.json", self.root / "result.json", changed["planDigest"], state, self.root / "budget.json")
        self.assertEqual(client.put_calls, [])

    def test_plan_digest_matches_node_stable_json_contract(self):
        payload = {"version": 1, "items": [{"b": 2, "a": "한글"}]}
        digest = hashlib.sha256(MODULE.stable_json(payload).encode()).hexdigest()
        self.assertEqual(digest, "865b80541b286b8a0bc2aaf1b42d10d615c847564395374de3845e944622a7d5")

    def test_existing_exact_original_allows_additional_metadata_without_rewrite(self):
        client = FakeClient()
        self.assertEqual(MODULE.create_original(client, "bucket", self.root, self.item, "now"), "created")
        client.objects[self.item["key"]]["metadata"]["future_provenance"] = "preserved"
        self.assertTrue(MODULE.verify_original(client, "bucket", self.item))
        self.assertEqual(MODULE.create_original(client, "bucket", self.root, self.item, "later"), "concurrent_exact_skip")
        self.assertEqual(client.objects[self.item["key"]]["metadata"]["future_provenance"], "preserved")

    def test_partial_failure_result_is_preserved_for_safe_rerun(self):
        second = original_item(self.root, b"second-source", "second")
        plan, state = recovery_plan([self.item, second], r2_state="d" * 64)
        budget_path = self.root / "budget.json"
        budget_path.write_text(MODULE.stable_json(state))
        output = self.root / "result.json"
        client = FakeClient(fail_after=1)
        with mock.patch.object(MODULE, "normalize_metadata", return_value=([], "d" * 64, {})):
            with self.assertRaisesRegex(RuntimeError, "injected"):
                MODULE.apply_plan(client, "bucket", plan, self.root / "plan.json", output, plan["planDigest"], state, budget_path)
        result = json.loads(output.read_text())
        self.assertEqual(result["status"], "partial_failure")
        self.assertEqual(result["originalCreatedCount"], 1)
        self.assertEqual(result["pendingObjectCount"], 1)
        self.assertEqual(result["deletedObjectCount"], 0)
        self.assertEqual(result["copiedObjectCount"], 0)

    def test_actual_node_planner_plan_applies_through_python_executor_and_reruns_as_exact_skip(self):
        generated = self.root / "generated"
        completed = subprocess.run(
            ["node", str(Path(__file__).with_name("recovery-planner-fixture.mjs")), str(generated)],
            check=True, capture_output=True, text=True,
        )
        summary = json.loads(completed.stdout)
        plan_path = generated / ".recovery-plan.json"
        budget_path = generated / ".recovery-budget.json"
        plan = json.loads(plan_path.read_text())
        initial_budget = json.loads(budget_path.read_text())
        self.assertEqual(summary, {"derivativeCount": 5, "originalCount": 1, "planDigest": plan["planDigest"]})
        client = FakeClient()
        with mock.patch.object(MODULE, "normalize_metadata", return_value=([], "a" * 64, {})), \
             mock.patch.object(MODULE.RECONCILE, "verify_public_object", return_value=None):
            first = MODULE.apply_plan(
                client, "bucket", plan, plan_path, generated / "first.json", plan["planDigest"],
                json.loads(json.dumps(initial_budget)), budget_path,
            )
        self.assertEqual(first["originalCreatedCount"], 1)
        self.assertEqual(first["derivativeCreatedCount"], 5)
        self.assertEqual(len(client.put_calls), 6)

        second_budget = json.loads(json.dumps(initial_budget))
        budget_path.write_text(MODULE.stable_json(second_budget))
        with mock.patch.object(MODULE, "normalize_metadata", return_value=([], "a" * 64, {})), \
             mock.patch.object(MODULE.RECONCILE, "verify_public_object", return_value=None):
            second = MODULE.apply_plan(
                client, "bucket", plan, plan_path, generated / "second.json", plan["planDigest"],
                second_budget, budget_path,
            )
        self.assertEqual(second["originalConcurrentExactSkipCount"], 1)
        self.assertEqual(second["derivativeConcurrentExactSkipCount"], 5)
        self.assertEqual(len(client.put_calls), 12)
        self.assertEqual(client.copy_calls, [])
        self.assertEqual(client.delete_calls, [])

        concurrent_client = FakeClient(concurrent=True)
        concurrent_budget = json.loads(json.dumps(initial_budget))
        budget_path.write_text(MODULE.stable_json(concurrent_budget))
        with mock.patch.object(MODULE, "normalize_metadata", return_value=([], "a" * 64, {})), \
             mock.patch.object(MODULE.RECONCILE, "verify_public_object", return_value=None):
            concurrent = MODULE.apply_plan(
                concurrent_client, "bucket", plan, plan_path, generated / "concurrent.json", plan["planDigest"],
                concurrent_budget, budget_path,
            )
        self.assertEqual(concurrent["originalConcurrentExactSkipCount"], 1)
        self.assertEqual(concurrent["derivativeCreatedCount"], 5)

        partial_client = FakeClient(fail_after=1)
        partial_budget = json.loads(json.dumps(initial_budget))
        budget_path.write_text(MODULE.stable_json(partial_budget))
        with mock.patch.object(MODULE, "normalize_metadata", return_value=([], "a" * 64, {})), \
             mock.patch.object(MODULE.RECONCILE, "verify_public_object", return_value=None), \
             self.assertRaisesRegex(RuntimeError, "injected"):
            MODULE.apply_plan(
                partial_client, "bucket", plan, plan_path, generated / "partial.json", plan["planDigest"],
                partial_budget, budget_path,
            )
        partial = json.loads((generated / "partial.json").read_text())
        self.assertEqual(partial["status"], "partial_failure")
        self.assertEqual(partial["verifiedObjectCount"], 1)
        self.assertEqual(partial["pendingObjectCount"], 5)

        other = self.root / "other-generated"
        subprocess.run(["node", str(Path(__file__).with_name("recovery-planner-fixture.mjs")), str(other)], check=True, capture_output=True, text=True)
        other_plan = json.loads((other / ".recovery-plan.json").read_text())
        self.assertEqual(plan["planDigest"], other_plan["planDigest"])


if __name__ == "__main__":
    unittest.main()
