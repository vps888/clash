const CONFIG_KEY = 'sub.json';
const AD_RULES_KEY = 'ad-rules.txt';
const DIRECT_RULES_KEY = 'direct-rules.txt';
const STREAMING_RULES_KEY = 'streaming-rules.txt';
let cachedConfig = null;
let cachedAdRules = null;
let cachedDirectRules = null;
let cachedStreamingRules = null;

function quote(value) {
	return JSON.stringify(String(value ?? ''));
}

function buildVlessProxy(node) {
	const flag = node.flag || '🇺🇸';
	const name = `${flag} ${node.name || 'US-HD'}-${node.server}`;
	const yaml = `  - {name: ${quote(name)}, type: vless, server: ${quote(node.server)}, port: ${Number(node.port) || 443}, uuid: ${quote(node.uuid)}, network: tcp, tls: true, udp: true, flow: xtls-rprx-vision, servername: ${quote(node.servername)}, client-fingerprint: ${quote(node.clientFingerprint || 'firefox')}, reality-opts: {public-key: ${quote(node.publicKey)}, short-id: ${quote(node.shortId || '')}}}`;
	return { name, yaml };
}

function buildStaticProxy(node, dialerName) {
	const name = `${node.flag || '🇺🇸'} ${node.name || 'US-Static-via-HD'}`;
	const yaml = `  - {name: ${quote(name)}, type: socks5, server: ${quote(node.server)}, port: ${Number(node.port) || 12324}, username: ${quote(node.username)}, password: ${quote(node.password)}, dialer-proxy: ${quote(dialerName)}}`;
	return { name, yaml };
}

function normalizeAdProviderRule(rule) {
	const value = String(rule || '').trim();
	if (!value || value.startsWith('#')) return '';
	const parts = value.split(',').map(part => part.trim()).filter(Boolean);
	if (parts.length < 2) return '';
	return parts.slice(0, 2).join(',');
}

function normalizeConfig(source) {
	if (source?.clash) return source;
	const proxyServer = source?.server || source?.hostdare;
	if (!proxyServer?.server || !proxyServer?.uuid || !proxyServer?.publicKey || !proxyServer?.servername) {
		throw new Error('sub.json requires server.server, uuid, publicKey and servername');
	}
	const serverProxy = buildVlessProxy(proxyServer);
	const proxies = [serverProxy, ...(Array.isArray(source.static) ? source.static : []).filter(node => node?.server).map(node => buildStaticProxy(node, serverProxy.name))];
	const proxyNames = proxies.map(proxy => proxy.name);
	const rules = ['GEOIP,CN,国内直连,no-resolve', 'MATCH,三网优化'];
	const providers = Array.isArray(source.providers) ? source.providers : [];
	const providerNames = providers.map(provider => provider?.name).filter(Boolean);
	return {
		enabled: true,
		clash: {
			dns: String(source.dns || ''),
			proxies,
			proxyProviders: providers,
			groups: [
				{ name: '国内直连', type: 'select', proxies: ['DIRECT'] },
				{ name: '三网优化', type: 'select', proxies: proxyNames, use: providerNames },
				{ name: '流媒体', type: 'select', proxies: proxyNames, use: providerNames },
			],
			rules,
		},
	};
}

function renderRuleProvider(name, url, path) {
	return [
		`  ${name}:`,
		'    type: http',
		'    behavior: classical',
		'    format: text',
		`    url: ${quote(url)}`,
		`    path: ${quote(path)}`,
		'    interval: 86400',
	].join('\n');
}

function renderProvider(provider) {
	if (!provider?.name || !provider?.url) return '';
	const lines = [
		`  ${quote(provider.name)}:`,
		`    type: ${provider.type || 'http'}`,
		`    url: ${quote(provider.url)}`,
		`    interval: ${Number(provider.interval ?? 3600) || 3600}`,
		`    path: ${quote(provider.path || `./proxy-providers/${provider.name}.yaml`)}`,
	];
	const healthCheck = provider.healthCheck;
	if (healthCheck !== false) {
		lines.push(
			'    health-check:',
			`      enable: ${healthCheck?.enable === false ? 'false' : 'true'}`,
			`      interval: ${Number(healthCheck?.interval ?? 600) || 600}`,
			`      url: ${quote(healthCheck?.url || 'https://www.gstatic.com/generate_204')}`,
		);
	}
	return lines.join('\n');
}

function renderGroup(group) {
	if (!group?.name) return '';
	const parts = [`name: ${quote(group.name)}`, `type: ${group.type || 'select'}`];
	if (Array.isArray(group.proxies) && group.proxies.length > 0) {
		parts.push(`proxies: [${group.proxies.map(quote).join(', ')}]`);
	}
	if (Array.isArray(group.use) && group.use.length > 0) {
		parts.push(`use: [${group.use.map(quote).join(', ')}]`);
	}
	return `  - {${parts.join(', ')}}`;
}

function renderClash(config, { adProviderUrl = '', directProviderUrl = '', streamingProviderUrl = '' } = {}) {
	const clash = config?.clash || {};
	const lines = [
		'mixed-port: 7890',
		'allow-lan: true',
		'mode: rule',
		'log-level: info',
		'',
	];
	if (clash.dns) lines.push(clash.dns.trimEnd(), '');
	lines.push('proxies:', ...(clash.proxies || []).map(proxy => proxy.yaml).filter(Boolean), '');
	const providers = (clash.proxyProviders || []).map(renderProvider).filter(Boolean);
	if (providers.length > 0) lines.push('proxy-providers:', ...providers, '');
	const ruleProviders = [
		...(adProviderUrl ? [renderRuleProvider('ads', adProviderUrl, './rules/ads.txt')] : []),
		...(directProviderUrl ? [renderRuleProvider('direct', directProviderUrl, './rules/direct.txt')] : []),
		...(streamingProviderUrl ? [renderRuleProvider('streaming', streamingProviderUrl, './rules/streaming.txt')] : []),
	];
	if (ruleProviders.length > 0) lines.push('rule-providers:', ...ruleProviders, '');
	lines.push('proxy-groups:', ...(clash.groups || []).map(renderGroup).filter(Boolean), '');
	const rules = [
		...(adProviderUrl ? ['RULE-SET,ads,REJECT'] : []),
		...(directProviderUrl ? ['RULE-SET,direct,国内直连'] : []),
		...(streamingProviderUrl ? ['RULE-SET,streaming,流媒体'] : []),
		...(clash.rules || []),
	];
	lines.push('rules:', ...rules.map(rule => `  - ${rule}`), '');
	return `${lines.join('\n')}\n`;
}

function renderAdRules(rules) {
	return `${rules.join('\n')}\n`;
}

function normalizeRuleText(raw) {
	return String(raw || '')
		.split(/\r?\n/)
		.map(normalizeAdProviderRule)
		.filter(Boolean);
}

async function loadConfig(env) {
	if (cachedConfig) return cachedConfig;
	if (!env.KV || typeof env.KV.get !== 'function') throw new Error('KV binding is not configured');
	const raw = await env.KV.get(CONFIG_KEY);
	if (!raw) throw new Error(`missing KV key ${CONFIG_KEY}`);
	cachedConfig = normalizeConfig(JSON.parse(raw));
	return cachedConfig;
}

async function loadDirectRules(env) {
	if (cachedDirectRules !== null) return cachedDirectRules;
	if (!env.KV || typeof env.KV.get !== 'function') throw new Error('KV binding is not configured');
	const raw = await env.KV.get(DIRECT_RULES_KEY);
	cachedDirectRules = normalizeRuleText(raw || '');
	return cachedDirectRules;
}

async function loadAdRules(env) {
	if (cachedAdRules !== null) return cachedAdRules;
	if (!env.KV || typeof env.KV.get !== 'function') throw new Error('KV binding is not configured');
	const raw = await env.KV.get(AD_RULES_KEY);
	cachedAdRules = normalizeRuleText(raw || '');
	return cachedAdRules;
}

async function loadStreamingRules(env) {
	if (cachedStreamingRules !== null) return cachedStreamingRules;
	if (!env.KV || typeof env.KV.get !== 'function') throw new Error('KV binding is not configured');
	const raw = await env.KV.get(STREAMING_RULES_KEY);
	cachedStreamingRules = normalizeRuleText(raw || '');
	return cachedStreamingRules;
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname === '/health') return new Response('ok\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
		const expectedToken = String(env.SUB_TOKEN || '').trim();
		if (!expectedToken || url.searchParams.get('token') !== expectedToken) {
			return new Response('Unauthorized\n', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
		}
		if (request.method !== 'GET') return new Response('Method Not Allowed\n', { status: 405 });
		try {
			if (url.pathname === '/rules/direct.txt') {
				const directRules = await loadDirectRules(env);
				return new Response(`${directRules.join('\n')}\n`, {
					headers: {
						'content-type': 'text/plain; charset=utf-8',
						'cache-control': 'public, max-age=300',
					},
				});
			}
			if (url.pathname === '/rules/streaming.txt') {
				const streamingRules = await loadStreamingRules(env);
				return new Response(`${streamingRules.join('\n')}\n`, {
					headers: {
						'content-type': 'text/plain; charset=utf-8',
						'cache-control': 'public, max-age=300',
					},
				});
			}
			const config = await loadConfig(env);
			const adRules = await loadAdRules(env);
			if (url.pathname === '/rules/ads.txt') {
				return new Response(renderAdRules(adRules), {
					headers: {
						'content-type': 'text/plain; charset=utf-8',
						'cache-control': 'public, max-age=300',
					},
				});
			}
			const adProviderUrl = adRules.length
				? new URL(`/rules/ads.txt?token=${encodeURIComponent(expectedToken)}`, request.url).toString()
				: '';
			const directRules = await loadDirectRules(env);
			const directProviderUrl = directRules.length
				? new URL(`/rules/direct.txt?token=${encodeURIComponent(expectedToken)}`, request.url).toString()
				: '';
			const streamingRules = await loadStreamingRules(env);
			const streamingProviderUrl = streamingRules.length
				? new URL(`/rules/streaming.txt?token=${encodeURIComponent(expectedToken)}`, request.url).toString()
				: '';
			return new Response(renderClash(config, { adProviderUrl, directProviderUrl, streamingProviderUrl }), {
				headers: {
					'content-type': 'text/yaml; charset=utf-8',
					'cache-control': 'no-store',
					'content-disposition': 'inline; filename="optimized-clash.yaml"',
				},
			});
		} catch (error) {
			return new Response(`Configuration error: ${error.message}\n`, { status: 500 });
		}
	},
};
