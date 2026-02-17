"""
Shared helper for test-scripts: create and use an alternate markdownlint config.

The config file is created in the repo's tmp/ dir (so markdownlint-cli2 resolves
custom rule paths correctly) and removed when the context exits.
"""

from __future__ import annotations

import json
import subprocess  # nosec B404
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Iterator, Union

import yaml

from verify_markdownlint_fixtures import find_markdownlint_cmd


def _repo_root() -> Path:
    """Repository root (parent of test-scripts)."""
    return Path(__file__).resolve().parents[1]


def _load_base_config() -> Dict[str, Any]:
    """Load the repo's .markdownlint.yml as the base config."""
    path = _repo_root() / ".markdownlint.yml"
    if not path.exists():
        return {"default": True}
    text = path.read_text(encoding="utf-8")
    data = yaml.safe_load(text)
    return data if isinstance(data, dict) else {"default": True}


def _merge_overrides(base: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    """Merge overrides into base (top-level keys replaced, not deep-merged)."""
    result = dict(base)
    for key, value in overrides.items():
        result[key] = value
    return result


def _load_cli2_options() -> Dict[str, Any]:
    """Load repo's .markdownlint-cli2.jsonc for customRules and ignores."""
    path = _repo_root() / ".markdownlint-cli2.jsonc"
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    return json.loads(text) if text.strip() else {}


def _repo_tmp_dir() -> Path:
    """Repo tmp/ dir; used so cwd=tmp avoids CLI merging with repo root config."""
    p = _repo_root() / "tmp"
    p.mkdir(exist_ok=True)
    return p


@contextmanager
def temp_markdownlint_config(overrides: Dict[str, Any] | None = None) -> Iterator[Path]:
    """
    Create a temporary markdownlint-cli2 config with optional rule overrides and yield its path.

    The file is created in the repo's tmp/ dir so that when run with cwd=tmp, the CLI
    uses only this config (no merge with repo root's .markdownlint-cli2.jsonc).
    Uses absolute paths for custom rules.

    Args:
        overrides: Optional dict of rule names to config (e.g. no-heading-like-lines:
                  {"convertToHeading": True}). Merged on top of the repo's .markdownlint.yml.

    Yields:
        Path to the temporary config file.
    """
    root = _repo_root().resolve()
    # When overrides set default: False, use minimal base so only the overridden rule runs.
    overrides_dict = overrides or {}
    if overrides_dict.get("default") is False:
        base = {"default": False}
    else:
        base = _load_base_config()
    config = _merge_overrides(base, overrides_dict)
    cli2 = _load_cli2_options()
    custom_rules_raw = cli2.get("customRules") or []
    abs_rules = [str((root / p).resolve()) for p in custom_rules_raw]
    ignores = cli2.get("ignores") or []
    # Omit tmp/** so test files in repo tmp/ are linted when cwd=tmp.
    ignores = [i for i in ignores if i != "tmp/**"]
    options = {"config": config, "customRules": abs_rules, "ignores": ignores}
    config_dir = _repo_tmp_dir()
    config_path = config_dir / ".markdownlint-cli2.jsonc"
    config_path.write_text(json.dumps(options, indent=2), encoding="utf-8")
    try:
        yield config_path
    finally:
        if config_path.exists():
            try:
                config_path.unlink()
            except OSError:
                pass


def run_markdownlint_with_config(
    config_overrides: Dict[str, Any],
    paths: Union[Path, str, List[Union[Path, str]]],
    fix: bool = False,
) -> subprocess.CompletedProcess:
    """
    Run markdownlint-cli2 with a temp config (base + config_overrides), then clean up.

    Config is written to repo tmp/ and run with cwd=repo/tmp so the CLI does not merge
    with repo root config (which would overwrite customRules). Paths under repo/tmp
    (e.g. "tmp/foo.md" or Path(repo/tmp/foo.md)) are passed as "foo.md"; other paths
    are passed as-is (e.g. absolute).

    Returns the CompletedProcess; caller checks returncode and stdout/stderr.
    """
    if isinstance(paths, (Path, str)):
        paths = [paths]
    tmp_dir = _repo_tmp_dir()

    def _path_arg(p: Union[Path, str]) -> str:
        s = str(p)
        if s.startswith("tmp/"):
            return s[4:]  # tmp/foo.md -> foo.md
        try:
            pp = Path(p).resolve()
            if tmp_dir.resolve() in pp.parents or pp.parent == tmp_dir.resolve():
                return pp.name
        except (OSError, ValueError):
            pass
        return s

    path_strs = [_path_arg(p) for p in paths]
    cmd = find_markdownlint_cmd()
    with temp_markdownlint_config(config_overrides) as config_path:
        run_cmd = [*cmd, "--config", config_path.name]
        if fix:
            run_cmd.append("--fix")
        run_cmd.extend(path_strs)
        return subprocess.run(
            run_cmd,
            cwd=str(tmp_dir),
            text=True,
            capture_output=True,
            check=False,
        )  # nosec B603
