import net from 'node:net';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';

const fail = (what) => {
  process.stderr.write(`NETWORK_ATTEMPT:${what}\n`);
  throw new Error('network blocked: ' + what);
};
net.Socket.prototype.connect = function () { fail('net.connect'); };
dns.lookup = () => fail('dns.lookup');
http.request = () => fail('http.request');
https.request = () => fail('https.request');
http.get = () => fail('http.get');
https.get = () => fail('https.get');
globalThis.fetch = () => fail('fetch');
