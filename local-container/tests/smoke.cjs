// Synthetic data only; each run gets a disposable copy of the API directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { gzipSync } = require('node:zlib');
const CryptoJS = require('../api/node_modules/crypto-js');

async function main() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cookiecloud-smoke-'));
    const api = path.resolve(__dirname, '../api');
    fs.copyFileSync(path.join(api, 'app.js'), path.join(dir, 'app.js'));
    fs.cpSync(path.join(api, 'utils'), path.join(dir, 'utils'), { recursive: true });
    fs.symlinkSync(path.join(api, 'node_modules'), path.join(dir, 'node_modules'));
    const child = spawn(process.execPath, ['app.js'], {
        cwd: dir,
        env: { ...process.env, PORT: '18088', API_ROOT: '/test/', NODE_ENV: 'production' },
        stdio: ['ignore', 'pipe', 'inherit']
    });
    const exited = once(child, 'exit');
    const timeout = setTimeout(() => child.kill('SIGKILL'), 15000);
    try {
        await new Promise((resolve, reject) => {
            child.stdout.on('data', chunk => {
                if (chunk.toString().includes('Server start')) resolve();
            });
            child.once('error', reject);
            child.once('exit', code => reject(new Error(`API exited before ready: ${code}`)));
        });
        const url = 'http://127.0.0.1:18088/test';
        const health = await fetch(url + '/health');
        assert.equal(health.status, 200);
        assert.equal((await health.json()).status, 'OK');
        const data = { cookie_data: { 'example.invalid': [{ name: 'test', value: 'synthetic' }] }, local_storage_data: {} };
        const password = 'synthetic-test-password';
        for (const crypto_type of ['legacy', 'aes-128-cbc-fixed']) {
            const uuid = 'smoke-' + crypto_type;
            const key = CryptoJS.MD5(uuid + '-' + password).toString().slice(0, 16);
            const options = { iv: CryptoJS.enc.Hex.parse('00'.repeat(16)), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 };
            const encrypted = crypto_type === 'legacy'
                ? CryptoJS.AES.encrypt(JSON.stringify(data), key).toString()
                : CryptoJS.AES.encrypt(JSON.stringify(data), CryptoJS.enc.Utf8.parse(key), options).ciphertext.toString(CryptoJS.enc.Base64);
            const upload = await fetch(url + '/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
                body: gzipSync(JSON.stringify({ uuid, encrypted, crypto_type }))
            });
            assert.equal(upload.status, 200);
            assert.equal((await upload.json()).action, 'done');
            const downloaded = await fetch(url + '/get/' + uuid).then(r => r.json());
            assert.deepEqual(downloaded, { encrypted, crypto_type });
            const plaintext = crypto_type === 'legacy'
                ? CryptoJS.AES.decrypt(downloaded.encrypted, key)
                : CryptoJS.AES.decrypt(downloaded.encrypted, CryptoJS.enc.Utf8.parse(key), options);
            assert.deepEqual(JSON.parse(plaintext.toString(CryptoJS.enc.Utf8)), data);
            const decrypted = await fetch(url + '/get/' + uuid, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
            });
            assert.equal(decrypted.status, 200);
            assert.deepEqual(await decrypted.json(), data);
        }
        // Preserve older clients: multipart upload without crypto_type defaults to legacy.
        const form = new FormData();
        form.set('uuid', 'smoke-multipart');
        form.set('encrypted', 'synthetic-ciphertext');
        const uploaded = await fetch(url + '/update', { method: 'POST', body: form });
        assert.equal(uploaded.status, 200);
        assert.deepEqual(await uploaded.json(), { action: 'done' });
        assert.deepEqual(await fetch(url + '/get/smoke-multipart').then(r => r.json()), {
            encrypted: 'synthetic-ciphertext', crypto_type: 'legacy'
        });
        child.kill('SIGTERM');
        assert.deepEqual(await exited, [0, null]);
        console.log('PASS: health, API_ROOT, gzip upload, both crypto modes, legacy multipart, SIGTERM');
    } finally {
        child.kill('SIGKILL');
        await exited;
        clearTimeout(timeout);
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
