#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${CONFIG_FILE:-optimized-subscription.json}"
WRANGLER_CONFIG="${WRANGLER_CONFIG:-wrangler.toml}"
KV_KEY="${KV_KEY:-optimized-subscription.json}"
WRANGLER=(npx wrangler)

usage() {
	cat <<'EOF'
Usage:
  ./scripts/deploy.sh [options]

Options:
  --set-token    Interactively set the SUB_TOKEN secret, then exit
  --skip-upload  Deploy Worker without uploading the KV config
  --dry-run      Validate the Worker bundle without uploading or deploying
  -h, --help     Show this help

Environment overrides:
  CONFIG_FILE       Local generated KV JSON (default: optimized-subscription.json)
  WRANGLER_CONFIG   Wrangler config path (default: wrangler.toml)
  KV_NAMESPACE_ID   Override the KV namespace ID from wrangler.toml
EOF
}

if [[ ! -f "$WRANGLER_CONFIG" ]]; then
	echo "Missing Wrangler config: $WRANGLER_CONFIG" >&2
	exit 1
fi

SET_TOKEN=false
SKIP_UPLOAD=false
DRY_RUN=false
for arg in "$@"; do
	case "$arg" in
		--set-token) SET_TOKEN=true ;;
		--skip-upload) SKIP_UPLOAD=true ;;
		--dry-run) DRY_RUN=true ;;
		-h|--help) usage; exit 0 ;;
		*) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
	esac
done

if [[ "$SET_TOKEN" == true ]]; then
	"${WRANGLER[@]}" secret put SUB_TOKEN --config "$WRANGLER_CONFIG"
	exit 0
fi

if [[ "$DRY_RUN" == true ]]; then
	"${WRANGLER[@]}" deploy --dry-run --config "$WRANGLER_CONFIG"
	exit 0
fi

if [[ "$SKIP_UPLOAD" == false ]]; then
	NAMESPACE_ID="${KV_NAMESPACE_ID:-$(awk -F'"' '/^[[:space:]]*id[[:space:]]*=/{print $2; exit}' "$WRANGLER_CONFIG")}" 
	if [[ -z "$NAMESPACE_ID" || "$NAMESPACE_ID" == replace-with-* ]]; then
		echo "Set kv_namespaces.id in $WRANGLER_CONFIG or export KV_NAMESPACE_ID." >&2
		exit 1
	fi
fi

if [[ "$SKIP_UPLOAD" == false ]]; then
	if [[ ! -f "$CONFIG_FILE" ]]; then
		echo "Missing KV config: $CONFIG_FILE" >&2
		echo "Generate it locally, or use --skip-upload." >&2
		exit 1
	fi
	"${WRANGLER[@]}" kv key put "$KV_KEY" \
		--path "$CONFIG_FILE" \
		--namespace-id "$NAMESPACE_ID" \
		--remote
fi

"${WRANGLER[@]}" deploy --config "$WRANGLER_CONFIG"
