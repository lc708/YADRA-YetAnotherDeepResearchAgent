FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Install system dependencies for production
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd -r yadra && useradd -r -g yadra yadra

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Pre-cache the application dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project

# Copy the application into the container
COPY . /app

# Install the application dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked

# Change ownership to non-root user
RUN chown -R yadra:yadra /app

# Switch to non-root user
USER yadra

# Expose port (Zeabur default)
EXPOSE 8080

# Health check - use environment variable PORT with fallback
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Run the application - let server.py read PORT from environment
CMD ["uv", "run", "python", "server.py", "--host", "0.0.0.0"]
