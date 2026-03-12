// ════════════════════════════════════════════════════════
//  Netlify Function — AI Proxy untuk Puskeswan Pontianak
//  File: netlify/functions/ai-proxy.js
//
//  Fungsi ini menyembunyikan API key di server Netlify
//  sehingga tidak terekspos di browser pengguna.
//
//  Setup:
//  1. Deploy ke Netlify
//  2. Di Netlify dashboard → Site settings → Environment variables
//  3. Tambahkan: ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxx
// ════════════════════════════════════════════════════════

exports.handler = async function(event, context) {

  // Hanya izinkan POST request
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Hanya izinkan request dari domain sendiri (CORS protection)
  const origin = event.headers.origin || event.headers.Origin || '';
  const allowedOrigins = [
    'https://puskeswan-pontianak.netlify.app',
    'http://localhost:8888',  // untuk testing lokal
    'http://127.0.0.1:5500', // untuk VS Code Live Server
  ];

  // Jika origin tidak dikenal, tetap izinkan (untuk Netlify preview deployments)
  const corsOrigin = allowedOrigins.includes(origin) ? origin : '*';

  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Cek API key tersedia
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY belum diset di environment variables Netlify');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'API key belum dikonfigurasi. Hubungi admin sistem.',
        hint: 'Tambahkan ANTHROPIC_API_KEY di Netlify Site Settings → Environment Variables'
      })
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Request body tidak valid (bukan JSON)' })
    };
  }

  // Validasi & sanitasi input — pastikan hanya field yang diperlukan
  const { prompt, system } = requestBody;
  if (!prompt || typeof prompt !== 'string' || prompt.length > 5000) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Field "prompt" tidak valid atau terlalu panjang' })
    };
  }

  // Panggil Anthropic API dari sisi server
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: system || 'Kamu adalah asisten AI untuk dokter hewan di Puskeswan Kota Pontianak, Kalimantan Barat. Berikan saran klinis yang praktis, singkat, dan berbasis bukti dalam Bahasa Indonesia. Gunakan format yang mudah dibaca. Selalu ingatkan bahwa keputusan akhir ada pada dokter.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', response.status, errData);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: `API error: ${response.status}`,
          detail: errData.error?.message || 'Unknown error'
        })
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.error('Fetch error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Gagal menghubungi Anthropic API', detail: err.message })
    };
  }
};
