// Preloaded into the n8n process with NODE_OPTIONS=--require. Logs every
// outgoing http/https request as one JSON line to the file in E2E_HTTP_LOG,
// so an e2e check can count the real HTTP calls n8n's engine made, retries
// included. Inert when E2E_HTTP_LOG is unset.
const fs = require('fs');
const http = require('http');
const https = require('https');

const logFile = process.env.E2E_HTTP_LOG;

function describe(protocol, args) {
	const [first, second] = args;
	const options = second && typeof second === 'object' ? second : undefined;
	let url;
	if (typeof first === 'string' || first instanceof URL) {
		url = new URL(String(first));
	} else {
		const host = first.hostname || first.host || 'localhost';
		url = new URL(`${protocol}//${host}${first.path || '/'}`);
	}
	const method = options?.method || (first && first.method) || 'GET';
	return { t: Date.now(), pid: process.pid, method, host: url.hostname, path: url.pathname + url.search };
}

if (logFile) {
	for (const [protocol, mod] of [
		['http:', http],
		['https:', https],
	]) {
		const original = mod.request;
		mod.request = function (...args) {
			try {
				fs.appendFileSync(logFile, JSON.stringify(describe(protocol, args)) + '\n');
			} catch {
				// never break the request because logging failed
			}
			return original.apply(this, args);
		};
	}
}
