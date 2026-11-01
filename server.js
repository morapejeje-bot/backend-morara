const express = require('express');
const { Innertube } = require('youtubei.js');

const app = express();

// Izinkan web morara.my.id memanggil backend ini
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    next();
});

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
        console.log(`Mencari: ${q}`);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
