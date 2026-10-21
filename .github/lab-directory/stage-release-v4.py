#!/usr/bin/env python3
"""Transport two reviewed large blobs; never update the main branch.

Only the fixed staging push may run this entry point. All 21 final files are
verified and tested, but the carrier tree contains only the two large JSON
changes on the fixed baseline. It contains no workflow changes or temporary
inputs. A separately authorized API operation can use those blobs in the final
21-file release tree. Authentication is supplied by actions/checkout.
"""

import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile


BASE = "11ce143583be8f9c3765c163817405e7d3f3096d"
STAGING_BRANCH = "labs-expand-20261021-v4"
READY_BRANCH = "labs-expand-20261021-v4-ready"
MANIFEST = ".github/lab-directory/staging-manifest-v4.json"
ADDITIONS = ".github/lab-directory/reviewed-additions-20261021-v4.json"
ADDITIONS_GZIP = ".github/lab-directory/staging-additions-20261021-v4.json.gz"
LABS = "personal-growth-lab/academy/data/labs.json"
CARRIER_PATHS = {LABS, ADDITIONS}
TEMPORARY_PATHS = (
    ".github/workflows/lab-directory-stage-v4.yml",
    ".github/lab-directory/stage-release-v4.py",
    MANIFEST,
    ADDITIONS_GZIP,
)
FINAL_PATHS = {
    ".github/lab-directory/enrich_candidates.py",
    ".github/lab-directory/test_enrich_candidates.py",
    ".github/lab-directory/institution-aliases.json",
    ".github/lab-directory/README.md",
    ".github/lab-directory/.gitignore",
    ADDITIONS,
    ".github/lab-directory/reviewed-provenance-20261021-v4.json",
    ".github/lab-directory/reviewed-expansion-report-20261021-v4.json",
    ".github/lab-directory/reviewed-identity-audit-20261021-v4.json",
    ".github/workflows/lab-evidence-monitor.yml",
    "personal-growth-lab/academy/labs.html",
    "personal-growth-lab/academy/assets/labs.js",
    "personal-growth-lab/academy/assets/labs.css",
    "personal-growth-lab/academy/assets/lab-model.js",
    LABS,
    LABS + ".gz",
    "personal-growth-lab/academy/data/lab-sources.json",
    "personal-growth-lab/academy/LAB_DATABASE.md",
    "personal-growth-lab/academy/tools/test_labs.py",
    "personal-growth-lab/academy/tools/test_lab_model.cjs",
    "personal-growth-lab/academy/tools/test_labs_browser.cjs",
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(args, *, env=None, show=False):
    result = subprocess.run(args, env=env, capture_output=True)
    if show or result.returncode:
        for stream in (result.stdout, result.stderr):
            if stream:
                decoded = stream.decode("utf-8", errors="replace")
                print(decoded[:16000], end="" if decoded.endswith("\n") else "\n")
                if len(decoded) > 16000:
                    print("[Remaining command output omitted.]")
    require(result.returncode == 0, f"Command failed: {args[0]} {args[1]}")
    return result.stdout


def safe_file(root, relative):
    path = PurePosixPath(relative)
    require(
        isinstance(relative, str)
        and relative == path.as_posix()
        and not path.is_absolute()
        and all(part not in ("", ".", "..", ".git") for part in path.parts)
        and not any(char in relative for char in "\\\x00\n\r\t"),
        "Unsafe manifest path",
    )
    result = root / relative
    require(result.resolve().is_relative_to(root), f"Path escapes checkout: {relative}")
    require(
        not any(part.is_symlink() for part in (result, *result.parents) if part != root),
        f"Symlink is not an approved release file: {relative}",
    )
    return result


def load_manifest(root):
    rows = json.loads(safe_file(root, MANIFEST).read_text(encoding="utf-8"))
    require(isinstance(rows, list) and len(rows) == 21, "Expected 21 manifest files")
    manifest = {}
    for row in rows:
        require(isinstance(row, dict), "Invalid manifest row")
        relative = row.get("path")
        require(isinstance(relative, str), "Missing manifest path")
        safe_file(root, relative)
        require(relative not in manifest, f"Repeated manifest path: {relative}")
        require(type(row.get("size")) is int and 0 <= row["size"] <= 100_000_000,
                f"Invalid file size: {relative}")
        require(row.get("chars") is None or
                (type(row["chars"]) is int and 0 <= row["chars"] <= row["size"]),
                f"Invalid character count: {relative}")
        for key, length in (("sha", 40), ("sha256", 64)):
            require(isinstance(row.get(key), str) and
                    re.fullmatch(r"[0-9a-f]{" + str(length) + r"}", row[key]),
                    f"Invalid {key}: {relative}")
        manifest[relative] = row
    require(set(manifest) == FINAL_PATHS, "Manifest differs from the approved 21 paths")
    return manifest


def verify_bytes(data, row):
    relative = row["path"]
    require(len(data) == row["size"], f"Size mismatch: {relative}")
    if row["chars"] is not None:
        require(len(data.decode("utf-8")) == row["chars"], f"Character count mismatch: {relative}")
    require(hashlib.sha256(data).hexdigest() == row["sha256"], f"SHA-256 mismatch: {relative}")
    header = f"blob {len(data)}\0".encode("ascii")
    require(hashlib.sha1(header + data).hexdigest() == row["sha"], f"Git blob mismatch: {relative}")


def verify_files(root, manifest):
    for relative, row in manifest.items():
        path = safe_file(root, relative)
        require(path.is_file(), f"Missing release file: {relative}")
        verify_bytes(path.read_bytes(), row)
    print("Verified all 21 release files (size, character count, SHA-256, Git blob SHA).")


def decompress(root, source, target, manifest):
    source_path = safe_file(root, source)
    require(source_path.is_file(), f"Missing compressed input: {source}")
    with gzip.open(source_path, "rb") as compressed:
        # A bounded read prevents an unexpected archive from exhausting the runner.
        data = compressed.read(manifest[target]["size"] + 1)
    verify_bytes(data, manifest[target])
    target_path = safe_file(root, target)
    target_path.write_bytes(data)
    print(f"Materialized and verified {target}.")


def assert_ready_branch_absent():
    refs = run(["git", "ls-remote", "--heads", "origin", f"refs/heads/{READY_BRANCH}"])
    require(not refs.strip(), "Ready branch already exists; refusing to update it")


def main():
    require(os.environ.get("GITHUB_EVENT_NAME") == "push", "Only a staging push may publish")
    require(os.environ.get("GITHUB_REF") == f"refs/heads/{STAGING_BRANCH}",
            "Refusing to run outside the fixed staging branch")
    root = Path(run(["git", "rev-parse", "--show-toplevel"]).decode().strip()).resolve()
    os.chdir(root)
    head = run(["git", "rev-parse", "HEAD"]).decode().strip()
    require(head == os.environ.get("GITHUB_SHA"), "Checkout is not the triggering commit")
    run(["git", "cat-file", "-e", BASE + "^{commit}"])
    run(["git", "merge-base", "--is-ancestor", BASE, head])
    assert_ready_branch_absent()
    manifest = load_manifest(root)
    decompress(root, LABS + ".gz", LABS, manifest)
    decompress(root, ADDITIONS_GZIP, ADDITIONS, manifest)
    verify_files(root, manifest)

    for command in (
        [sys.executable, ".github/lab-directory/test_enrich_candidates.py"],
        [sys.executable, "personal-growth-lab/academy/tools/test_labs.py"],
        ["node", "personal-growth-lab/academy/tools/test_lab_model.cjs"],
    ):
        print(f"Running {command[-1]}", flush=True)
        run(command, show=True)
    # Tests must not change any reviewed release bytes.
    verify_files(root, manifest)

    with tempfile.TemporaryDirectory(prefix="lab-release-v4-") as temporary:
        git_env = os.environ.copy()
        git_env["GIT_INDEX_FILE"] = str(Path(temporary) / "index")
        git_env.update({
            "GIT_AUTHOR_NAME": "github-actions[bot]",
            "GIT_AUTHOR_EMAIL": "41898282+github-actions[bot]@users.noreply.github.com",
            "GIT_COMMITTER_NAME": "github-actions[bot]",
            "GIT_COMMITTER_EMAIL": "41898282+github-actions[bot]@users.noreply.github.com",
        })
        run(["git", "read-tree", BASE], env=git_env)
        run(["git", "add", "--", *sorted(CARRIER_PATHS)], env=git_env)
        tree = run(["git", "write-tree"], env=git_env).decode().strip()

        changed = run(["git", "diff-tree", "--no-commit-id", "--name-only", "--no-renames",
                       "-r", "-z", BASE + "^{tree}", tree], env=git_env)
        changed_paths = {p.decode("utf-8") for p in changed.split(b"\0") if p}
        require(changed_paths == CARRIER_PATHS, "Carrier diff is not exactly the two approved JSON paths")
        entries = {}
        for item in run(["git", "ls-tree", "-r", "-z", tree], env=git_env).split(b"\0"):
            if item:
                metadata, relative = item.split(b"\t", 1)
                mode, kind, sha = metadata.decode("ascii").split()
                entries[relative.decode("utf-8")] = (mode, kind, sha)
        for relative in CARRIER_PATHS:
            row = manifest[relative]
            mode, kind, sha = entries[relative]
            require(mode in ("100644", "100755") and kind == "blob" and sha == row["sha"],
                    f"Carrier tree blob or mode mismatch: {relative}")
        require(not set(TEMPORARY_PATHS).intersection(entries), "Temporary file in carrier tree")
        commit = run(["git", "commit-tree", tree, "-p", BASE, "-m",
                      "Transport two verified large JSON blobs for lab directory v4"],
                     env=git_env).decode().strip()
        parents = run(["git", "show", "-s", "--format=%P", commit], env=git_env).decode().strip()
        require(parents == BASE, "Ready commit must have the fixed baseline as its only parent")
        assert_ready_branch_absent()
        # A normal push creates the new ref. No force option, main update, or cleanup.
        run(["git", "push", "origin", f"{commit}:refs/heads/{READY_BRANCH}"], env=git_env, show=True)
        remote = run(["git", "ls-remote", "--heads", "origin", f"refs/heads/{READY_BRANCH}"])
        require(remote.decode().split() == [commit, f"refs/heads/{READY_BRANCH}"],
                "Remote ready branch does not match the verified commit")
    print(f"READY_COMMIT_SHA={commit}")
    print(f"READY_TREE_SHA={tree}")
    print("Data carrier created with two JSON changes; main and staging are unchanged.")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as output:
            output.write(f"## Verified lab v4 data carrier\n\nCarrier commit: `{commit}`\n\n")
            output.write(f"Tree: `{tree}`\n\n21 files verified; builder, data, and model tests passed.\n")
            output.write("\nThe carrier changes only the two large JSON files; it is not the final release.\n")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, OSError) as error:
        print(f"Release staging failed: {error}", file=sys.stderr)
        sys.exit(1)
