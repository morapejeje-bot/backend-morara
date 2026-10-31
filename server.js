const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Cek server hidup
app.get('/', (req, res) => res.send('Server Morara Jalan!'));

wss.on('connection', async (ws, req) => {
    console.log('Web HTML tersambung!');

    // Ambil judul dari URL (contoh: wss://server-lo.com/?q=mangu)
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const query = urlParams.get('q');

    if (!query) {
        ws.send(JSON.stringify({ type: 'error', message: 'Judul kosong!' }));
        return ws.close();
    }

    try {
        console.log(`Mencari: ${query}`);
        // 1. Cari video di YouTube
        const search = await yts(query);
        const video = search.videos[0]; // Ambil hasil teratas
        if (!video) throw new Error('Video tidak ditemukan');

        console.log(`Ketemu: ${video.title} (${video.url})`);

        // 2. Ambil stream video (kualitas paling rendah biar cepat)
        const stream = ytdl(video.url, { 
            filter: 'audioandvideo', 
            quality: 'lowest' 
        });

        // 3. Kirim info START ke web
        ws.send(JSON.stringify({ 
            type: 'start', 
            mime: 'video/mp4',
            title: video.title
        }));

        // 4. Kirim potongan video (chunk) ke web secara real-time
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

// Render.com bakal ngasih port otomatis lewat process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server jalan di port ${PORT}`);
});
