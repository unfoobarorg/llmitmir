# LLMitMir-Werkbank – der Dienst (startet Sandbox-Container über den Docker-Socket)
FROM python:3.13-slim
RUN pip install --no-cache-dir "aiohttp>=3.10,<4"
WORKDIR /app
COPY server.py .
EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s CMD python -c "import urllib.request,os; r=urllib.request.Request('http://127.0.0.1:8787/v1/health', headers={'Authorization':'Bearer '+os.environ['WERKBANK_TOKEN']}); urllib.request.urlopen(r)" || exit 1
CMD ["python", "-u", "server.py"]
