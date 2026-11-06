"""Constants for LLMitMir."""
from __future__ import annotations

DOMAIN = "llmitmir"
VERSION = "0.4.0"

PANEL_URL = "llmitmir"
PANEL_TITLE = "LLMitMir"
PANEL_ICON = "mdi:robot-outline"
STATIC_URL = "/llmitmir_static"
PANEL_ELEMENT = "llmitmir-panel"

STORAGE_VERSION = 1
CONFIG_STORE_KEY = "llmitmir.config"

# Key modes chosen by the admin
KEY_SHARED = "shared"            # one central key for everybody
KEY_PER_USER_ADMIN = "per_user_admin"  # admin enters one key per user
KEY_PER_USER_OWN = "per_user_own"      # every user enters an own key
KEY_MODES = (KEY_SHARED, KEY_PER_USER_ADMIN, KEY_PER_USER_OWN)

# Key for scheduled tasks, chosen by the admin
TASK_KEY_SAME = "same"      # tasks use the normal key
TASK_KEY_SHARED = "shared"  # one central task key for all tasks of everybody
TASK_KEY_USER = "user"      # every user chooses (same / own task key / central task key)
TASK_KEY_MODES = (TASK_KEY_SAME, TASK_KEY_SHARED, TASK_KEY_USER)
TASK_KEY_CHOICES = ("same", "own", "shared")  # per-user choice in TASK_KEY_USER mode
TASK_USAGE_DAYS = 60

# Presets for OpenAI-compatible providers
PRESETS = {
    "saia": {
        "name": "SAIA (GWDG / KISSKI)",
        "base_url": "https://chat-ai.academiccloud.de/v1",
        "transcription_model": "whisper-large-v3",
        "defaults": {
            "chat": "glm-5.3",
            "agent": "deepseek-v4.1-flash-1017",
            "vision": "qwen3.5-397b-a17b",
            "title": "deepseek-v4.1-flash-1017",
        },
        "hint": "Open-weight models on GWDG hardware. Limits: 10 requests/10 s, 800/hour, 800/day per key.",
    },
    "openai_compatible": {
        "name": "OpenAI-compatible (custom)",
        "base_url": "",
        "transcription_model": "whisper-1",
        "defaults": {},
        "hint": "",
    },
}

DEFAULT_CONTEXT = 128_000
# Context windows of known models (tokens); admins can override per model.
KNOWN_CONTEXT = {
    "deepseek-v4-flash-0731": 128_000,
    "deepseek-v4.1-flash-1017": 128_000,
    "glm-5.3": 200_000,
    "glm-5.3-flash": 128_000,
    "qwen3.5-397b-a17b": 256_000,
    "qwen3.6-35b-a3b": 256_000,
    "qwen3.8-27b": 256_000,
    "qwen3-coder-next": 256_000,
    "qwen3-30b-a3b-instruct-2507": 128_000,
    "qwen3-omni-30b-a3b-instruct": 64_000,
    "gemma-4-31b-it": 128_000,
    "meta-llama-3.1-8b-instruct": 128_000,
    "eurollm-22b-instruct-2512": 32_000,
    "mistral-large-4-1t-a52b": 256_000,
}

# Agent limits
MAX_STEPS_CHAT = 15
MAX_STEPS_COWORK = 60
PROGRESS_NUDGE_STEPS = 4  # remind the model when the visible step list has not moved for this many steps
WRAPUP_STEPS = 4  # from this many steps before the limit the model is told to wrap up; the last step has no tools
TOOL_RESULT_MAX_CHARS = 24_000

# Model choice
AUTO = "auto"                  # default model "automatic": best fit for the role right now (see models.py)
MODEL_POLL_SECONDS = 180       # reload /models (status, demand, new releases); SAIA does not count this call
SLOW_AFTER_INTERACTIVE = 20    # no output yet after this long in a chat/cowork: recommend a less loaded model
SLOW_AFTER_TASK = 180          # … in a scheduled task with an automatic model: switch to the alternative by itself
SLOW_MEMORY = 600              # a model that hung counts as overloaded for this long (unless it answers quickly again)
FAST_FIRST_TOKEN = 10          # first output within this many seconds clears that mark
NEW_MODEL_DAYS = 14            # models first seen within this many days are marked "neu"

# Retry policies (seconds)
RETRY_INTERACTIVE_MAX_WAIT = 240
RETRY_TASK_MAX_WAIT = 6 * 3600

# Event names sent to subscribed frontends
EVT = "llmitmir_event"

KIND_CHAT = "chat"
KIND_COWORK = "cowork"
KIND_TASK_RUN = "task_run"

PERM_ALLOW = "allow"
PERM_ASK = "ask"
PERM_DENY = "deny"
