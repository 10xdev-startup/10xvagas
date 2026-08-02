from __future__ import annotations

import json
from typing import Any
from urllib.request import Request, urlopen


def fetch_json(url: str) -> Any:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "10xVagas/0.1 (+local job discovery experiment)",
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))
