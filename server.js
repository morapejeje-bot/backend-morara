const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => res.send('Server Morara Jalan!'));

wss.on('connection', async (ws, req) => {
    console.log('Web HTML tersambung!');

    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const query = urlParams.get('q');

    if (!query) {
        ws.send(JSON.stringify({ type: 'error', message: 'Judul kosong!' }));
        return ws.close();
    }

    try {
        console.log(`Mencari: ${query}`);
        const search = await yts(query);
        const video = search.videos[0]; 
        if (!video) throw new Error('Video tidak ditemukan');

        console.log(`Ketemu: ${video.title} (${video.url})`);

        // TRIK BYPASS 429: Nyamar jadi YouTube iOS & pakai client alternatif
        const stream = ytdl(video.url, { 
            filter: 'audioandvideo', 
            quality: 'lowest',
            playerClients: ['IOS', 'ANDROID', 'WEB_EMBEDDED'], 
            requestOptions: {
                headers: {
                    'User-Agent': 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)'
                }
            }
        });

        ws.send(JSON.stringify({ 
            type: 'start', 
            mime: 'video/mp4',
            title: video.title
        }));

        stream.on('data', (chunk) => {
            ws.send(chunk);
        });

        stream.on('end', () => {
            ws.send(JSON.stringify({ type: 'end' }));
            ws.close();
            console.log('Selesai mengirim video');
        });

        stream.on('error', (err) => {
            ws.send(JSON.stringify({ type: 'error', message: err.message }));
            ws.close();
        });

    } catch (error) {
        console.error(error);
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
        ws.close();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server jalan di port ${PORT}`);
});
