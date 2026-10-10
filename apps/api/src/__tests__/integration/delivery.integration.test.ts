import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { deliverWebhook } from '../../services/activation/delivery';
import { signPayload, generateSecret } from '../../services/activation/signing';


describe('HTTPS Delivery Transport (Real HTTPS)', () => {
  let server: https.Server;
  let receivedHeaders: Record<string, string> = {};
  let receivedBody: Buffer = Buffer.alloc(0);
  let port = 30099;

  let originalEnv: string | undefined;

  beforeAll((done) => {
    const certPath = path.join(process.cwd(), 'test-certs', 'cert.pem');
    const keyPath = path.join(process.cwd(), 'test-certs', 'key.pem');
    
    // Inject the test cert CA into Node for this test run
    originalEnv = process.env.NODE_EXTRA_CA_CERTS;
    process.env.NODE_EXTRA_CA_CERTS = certPath;

    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };

    server = https.createServer(options, (req, res) => {
      receivedHeaders = req.headers as Record<string, string>;
      const chunks: Buffer[] = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks);
        res.writeHead(200);
        res.end('OK');
      });
    });
    server.listen(0, '127.0.0.1', () => { port = (server.address() as any).port; done(); });
  });

  afterAll((done) => {
    process.env.NODE_EXTRA_CA_CERTS = originalEnv;
    server.close(done);
  });

  it('delivers securely over HTTPS with verified signature', async () => {
    const payload = JSON.stringify({ event: 'test', ts: Date.now() });
    const secret = generateSecret();
    const deliveryId = crypto.randomUUID();
    const ts = Date.now();
    const sig = signPayload(payload, secret, deliveryId, ts);

    // Provide allowLocal: true directly so deliverWebhook can hit 127.0.0.1
    // (This overrides SSRF DNS pinning during the test wrapper)
    const res = await deliverWebhook(`https://localhost:${port}/hook`, Buffer.from(payload), {
      'X-CDP-Delivery-Id': deliveryId,
      'X-CDP-Signature': sig,
      'Content-Type': 'application/json',
    }, 10000, true);

    if (!res.ok) console.log("RES:", res); expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(receivedBody.toString('utf8')).toBe(payload);
    expect(receivedHeaders['x-cdp-signature']).toBe(sig);
    expect(receivedHeaders['x-cdp-delivery-id']).toBe(deliveryId);
  });
});
