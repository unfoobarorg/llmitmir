# LLMitMir-Werkbank – Sandbox: die Umgebung, in der die Modelle Befehle ausführen.
# Eine Kopie davon läuft je Chat/Aufgabe als eigener, abgeschotteter Container.
FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      bash ca-certificates curl wget git jq unzip zip file less tini procps \
      ffmpeg poppler-utils qpdf ghostscript tesseract-ocr tesseract-ocr-deu tesseract-ocr-eng \
      imagemagick libheif-examples sqlite3 nodejs npm fonts-dejavu-core locales tzdata \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
      requests httpx beautifulsoup4 lxml html5lib \
      pandas numpy openpyxl xlsxwriter matplotlib \
      pypdf pdfplumber pypdfium2 reportlab python-docx python-pptx markdown \
      pillow pillow-heif extract-msg icalendar recurring-ical-events python-dateutil caldav vobject \
      faster-whisper websocket-client pyyaml tabulate

RUN useradd -m -u 1000 -s /bin/bash agent \
 && mkdir -p /workspace /cache/pip /cache/hf && chown -R 1000:1000 /workspace /cache
USER agent
WORKDIR /workspace
ENV HOME=/workspace/.home PIP_CACHE_DIR=/cache/pip HF_HOME=/cache/hf PATH=/workspace/.home/.local/bin:$PATH
CMD ["sleep", "infinity"]
