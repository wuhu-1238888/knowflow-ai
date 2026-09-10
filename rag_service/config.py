"""KnowFlow AI RAG 服务路径与常量配置。

规则:
- runtime/ 与 .env 一样不入库(见 .gitignore);
- 路径通过环境变量可覆盖(测试夹具用 KNOWFLOW_RUNTIME_DIR 指向临时目录);
- 函数式读取而非模块级常量,保证测试与多进程下环境变量生效。
"""

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# 加载 .env(存在时;不覆盖已设环境变量)。Key 只由人写入 .env,AI 绝不写 Key;
# 本模块被 main / gen_eval / 测试共同导入,load 必须在工厂读取环境变量之前。
load_dotenv(PROJECT_ROOT / ".env")

DEFAULT_RUNTIME_DIR = PROJECT_ROOT / "runtime"

# 演示数据与评测夹具(仓库资产,固定路径)
DEMO_DOCS_DIR = PROJECT_ROOT / "docs" / "demo-data" / "documents"
CASES_PATH = PROJECT_ROOT / "docs" / "demo-data" / "evaluation" / "cases.yaml"


def get_runtime_dir() -> Path:
    return Path(os.environ.get("KNOWFLOW_RUNTIME_DIR", DEFAULT_RUNTIME_DIR))


def get_db_path() -> Path:
    return get_runtime_dir() / "knowflow.db"


def get_lancedb_dir() -> Path:
    return get_runtime_dir() / "lancedb"


def get_models_dir() -> Path:
    """本地模型目录(bge-m3/bge-reranker-v2-m3 首次运行下载至此)。"""
    return get_runtime_dir() / "models"


def get_uploads_dir() -> Path:
    """用户上传的源文件保存目录(重建索引时重新读取);runtime/ 不入库。"""
    return get_runtime_dir() / "uploads"


def ensure_runtime_dirs() -> None:
    get_runtime_dir().mkdir(parents=True, exist_ok=True)
    get_lancedb_dir().mkdir(parents=True, exist_ok=True)
    get_models_dir().mkdir(parents=True, exist_ok=True)
    get_uploads_dir().mkdir(parents=True, exist_ok=True)


# 文档状态机(Stage 08 技术设计三态;UI 四态在 3.3.3 前端映射:
# parsing → 解析中,indexed → 已索引,failed → 解析失败;「待索引」= 上传瞬间的 UI 兜底态)
DOC_STATUS = ("parsing", "indexed", "failed")

# 评测期望行为(与 cases.yaml 对齐)
EXPECTED_BEHAVIORS = ("answer", "refuse", "conflict")
