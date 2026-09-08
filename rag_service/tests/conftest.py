"""pytest 公共夹具:临时 runtime 目录(env 覆盖)+ 已初始化 Repository。"""

import sys
from pathlib import Path

import pytest

# 仓库根加入 sys.path,保证 `python -m pytest rag_service/tests` 可导入 rag_service
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture()
def tmp_env(tmp_path, monkeypatch):
    """runtime 指向临时目录:测试绝不触碰真实 runtime/。"""
    runtime = tmp_path / "runtime"
    monkeypatch.setenv("KNOWFLOW_RUNTIME_DIR", str(runtime))
    return runtime


@pytest.fixture()
def repo(tmp_env):
    """已 init_db 的 Repository(空库)。"""
    from rag_service.db import init_db
    from rag_service.repository import Repository

    db_path = init_db()
    return Repository(db_path)
