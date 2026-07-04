FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libegl1 libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

COPY src/ src/
COPY web_sota/backend/ web_sota/backend/

EXPOSE 11046

CMD ["uv", "run", "python", "-m", "web_sota.backend.server"]
