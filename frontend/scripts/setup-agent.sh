#!/bin/bash

# Navigate to the agent directory
cd "$(dirname "$0")/../../backend" || exit 1

uv venv --python 3.11 2>/dev/null || true
uv pip install --python .venv/bin/python -r requirements.txt
