#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f sub.json ]]; then
	cp sub.json.template sub.json
	chmod 600 sub.json
	echo '已创建 sub.json。请编辑其中的 HostDare、UUID、静态住宅 IP 和代理账号密码，然后重新运行：'
	echo '  ./scripts/setup.sh'
	exit 0
fi

read -r -p 'Worker 名称 [my-clash-worker]: ' WORKER_NAME
WORKER_NAME="${WORKER_NAME:-my-clash-worker}"
read -r -p '订阅域名 [sub.example.com]: ' CUSTOM_DOMAIN
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-sub.example.com}"

export WORKER_NAME CUSTOM_DOMAIN
node scripts/setup.mjs
