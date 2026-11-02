const express = require('express');
const { Innertube } = require('youtubei.js');
const axios = require('axios');

const app = express();

// Izinkan web morara.my.id memanggil backend ini
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    next();
});

// ==========================================
// BAGIAN 1: YOUTUBE (Kode Asli)
// ==========================================
let ytPromise = null;
function getYoutube() {
    if (!ytPromise) {
        ytPromise = Innertube.create({ generate_session_locally: true }).catch((e) => {
            ytPromise = null;
            throw e;
        });
    }
    return ytPromise;
}

app.get('/', (req, res) => res.send('Server Morara Jalan!'));

app.get('/search', async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'Judul kosong!' });

    try {
        console.log(`Mencari YT: ${q}`);
        const yt = await getYoutube();
        const search = await yt.search(q, { type: 'video' });

        const results = (search.videos || [])
            .filter((v) => v.id)
            .slice(0, 10)
            .map((v) => ({
                id: v.id,
                title: v.title?.text || String(v.title || q),
                channel: v.author?.name || 'YouTube',
                duration: v.duration?.text || '',
                thumb: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`
            }));

        if (!results.length) return res.status(404).json({ error: 'Video tidak ditemukan' });
        res.json({ results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Error tidak diketahui' });
    }
});

// ==========================================
// BAGIAN 2: TIKTOK (TikWM API)
// ==========================================
async function tikwm(url) {
    const body = new URLSearchParams({ url, hd: '1' });
    const response = await axios.post('https://www.tikwm.com/api/', body.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
    });
    if (!response.data || response.data.code !== 0) {
        throw new Error(response.data?.msg || 'TikWM gagal');
    }
    return response.data.data;
}

async function tikwmSearch(keywords, cursor = 0, count = 20) {
    const response = await axios.get('https://www.tikwm.com/api/search', {
        params: { keywords, count, cursor },
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
    });
    if (!response.data || response.data.code !== 0) {
        throw new Error(response.data?.msg || 'Pencarian TikTok gagal');
    }
    return response.data.data;
}

// Route TikTok: Ambil detail video dari LINK
app.get('/tt', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Parameter url wajib' });
    
    try {
        console.log(`Mengambil TT URL: ${url}`);
        const data = await tikwm(url);
        res.json({ data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Route TikTok: Pencarian VIDEO berdasarkan KATA KUNCI
app.get('/tt/search', async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'Parameter q wajib' });

    try {
        console.log(`Mencari TT: ${q}`);
        const cursor = +(req.query.cursor || 0);
        const count = +(req.query.count || 20);
        const data = await tikwmSearch(q, cursor, count);
        res.json({ data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// JALANKAN SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
