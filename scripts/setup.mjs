#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync('sub.json', 'utf8'));
const adRulesPath = 'ad-rules.txt';
const directRulesPath = 'direct-rules.txt';
const streamingRulesPath = 'streaming-rules.txt';
const required = ['WORKER_NAME', 'CUSTOM_DOMAIN'];
for (const key of required) {
	if (!String(process.env[key] || '').trim()) throw new Error(`${key} is required`);
}
const proxyServer = config.server || config.hostdare;
if (!proxyServer?.server || !proxyServer?.uuid || !proxyServer?.publicKey || !proxyServer?.servername) {
	throw new Error('sub.json 中 server.server、uuid、publicKey、servername 不能为空');
}
if (!Array.isArray(config.static) || config.static.length === 0) {
	throw new Error('sub.json 至少需要一个 static 节点');
}

function run(args, input) {
	const result = spawnSync('npx', ['wrangler', ...args], {
		encoding: 'utf8',
		input,
		stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
	});
	if (result.status !== 0) process.exit(result.status || 1);
	return result.stdout || '';
}

const workerName = process.env.WORKER_NAME;
const customDomain = process.env.CUSTOM_DOMAIN;
const namespaceOutput = run(['kv', 'namespace', 'create', `${workerName}-config`]);
const namespaceId = namespaceOutput.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').match(/id\s*=\s*"([a-f0-9]+)"/i)?.[1];
if (!namespaceId) throw new Error('无法从 Wrangler 输出中读取 KV namespace ID');

writeFileSync('wrangler.local.toml', [
	`name = ${JSON.stringify(workerName)}`,
	'main = "worker.js"',
	'compatibility_date = "2025-11-04"',
	'keep_vars = true',
	'',
	'routes = [',
	`  { pattern = ${JSON.stringify(customDomain)}, custom_domain = true }`,
	']',
	'',
	'[[kv_namespaces]]',
	'binding = "KV"',
	`id = ${JSON.stringify(namespaceId)}`,
	'',
].join('\n'));

run(['kv', 'key', 'put', 'sub.json', '--path', 'sub.json', '--namespace-id', namespaceId, '--remote']);
run(['kv', 'key', 'put', 'ad-rules.txt', '--path', adRulesPath, '--namespace-id', namespaceId, '--remote']);
run(['kv', 'key', 'put', 'direct-rules.txt', '--path', directRulesPath, '--namespace-id', namespaceId, '--remote']);
run(['kv', 'key', 'put', 'streaming-rules.txt', '--path', streamingRulesPath, '--namespace-id', namespaceId, '--remote']);
const token = randomBytes(24).toString('hex');
run(['secret', 'put', 'SUB_TOKEN', '--config', 'wrangler.local.toml'], `${token}\n`);
run(['deploy', '--config', 'wrangler.local.toml']);

console.log('\n部署完成');
console.log(`订阅地址: https://${customDomain}/sub?token=${token}`);
console.log('本地敏感配置: sub.json');
