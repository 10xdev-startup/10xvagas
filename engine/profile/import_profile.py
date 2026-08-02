from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence


ENGINE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_PROFILE = ENGINE_DIR / "experiment" / "data" / "canonical-profile.json"
DEFAULT_DRAFT = ENGINE_DIR / "experiment" / "data" / "canonical-profile.draft.json"
CODEX_SCHEMA = Path(__file__).with_name("codex-output.schema.json")

TEXT_EXTENSIONS = {
    ".csv",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".text",
    ".ts",
    ".tsx",
    ".txt",
}
MAX_DOCUMENT_CHARS = 120_000
MAX_CODEX_CONTEXT_CHARS = 240_000

SKILL_ALIASES: dict[str, tuple[str, ...]] = {
    "TypeScript": ("typescript",),
    "JavaScript": ("javascript",),
    "Node.js": ("node.js", "nodejs", "node js"),
    "Express": ("express", "express.js", "expressjs"),
    "Next.js": ("next.js", "nextjs", "next js"),
    "React": ("react", "react.js", "reactjs"),
    "Supabase": ("supabase",),
    "PostgreSQL": ("postgresql", "postgres", "postgre sql"),
    "Go": ("golang", "go"),
    "Python": ("python",),
    "FastAPI": ("fastapi", "fast api"),
    "Docker": ("docker",),
    "Azure": ("azure",),
    "n8n": ("n8n",),
    "Jest": ("jest",),
    "REST APIs": ("rest api", "rest apis", "api rest"),
    "OAuth": ("oauth", "oauth2"),
    "JWT": ("jwt",),
    "RBAC": ("rbac",),
    "Stripe": ("stripe",),
    "GitHub API": ("github api",),
    "webhooks": ("webhook", "webhooks"),
    "SSE": ("server-sent events", "sse"),
    "LLM integrations": ("llm", "llms", "multi-llm"),
    "RAG": ("retrieval augmented generation", "rag"),
    "pgvector": ("pgvector",),
    "GitHub Actions": ("github actions",),
    "Tailwind CSS": ("tailwind", "tailwind css"),
    "shadcn/ui": ("shadcn", "shadcn/ui"),
    "SQL": ("sql",),
    "Linux": ("linux", "linux/wsl", "wsl"),
    "Django": ("django",),
    "Vite": ("vite",),
    "Zod": ("zod",),
    "C#": ("c#", "c sharp"),
    "Unity": ("unity",),
}

# Estes termos representam experiencia real, mas nunca evidencia para o matching
# de desenvolvimento. A lista e deliberadamente independente de prompts/LLM.
SUPPORT_SKILL_ALIASES: dict[str, tuple[str, ...]] = {
    "technical support": ("technical support", "suporte tecnico", "suporte técnico"),
    "helpdesk": ("helpdesk", "help desk", "service desk"),
    "Office 365": ("office 365", "microsoft 365"),
    "hardware maintenance": ("hardware maintenance", "manutencao de hardware"),
    "workstation maintenance": ("workstation maintenance", "manutencao de estacoes"),
    "AnyDesk": ("anydesk",),
    "LogMeIn": ("logmein",),
    "TeamViewer": ("teamviewer",),
    "network configuration": (
        "network configuration",
        "network configurations",
        "configuracao de rede",
        "configuracao de redes",
        "redes",
    ),
    "VPN configuration": ("vpn configuration", "configuracao de vpn", "vpn"),
    "antivirus administration": ("antivirus administration", "antivirus"),
    "ticket management": ("ticket management", "gestao de chamados"),
    "Power BI": ("power bi", "powerbi"),
    "Microsoft Copilot": ("microsoft copilot", "copilot"),
}


class ProfileImportError(RuntimeError):
    """Erro acionavel durante a importacao local."""


@dataclass(frozen=True)
class SourceDocument:
    name: str
    content: str
    sha256: str
    truncated: bool = False


def _normalize(value: str) -> str:
    value = "".join(
        character
        for character in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(character)
    )
    return " ".join(value.casefold().split())


def _mentions(text: str, aliases: Iterable[str]) -> bool:
    normalized_text = _normalize(text)
    return any(
        re.search(rf"(?<![\w]){re.escape(_normalize(alias))}(?![\w])", normalized_text)
        for alias in aliases
    )


def _unique(values: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        key = _normalize(value)
        if value and key not in seen:
            result.append(value)
            seen.add(key)
    return result


def _read_pdf(path: Path) -> str:
    executable = shutil.which("pdftotext")
    if not executable:
        raise ProfileImportError(
            f"Nao foi possivel ler {path}: 'pdftotext' nao esta instalado. "
            "Instale o pacote poppler-utils ou exporte o CV como .txt e use "
            "--input caminho/cv.txt (ou passe texto com --text)."
        )
    process = subprocess.run(
        [executable, "-layout", str(path), "-"],
        capture_output=True,
        check=False,
        text=True,
    )
    if process.returncode != 0:
        detail = process.stderr.strip() or "erro desconhecido do pdftotext"
        raise ProfileImportError(f"Falha ao extrair texto de {path}: {detail}")
    if not process.stdout.strip():
        raise ProfileImportError(
            f"O PDF {path} nao possui texto extraivel. Exporte-o como .txt ou use --text."
        )
    return process.stdout


def read_document(path: Path) -> SourceDocument:
    if not path.exists():
        raise ProfileImportError(f"Fonte nao encontrada: {path}")
    if not path.is_file():
        raise ProfileImportError(f"A fonte nao e um arquivo: {path}")
    suffix = path.suffix.casefold()
    if suffix == ".pdf":
        content = _read_pdf(path)
    elif suffix in TEXT_EXTENSIONS:
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            raise ProfileImportError(
                f"{path} nao esta em UTF-8. Converta o arquivo ou use --text."
            ) from error
    else:
        supported = ", ".join(sorted([*TEXT_EXTENSIONS, ".pdf"]))
        raise ProfileImportError(f"Formato nao suportado em {path}. Formatos: {supported}")

    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
    truncated = len(content) > MAX_DOCUMENT_CHARS
    return SourceDocument(
        name=str(path.resolve()),
        content=content[:MAX_DOCUMENT_CHARS],
        sha256=digest,
        truncated=truncated,
    )


def collect_documents(paths: Sequence[Path], inline_texts: Sequence[str]) -> list[SourceDocument]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(
                candidate
                for candidate in sorted(path.rglob("*"))
                if candidate.is_file()
                and (candidate.suffix.casefold() in TEXT_EXTENSIONS or candidate.suffix.casefold() == ".pdf")
            )
        else:
            files.append(path)

    documents = [read_document(path) for path in files]
    for index, content in enumerate(inline_texts, start=1):
        if not content.strip():
            continue
        documents.append(
            SourceDocument(
                name=f"<inline-text-{index}>",
                content=content[:MAX_DOCUMENT_CHARS],
                sha256=hashlib.sha256(content.encode("utf-8")).hexdigest(),
                truncated=len(content) > MAX_DOCUMENT_CHARS,
            )
        )
    if not documents:
        raise ProfileImportError("Informe ao menos uma fonte com --input ou --text.")
    return documents


def _load_profile(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ProfileImportError(f"Perfil base nao encontrado: {path}") from error
    except json.JSONDecodeError as error:
        raise ProfileImportError(f"Perfil base possui JSON invalido: {path}: {error}") from error
    if not isinstance(value, dict):
        raise ProfileImportError("O Perfil Canonico base deve ser um objeto JSON.")
    return value


def _extract_contact(text: str) -> dict[str, str]:
    contact: dict[str, str] = {}
    email = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text)
    phone = re.search(r"(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2}\)?[ .-]?)?\d{4,5}[ .-]?\d{4}", text)
    linkedin = re.search(r"https?://(?:www\.)?linkedin\.com/in/[\w%-]+/?", text, re.IGNORECASE)
    if email:
        contact["email"] = email.group(0)
    if phone:
        contact["phone"] = phone.group(0).strip()
    if linkedin:
        contact["linkedin"] = linkedin.group(0)
    return contact


def _parse_desired_skill(value: str) -> tuple[str, int]:
    name, separator, raw_priority = value.rpartition(":")
    if not separator:
        name, raw_priority = value, "2"
    name = name.strip()
    try:
        priority = int(raw_priority)
    except ValueError as error:
        raise ProfileImportError(
            f"Prioridade invalida em '{value}'. Use Nome ou Nome:1, Nome:2, Nome:3."
        ) from error
    if not name or priority not in {1, 2, 3}:
        raise ProfileImportError(
            f"Skill desejada invalida em '{value}'. A prioridade deve estar entre 1 e 3."
        )
    if _mentions(name, (name,)) and any(
        _normalize(name) == _normalize(alias)
        for aliases in SUPPORT_SKILL_ALIASES.values()
        for alias in aliases
    ):
        raise ProfileImportError(f"'{name}' e uma skill de suporte e nao pode guiar o matching.")
    return name, priority


def _apply_desired_overrides(profile: dict[str, Any], values: Sequence[str]) -> None:
    desired = {
        _normalize(item["name"]): copy.deepcopy(item)
        for item in profile.get("skills_desired", [])
        if isinstance(item, dict) and item.get("name")
    }
    for value in values:
        name, priority = _parse_desired_skill(value)
        desired[_normalize(name)] = {"name": name, "priority": priority}
    profile["skills_desired"] = list(desired.values())


def _sanitize_skill_groups(profile: dict[str, Any], discovered: Iterable[str]) -> None:
    groups = profile.setdefault("skills_known", {})
    support_names = {_normalize(name): name for name in SUPPORT_SKILL_ALIASES}
    excluded = list(groups.get("known_but_not_desired_for_matching", []))
    evidenced = list(groups.get("desired_and_evidenced", []))
    secondary = list(groups.get("secondary_or_limited_evidence", []))

    safe_evidenced: list[str] = []
    for skill in [*evidenced, *discovered]:
        normalized = _normalize(skill)
        if normalized in support_names:
            excluded.append(support_names[normalized])
        else:
            safe_evidenced.append(skill)

    safe_secondary: list[str] = []
    for skill in secondary:
        normalized = _normalize(skill)
        if normalized in support_names:
            excluded.append(support_names[normalized])
        else:
            safe_secondary.append(skill)

    # Evidencia nova vai para a lista principal; isso comprova capacidade, mas
    # nao altera skills_desired nem, portanto, a intencao usada pelo matching.
    groups["desired_and_evidenced"] = _unique(safe_evidenced)
    groups["secondary_or_limited_evidence"] = _unique(safe_secondary)
    groups["known_but_not_desired_for_matching"] = _unique(excluded)


def _detected_skills(text: str) -> tuple[list[str], list[str]]:
    known = [name for name, aliases in SKILL_ALIASES.items() if _mentions(text, aliases)]
    support = [
        name for name, aliases in SUPPORT_SKILL_ALIASES.items() if _mentions(text, aliases)
    ]
    return known, support


def _deep_merge(base: dict[str, Any], update: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(base)
    for key, value in update.items():
        if isinstance(result.get(key), dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        elif value not in (None, "", [], {}):
            result[key] = copy.deepcopy(value)
    return result


def build_deterministic_draft(
    base_profile: dict[str, Any],
    documents: Sequence[SourceDocument],
    desired_skill_overrides: Sequence[str] = (),
) -> dict[str, Any]:
    draft = copy.deepcopy(base_profile)
    original_desired = copy.deepcopy(draft.get("skills_desired", []))
    combined_text = "\n\n".join(document.content for document in documents)
    known, support = _detected_skills(combined_text)

    contact = draft.setdefault("identity", {}).setdefault("contact", {})
    for key, value in _extract_contact(combined_text).items():
        if not contact.get(key):
            contact[key] = value

    draft["skills_desired"] = original_desired
    _apply_desired_overrides(draft, desired_skill_overrides)
    _sanitize_skill_groups(draft, [*known, *support])

    draft["source_files"] = _unique(
        [*draft.get("source_files", []), *(document.name for document in documents)]
    )
    now = datetime.now(timezone.utc)
    draft["generated_at"] = now.date().isoformat()
    draft["review_status"] = "pending_human_review"
    draft["import_metadata"] = {
        "generator": "engine.profile.import_profile",
        "generated_at": now.isoformat(),
        "mode": "deterministic",
        "sources": [
            {
                "name": document.name,
                "sha256": document.sha256,
                "truncated": document.truncated,
            }
            for document in documents
        ],
        "skills_detected": known,
        "support_experience_detected_and_excluded": support,
        "warnings": [
            f"A fonte {document.name} foi truncada para {MAX_DOCUMENT_CHARS} caracteres."
            for document in documents
            if document.truncated
        ],
    }
    return draft


def _codex_prompt(profile: dict[str, Any], documents: Sequence[SourceDocument]) -> str:
    source_context = "\n\n".join(
        f"### FONTE: {document.name}\n{document.content}" for document in documents
    )[:MAX_CODEX_CONTEXT_CHARS]
    return f"""Voce e um extrator de curriculo, executado localmente e offline do runtime web.
Atualize o Perfil Canonico bilíngue abaixo somente com fatos sustentados pelas fontes.
Nao invente datas, metricas, idiomas, autorizacao, salario ou senioridade.
Mantenha campos sem evidencia como pendentes. Narrativas novas devem ficar como rascunho.
Experiencia de suporte/helpdesk e valida como historico, mas deve ficar apenas em
skills_known.known_but_not_desired_for_matching e nunca em skills_desired.
Preserve a separacao entre stack conhecida e stack que a pessoa quer usar.

Responda no schema solicitado. canonical_profile_json deve ser uma string contendo
o objeto JSON completo atualizado. skills_evidenced lista skills tecnicas comprovadas;
support_skills_evidenced lista exclusivamente suporte/helpdesk; warnings explica ambiguidades.

PERFIL BASE:
{json.dumps(profile, ensure_ascii=False)}

FONTES:
{source_context}
"""


def enrich_with_codex(
    deterministic_draft: dict[str, Any],
    documents: Sequence[SourceDocument],
    codex_binary: str = "codex",
) -> dict[str, Any]:
    executable = shutil.which(codex_binary)
    if not executable:
        raise ProfileImportError(
            f"Codex CLI nao encontrado ('{codex_binary}'). Instale/autentique o CLI ou execute sem --use-codex."
        )
    with tempfile.TemporaryDirectory(prefix="10xvagas-profile-") as temporary_dir:
        output_path = Path(temporary_dir) / "codex-output.json"
        command = [
            executable,
            "exec",
            "--ephemeral",
            "--sandbox",
            "read-only",
            "--skip-git-repo-check",
            "--color",
            "never",
            "--output-schema",
            str(CODEX_SCHEMA),
            "--output-last-message",
            str(output_path),
            "-",
        ]
        process = subprocess.run(
            command,
            input=_codex_prompt(deterministic_draft, documents),
            capture_output=True,
            check=False,
            text=True,
        )
        if process.returncode != 0:
            detail = process.stderr.strip() or process.stdout.strip() or "erro desconhecido"
            raise ProfileImportError(f"Codex CLI falhou: {detail}")
        try:
            response = json.loads(output_path.read_text(encoding="utf-8"))
            proposed_profile = json.loads(response["canonical_profile_json"])
        except (FileNotFoundError, KeyError, json.JSONDecodeError, TypeError) as error:
            raise ProfileImportError("Codex CLI retornou um Perfil Canonico invalido.") from error
        if not isinstance(proposed_profile, dict):
            raise ProfileImportError("Codex CLI retornou um Perfil Canonico que nao e objeto.")

    return merge_codex_response(deterministic_draft, proposed_profile, response)


def merge_codex_response(
    deterministic_draft: dict[str, Any],
    proposed_profile: dict[str, Any],
    response: dict[str, Any],
) -> dict[str, Any]:
    """Aplica a proposta do CLI sem delegar a ele a intencao de matching."""

    # O Codex pode melhorar fatos/narrativas, mas a intencao de busca permanece
    # sob controle deterministico e explicito do usuario.
    desired_skills = copy.deepcopy(deterministic_draft.get("skills_desired", []))
    result = _deep_merge(deterministic_draft, proposed_profile)
    result["skills_desired"] = desired_skills

    proposed_known: list[str] = []
    proposed_groups = proposed_profile.get("skills_known", {})
    if isinstance(proposed_groups, dict):
        for value in proposed_groups.values():
            if isinstance(value, list):
                proposed_known.extend(str(skill) for skill in value)
    proposed_known.extend(str(skill) for skill in response.get("skills_evidenced", []))
    proposed_known.extend(str(skill) for skill in response.get("support_skills_evidenced", []))
    _sanitize_skill_groups(result, proposed_known)

    metadata = copy.deepcopy(deterministic_draft["import_metadata"])
    metadata["mode"] = "codex_cli"
    metadata["codex_cli"] = {
        "runtime_integration": False,
        "sandbox": "read-only",
        "ephemeral": True,
    }
    metadata["warnings"] = _unique(
        [*metadata.get("warnings", []), *(str(item) for item in response.get("warnings", []))]
    )
    result["import_metadata"] = metadata
    result["source_files"] = deterministic_draft["source_files"]
    result["review_status"] = "pending_human_review"
    return result


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(f"{path.suffix}.tmp")
    temporary_path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(path)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Gera um rascunho auditavel do Perfil Canonico a partir de CV/portfolio.",
    )
    parser.add_argument(
        "--input",
        action="append",
        default=[],
        type=Path,
        help="Arquivo PDF/texto ou diretorio do portfolio. Pode ser repetido.",
    )
    parser.add_argument(
        "--text",
        action="append",
        default=[],
        help="Texto literal adicional. Pode ser repetido.",
    )
    parser.add_argument("--profile", type=Path, default=DEFAULT_PROFILE, help="Perfil base.")
    parser.add_argument("--output", type=Path, default=DEFAULT_DRAFT, help="Arquivo do rascunho.")
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Atualiza --profile em vez de criar canonical-profile.draft.json.",
    )
    parser.add_argument(
        "--desired-skill",
        action="append",
        default=[],
        metavar="NOME[:1-3]",
        help="Altera explicitamente a stack desejada usada no matching.",
    )
    parser.add_argument(
        "--use-codex",
        action="store_true",
        help="Enriquece o rascunho pelo Codex CLI local, em sandbox read-only e sessao efemera.",
    )
    parser.add_argument("--codex-bin", default="codex", help=argparse.SUPPRESS)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Imprime o rascunho sem escrever arquivo.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        documents = collect_documents(args.input, args.text)
        profile = _load_profile(args.profile)
        draft = build_deterministic_draft(profile, documents, args.desired_skill)
        if args.use_codex:
            draft = enrich_with_codex(draft, documents, args.codex_bin)
        output_path = args.profile if args.in_place else args.output
        if args.dry_run:
            print(json.dumps(draft, ensure_ascii=False, indent=2))
        else:
            _write_json(output_path, draft)
            print(
                json.dumps(
                    {
                        "success": True,
                        "output": str(output_path.resolve()),
                        "review_status": draft["review_status"],
                        "mode": draft["import_metadata"]["mode"],
                        "sources": len(documents),
                    },
                    ensure_ascii=False,
                )
            )
        return 0
    except ProfileImportError as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
