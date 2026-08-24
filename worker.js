const CONFIG_KEY = 'optimized-subscription.json';
let cachedConfig = null;

function quote(value) {
	return JSON.stringify(String(value ?? ''));
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

function renderClash(config) {
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
	lines.push('proxy-groups:', ...(clash.groups || []).map(renderGroup).filter(Boolean), '');
	lines.push('rules:', ...(clash.rules || []).map(rule => `  - ${rule}`), '');
	return `${lines.join('\n')}\n`;
}

async function loadConfig(env) {
	if (cachedConfig) return cachedConfig;
	if (!env.KV || typeof env.KV.get !== 'function') throw new Error('KV binding is not configured');
	const raw = await env.KV.get(CONFIG_KEY);
	if (!raw) throw new Error(`missing KV key ${CONFIG_KEY}`);
	cachedConfig = JSON.parse(raw);
	return cachedConfig;
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
			const config = await loadConfig(env);
			return new Response(renderClash(config), {
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
