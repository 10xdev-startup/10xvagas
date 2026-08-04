FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update \
  && apt-get install --yes --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 1001 engineuser

COPY --chown=engineuser:engineuser engine ./engine
COPY --chown=engineuser:engineuser shared ./shared

USER engineuser
EXPOSE 8000

CMD ["python3", "-m", "engine.profile.analysis_worker"]
