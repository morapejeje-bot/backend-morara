const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Innertube } = require('youtubei.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => res.send('Server Morara Jalan!'));

// Masukin cookies baru lo di sini kalau mau tetep pake cookies
// (Tapi kalau udah logout, biarin aja teks di bawah ini)
const COOKIE_YOUTUBE = "HSID=AG5usqEM8KLaTEFC8; SID=g.a000EQlW6I6jIYPzgoVsg5OkV_tHT0wECMyftXrR37eGbpsuig5FFrJMOVaoESx1poeMWN9ragACgYKAZ4SARISFQHGX2MiaE6AgdQZ2EU6wPKhMoIhexoVAUF8yKqr6vaBptrfN934MiNRlRqW0076; SAPISID=wKM1UUGNYsJ1z7Dr/ApuUC5HmROo0WtON3; APISID=FqcKP6nqzJI2bnC6/Akpkg4dyiKhIqZNxs; SSID=ABN14AIg1KtL5fHzz; VISITOR_INFO1_LIVE=A9HJwAH_icw; PREF=tz=Asia.Kuala_Lumpur&f7=100&f6=40000000";

wss.on('connection', async (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const query = urlParams.get('q');

    if (!query) {
        ws.send(JSON.stringify({ type: 'error', message: 'Judul kosong!' }));
        return ws.close();
    }

    try {
        console.log(`Mencari lagu: ${query}`);
        
        // TRIK: Pake client ANDROID biar YouTube ngira ini dari HP asli
        const youtube = await Innertube.create({
            client_type: 'ANDROID', 
            cookie: COOKIE_YOUTUBE
        });
        
        const search = await youtube.search(query, { type: 'video' });
        
        if (!search.videos || search.videos.length === 0) {
            throw new Error('Video tidak ditemukan');
        }

        const video = search.videos[0];
        console.log(`Ketemu: ${video.title.text}`);

        // Ambil stream video
        const stream = await youtube.download(video.id, {
            type: 'audio+video',
            quality: '360p'
        });

        ws.send(JSON.stringify({ 
            type: 'start', 
            mime: 'video/mp4',
            title: video.title.text 
        }));

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
