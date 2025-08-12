import { setGlobalDispatcher } from 'undici';
import { ProxyAgent } from 'undici-proxy-agent';

export function setupGlobalHttpProxyFromEnv() {
	const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.GLOBAL_HTTP_PROXY;
	if (!proxy) return;
	const agent = new ProxyAgent(proxy);
	setGlobalDispatcher(agent);
	console.log('🌐 HTTP(S)代理已启用:', proxy);
}


