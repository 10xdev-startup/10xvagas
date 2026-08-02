from __future__ import annotations

from html import unescape
from html.parser import HTMLParser


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        value = data.strip()
        if value:
            self.parts.append(value)


def coerce_text(value: object, fallback: str = "") -> str:
    """Normaliza campo de API externa para str.

    `dict.get(chave, padrao)` so aplica o padrao quando a chave esta ausente —
    um `null` explicito no JSON passa como None e quebra o consumidor. Fontes
    reais mandam `null` em location, jobUrl e afins, entao todo campo textual
    vindo de adapter passa por aqui.
    """
    if value is None:
        return fallback
    if isinstance(value, str):
        return value or fallback
    return str(value)


def html_to_text(value: str | None) -> str:
    if not value:
        return ""
    parser = _TextExtractor()
    parser.feed(unescape(value))
    return "\n".join(parser.parts)
