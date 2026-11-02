const express = require('express');
const { Innertube } = require('youtubei.js');
const axios = require('axios');

const app = express();

// Izinkan web morara.my.id memanggil backend ini
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    next();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ==========================================
// BAGIAN 1: YOUTUBE
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
// Header lengkap untuk meniru browser asli (menghindari 403)
const axiosHeaders = {
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'origin': 'https://www.tikwm.com',
    'referer': 'https://www.tikwm.com/',
    'x-requested-with': 'XMLHttpRequest'
};

// Kirim POST ke TikWM, ulangi otomatis kalau kena 403/429 (batas 1 request/detik)
async function tikwmPost(endpoint, params, errMsg) {
    const body = new URLSearchParams(params);
    let lastErr;

    for (let i = 0; i < 3; i++) {
        try {
            const response = await axios.post(
                `https://www.tikwm.com${endpoint}`,
                body.toString(),
                {
                    headers: {
                        ...axiosHeaders,
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                    },
                    timeout: 30000
                }
            );
            if (!response.data || response.data.code !== 0) {
                throw new Error(response.data?.msg || errMsg);
            }
            return response.data.data;
        } catch (e) {
            lastErr = e;
            const st = e.response?.status;
            if (st === 403 || st === 429 || /limit/i.test(e.message)) {
                await sleep(1500 * (i + 1));
                continue;
            }
            throw e;
        }
    }
    throw lastErr;
}

async function tikwm(url) {
    return tikwmPost('/api/', { url, hd: '1' }, 'TikWM gagal');
}

async function tikwmSearch(keywords, cursor = 0, count = 20) {
    return tikwmPost(
        '/api/feed/search',
        {
            keywords,
            count: String(count),
            cursor: String(cursor),
            web: '1',
            hd: '1'
        },
        'Pencarian TikTok gagal'
    );
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
