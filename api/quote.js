// api/quote.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ status: 'error', message: 'Kein symbol-Parameter' });
  }
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${process.env.TWELVEDATA_API_KEY}`;
    const apiRes = await fetch(url);
    const data = await apiRes.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(apiRes.status).json(data);
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}