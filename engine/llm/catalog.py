from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LlmModel:
    id: str
    provider: str
    label: str
    api_model: str
    selectable: bool


MODELS = (
    LlmModel(
        id="gpt-5.6-terra",
        provider="openai",
        label="GPT-5.6 Terra",
        api_model="openai/gpt-5.6-terra",
        selectable=True,
    ),
)

DEFAULT_PROFILE_ANALYSIS_MODEL_ID = "gpt-5.6-terra"


def get_model(model_id: str) -> LlmModel | None:
    return next((model for model in MODELS if model.id == model_id), None)


def get_selectable_model(model_id: str) -> LlmModel | None:
    model = get_model(model_id)
    return model if model and model.selectable else None
