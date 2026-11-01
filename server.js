const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Innertube } = require('youtubei.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => res.send('Server Morara Jalan!'));

// Buat 1 sesi Innertube dan dipakai ulang (lebih cepat & hemat request)
let youtubePromise = null;
function getYoutube() {
    if (!youtubePromise) {
        youtubePromise = Innertube.create({
            generate_session_locally: true
        }).catch((err) => {
            youtubePromise = null; // reset kalau gagal biar bisa dicoba lagi
            throw err;
        });
    }
    return youtubePromise;
}

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
}

wss.on('connection', async (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const query = urlParams.get('q');

    let closed = false;
    ws.on('close', () => { closed = true; });

    if (!query) {
        send(ws, JSON.stringify({ type: 'error', message: 'Judul kosong!' }));
        return ws.close();
    }

    try {
        console.log(`Mencari: ${query}`);

        const youtube = await getYoutube();

        const search = await youtube.search(query, { type: 'video' });

        if (!search.videos || search.videos.length === 0) {
            throw new Error('Video tidak ditemukan');
        }

        const video = search.videos[0];
        const title = video.title?.text || String(video.title || query);
        console.log(`Ketemu: ${title}`);

        const stream = await youtube.download(video.id, {
            type: 'video+audio',
            quality: '360p',
            format: 'mp4'
        });

        send(ws, JSON.stringify({
            type: 'start',
            mime: 'video/mp4',
            title
        }));

        for await (const chunk of stream) {
            if (closed) break; // user sudah tutup halaman, stop kirim
            send(ws, chunk);
        }

        if (!closed) {
            send(ws, JSON.stringify({ type: 'end' }));
            ws.close();
        }
        console.log('Selesai mengirim video');

    } catch (error) {
        console.error(error);
        send(ws, JSON.stringify({
            type: 'error',
            message: 'Gagal: ' + (error.message || 'Error tidak diketahui')
        }));
        ws.close();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
