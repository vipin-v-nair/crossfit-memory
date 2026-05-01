#!/bin/bash

cd "$(dirname "$0")/../../backend" || exit 1

source .venv/bin/activate

uvicorn server:app --reload --port 8000
