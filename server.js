const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Innertube } = require('youtubei.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => res.send('Server Morara Jalan!'));

wss.on('connection', async (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const query = urlParams.get('q');

    if (!query) {
        ws.send(JSON.stringify({ type: 'error', message: 'Judul kosong!' }));
        return ws.close();
    }

    try {
        console.log(`Mencari lagu: ${query}`);
        
        // Pake youtubei.js buat nyari & ambil video
        const youtube = await Innertube.create();
        const search = await youtube.search(query, { type: 'video' });
        
        if (!search.videos || search.videos.length === 0) {
            throw new Error('Video tidak ditemukan');
        }

        const video = search.videos[0];
        console.log(`Ketemu: ${video.title.text}`);

        // Ambil stream video kualitas 360p (audio + video)
        const stream = await youtube.download(video.id, {
            type: 'audio+video',
            quality: '360p'
        });

        ws.send(JSON.stringify({ 
            type: 'start', 
            mime: 'video/mp4',
            title: video.title.text 
        }));

        // Kirim potongan video ke web (HTML)
        for await (const chunk of stream) {
            ws.send(chunk);
        }

        ws.send(JSON.stringify({ type: 'end' }));
        ws.close();
        console.log('Selesai mengirim video');

    } catch (error) {
        console.error(error);
        ws.send(JSON.stringify({ type: 'error', message: 'Gagal: ' + (error.message || 'Error tidak diketahui') }));
        ws.close();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
