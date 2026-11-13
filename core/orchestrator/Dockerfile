FROM python:3.12-slim
WORKDIR /app
COPY core/orchestrator/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY core/orchestrator/app /app/core/orchestrator/app
COPY core/db/migrations /app/core/db/migrations
COPY packs /app/packs
ENV PYTHONPATH=/app
EXPOSE 8000
CMD ["uvicorn","core.orchestrator.app.main:app","--host","0.0.0.0","--port","8000"]
