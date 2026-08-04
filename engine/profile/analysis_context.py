from __future__ import annotations

import json
from typing import Any

from engine.profile.import_profile import SourceDocument

PROMPT_VERSION = "profile-analysis-v1"


def empty_canonical_profile() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "review_status": "pending_human_review",
        "source_files": [],
        "identity": {
            "full_name": "",
            "headline": {"pt": "", "en": ""},
            "location": {"city": "", "state": "", "country": "", "timezone": ""},
            "contact": {},
        },
        "work_preferences": {
            "target_roles": [],
            "desired_work_models": [],
            "hybrid_locations": [],
            "target_markets": [],
            "accepted_employment_types": None,
            "work_authorization_by_region": None,
            "salary_expectations": [],
            "target_seniority": None,
            "availability": None,
        },
        "matching_facts": {},
        "languages": [],
        "skills_desired": [],
        "skills_known": {
            "desired_and_evidenced": [],
            "secondary_or_limited_evidence": [],
            "known_but_not_desired_for_matching": [],
        },
        "experience": [],
        "projects": [],
        "education": [],
        "narratives": {},
        "facts_pending_confirmation": [],
    }


def apply_declared_preferences(
    profile: dict[str, Any],
    preferences: dict[str, Any],
) -> dict[str, Any]:
    work_preferences = profile.setdefault("work_preferences", {})
    work_preferences["target_roles"] = list(preferences.get("targetRoles", []))
    market = preferences.get("markets")
    work_preferences["target_markets"] = {
        "brazil": ["brazil"],
        "international": ["international_remote"],
        "both": ["brazil", "international_remote"],
    }.get(market, [])
    work_preferences["professional_focus"] = preferences.get("focus")
    return profile


def build_profile_analysis_prompt(
    *,
    deterministic_draft: dict[str, Any],
    document: SourceDocument,
    preferences: dict[str, Any],
) -> str:
    return f"""Voce analisa curriculos para o 10xVagas. Produza um Perfil Canonico
bilíngue e um diagnostico profissional estruturado. Esta e uma ferramenta de decisao,
nao um gerador de elogios nem um score ATS generico.

REGRAS INEGOCIAVEIS
- Use somente fatos sustentados pelo documento ou pelo perfil ativo fornecido.
- Nao invente empresa, data, metrica, tecnologia, idioma, salario, senioridade,
  formacao ou autorizacao de trabalho.
- Marque inferencias como `kind=inference`, com confianca, e crie pergunta pendente.
- `skills_desired` e intencao declarada pelo usuario e nao pode ser alterada pela IA.
- Suporte tecnico, helpdesk, Office 365, AnyDesk, redes e manutencao sao historico
  valido, mas ficam em `known_but_not_desired_for_matching`, nunca em `skills_desired`.
- Narrativas PT/EN sao rascunhos e devem usar evidencias reais.
- Evidencia usa resumo curto do trecho; nao reproduza dados pessoais desnecessarios.
- O diagnostico deve apontar forcas, alegacoes fracas, metricas ausentes,
  contradicoes, riscos de ATS, clareza e recomendacoes priorizadas.
- Responda exclusivamente chamando a tool `respond` no schema fornecido.

VERSAO DO PROMPT: {PROMPT_VERSION}

PREFERENCIAS DECLARADAS:
{json.dumps(preferences, ensure_ascii=False)}

PERFIL BASE DETERMINISTICO:
{json.dumps(deterministic_draft, ensure_ascii=False)}

DOCUMENTO `{document.name}`:
{document.content}
"""
