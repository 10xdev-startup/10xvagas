from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path


@dataclass(frozen=True)
class LlmModel:
    id: str
    provider: str
    label: str
    api_model: str
    selectable: bool


CATALOG_PATH = Path(__file__).resolve().parents[2] / "shared" / "ai-model-catalog.json"


def _load_catalog() -> tuple[tuple[LlmModel, ...], str]:
    document = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    raw_models = document.get("models")
    default_id = document.get("defaultProfileAnalysisModelId")
    if not isinstance(raw_models, list) or not raw_models or not isinstance(default_id, str):
        raise RuntimeError("AI_MODEL_CATALOG_INVALID")
    models = tuple(
        LlmModel(
            id=item["id"],
            provider=item["provider"],
            label=item["label"],
            api_model=item["apiModel"],
            selectable=item["selectable"],
        )
        for item in raw_models
    )
    if len({model.id for model in models}) != len(models):
        raise RuntimeError("AI_MODEL_CATALOG_INVALID")
    return models, default_id


MODELS, DEFAULT_PROFILE_ANALYSIS_MODEL_ID = _load_catalog()


def get_model(model_id: str) -> LlmModel | None:
    return next((model for model in MODELS if model.id == model_id), None)


def get_selectable_model(model_id: str) -> LlmModel | None:
    model = get_model(model_id)
    return model if model and model.selectable else None
