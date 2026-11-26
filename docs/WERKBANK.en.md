# Setting up the workbench

The **workbench** is an optional add-on for LLMitMir: a small computer (usually a virtual machine) on which the models may
**run programs** – isolated from Home Assistant. LLMitMir also works without a workbench.

This is the English version of [WERKBANK.md](WERKBANK.md); the panel shows it when the interface is set to English.

## What does the workbench add?

| | Without workbench | With workbench |
|---|---|---|
| Chats, coworks, scheduled tasks | ✓ | ✓ |
| Searching the web, fetching pages | ✓ | ✓ |
| Reading and controlling Home Assistant | ✓ | ✓ |
| Nextcloud files, calendars, contacts | ✓ | ✓ |
| Reading PDFs, scans and photos (vision model) | ✓ | ✓ |
| **Running Python scripts and commands** (e.g. scripts from skills) | – | ✓ |
| **Calculating and analysing** with pandas, creating tables and charts | – | ✓ |
| Creating or reworking **Excel, Word, PowerPoint, PDF** | – | ✓ |
| **Transcribing voice messages** (Whisper), converting audio/video (ffmpeg) | – | ✓ |
| **Text recognition** (Tesseract) in addition to the vision model | – | ✓ |
| Any command-line tools (curl, git, jq, sqlite …) | – | ✓ |

Every chat and every task gets its **own sandbox** (an isolated container) with its own working folder on the workbench.
Attachments and skill files are copied into it; the model brings results back into the chat. The workbench cleans up unused
sandboxes after two hours. Like other write actions, commands only run with your approval.

## What you need

- **A computer or VM** that runs permanently, with **Debian 12/13** or **Ubuntu 22.04/24.04** (64 bit, x86 or ARM).
  The easiest option is a new VM on the same server as Home Assistant (e.g. Proxmox). A Raspberry Pi 5 with 8 GB also works but is slower.
- **Resources:**

  | | Minimum | Recommended |
  |---|---|---|
  | CPU | 2 cores | 4 cores |
  | Memory | 4 GB | 8 GB (Whisper needs ~3 GB while transcribing) |
  | Disk | 25 GB | 50 GB (programs ~8 GB, speech models, working folders) |

- **Network:** Home Assistant must reach the workbench (port **8787**), and the workbench needs internet access
  (for web pages, Python packages and downloading the speech model). Give it a **fixed IP address** in your router.
- **Not needed:** exposure to the internet, port forwarding, your own domain. The workbench stays in your home network.

## Setup in 4 steps

### 1. Create the VM

Example Proxmox: *Create VM* → name e.g. `werkbank` → Debian 13 ISO (netinst) → 50 GB disk → 4 cores →
8192 MB RAM → same network as Home Assistant (bridge `vmbr0`). Install Debian and tick **“SSH server”**;
a desktop environment is not needed. Other systems (VirtualBox, Synology VMM, Unraid …) work the same way.

### 2. Install the workbench

Sign in on the VM (Proxmox console or SSH), become root and run **one** command:

```bash
sudo -i
curl -fsSL https://git.unfoobar.org/ha-integrations/llmitmir/-/raw/main/werkbank/install.sh | bash
```

The script installs Docker, downloads the workbench, creates a secret key (token), builds the sandbox
(5–15 minutes the first time) and starts everything. At the end, **URL** and **token** are shown on screen, e.g.:

```
URL:    http://192.168.1.50:8787
Token:  3f9c…e21a
```

### 3. Enter it in Home Assistant

In Home Assistant open **LLMitMir → Admin → Workbench**, enter URL and token, click **Test connection** and then
**Save**. When it says “connected”, you're done.

### 4. Try it out

Start a **cowork** and write, for example: *“Use Python to create a chart of the numbers 3, 7, 4, 9 and save it as
chart.png.”* The model asks for your approval before the first command.

## Security

- Use a **separate VM** for the workbench with nothing else on it: the workbench service controls Docker and therefore has
  full rights on this VM.
- The sandboxes run without special privileges, with limited memory (3 GB), CPU (2 cores) and number of processes.
- **Network: internet only.** The sandboxes are attached to their own Docker network (`llmitmir-sandbox`, bridge `lmwb0`, no
  traffic between them). The firewall rules from `firewall.sh` (set up by `install.sh` as the service
  `llmitmir-werkbank-firewall`) block everything private and local – the LAN, the router, Home Assistant, the
  VM itself. `install.sh` checks this at the end. With `SANDBOX_NETWORK=none` the sandboxes run completely offline.
- **Every sandbox has its own cache** (pip, speech models); it disappears with it. No sandbox can slip anything into
  another one – for example one of another person.
- The **token** is the only password – don't share it. The connection is unencrypted HTTP: only allow port 8787
  for the IP of Home Assistant (firewall of the VM or the router) and don't route it through foreign networks.
- **Do not expose** the workbench to the internet.
- Credentials from LLMitMir only end up in a sandbox if a command requests them via `{{cred:Name:field}}`;
  as everywhere, output is searched for secrets and blacked out.

## Operation

| What | Command (on the VM as root) |
|---|---|
| Update | run the install command from step 2 again |
| Show token | `grep WERKBANK_TOKEN /opt/llmitmir-werkbank/werkbank/.env` |
| View log | `cd /opt/llmitmir-werkbank/werkbank && docker compose logs --tail 100` |
| Restart | `cd /opt/llmitmir-werkbank/werkbank && docker compose restart` |
| Running sandboxes | `docker ps --filter label=llmitmir.werkbank=1` |
| Change settings | edit `/opt/llmitmir-werkbank/werkbank/.env`, then `docker compose up -d` |
| Remove | `cd /opt/llmitmir-werkbank/werkbank && docker compose down && docker rm -f $(docker ps -aq --filter label=llmitmir.werkbank=1); rm -rf /opt/llmitmir-werkbank` |

## If something doesn't work

- **“Test connection” fails:** is the VM running? Is the IP right (`hostname -I` on the VM)? Does a firewall let port 8787
  through? Test from another computer in the network: `curl -H "Authorization: Bearer <Token>" http://<IP>:8787/v1/health`.
- **“401 token missing or wrong”:** paste the token into Home Assistant again (without spaces at the start/end).
- **“sandbox_image_ready: false”:** the sandbox image is missing – run the install command again.
- **Commands abort:** low on memory? Increase `SANDBOX_MEMORY` in `.env` (and give the VM more RAM).

---

## For advanced users

**Structure:** `werkbank/server.py` is a small aiohttp service in the container `llmitmir-werkbank`. It talks to Docker via
`/var/run/docker.sock` and starts one container `lmwb-<id>` per session (LLMitMir uses the chat ID) from the
image `llmitmir-werkbank-sandbox` (Python 3.13, ffmpeg, Tesseract, Poppler, ImageMagick, Node.js, pandas, faster-whisper …),
user `agent` (UID 1000), working folder `/workspace`, cache `/cache` inside the container itself (per sandbox, no volume).

**Settings** (`werkbank/.env`): `WERKBANK_TOKEN`, `WERKBANK_PORT` (8787), `SANDBOX_MEMORY` (3g), `SANDBOX_CPUS` (2),
`SANDBOX_PIDS` (512), `SANDBOX_NETWORK` (llmitmir-sandbox|none; the former `bridge` counts as llmitmir-sandbox),
`SANDBOX_BRIDGE` (lmwb0), `MAX_SESSIONS` (6), `IDLE_TIMEOUT` (7200 s), `MAX_EXEC_TIMEOUT`
(3600 s), `SANDBOX_IMAGE`, `TZ`.

**API** (all with `Authorization: Bearer <Token>`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/health` | version, limits, sandbox image ready, running sessions |
| POST | `/v1/sessions/{id}` | create or resume a sandbox |
| POST | `/v1/sessions/{id}/exec` | `{"cmd": "...", "timeout": 120, "workdir": "/workspace"}` → exit code, stdout, stderr |
| GET / PUT | `/v1/sessions/{id}/files?path=…` | fetch / store a file (under `/workspace` or `/tmp`) |
| GET | `/v1/sessions/{id}/list?path=…` | list a folder |
| DELETE | `/v1/sessions/{id}` | remove a sandbox |

**Managing with Ansible/Compose:** check out the repository at a fixed version, generate `werkbank/.env` from a template
(token from the vault), set up `werkbank/firewall.sh` as a service after Docker (as in `install.sh`),
run `docker build -t llmitmir-werkbank-sandbox:latest werkbank/sandbox` and `docker compose up -d --build` in the folder
`werkbank/` – exactly what `install.sh` does. **Without the firewall the sandboxes can reach the LAN.**
