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
        console.log(`Ketemu: ${video.title}`);

        // === TEMPEL COOKIES LO DI SINI ===
        // Ganti teks di dalam tanda kutip dengan cookies yang lo copy tadi
        const COOKIE = " HSID=AG5usqEM8KLaTEFC8;HSID=AytHI_sOZgOZkFjQO;SID=g.a000EQlW6I6jIYPzgoVsg5OkV_tHT0wECMyftXrR37eGbpsuig5FFrJMOVaoESx1poeMWN9ragACgYKAZ4SARISFQHGX2MiaE6AgdQZ2EU6wPKhMoIhexoVAUF8yKqr6vaBptrfN934MiNRlRqW0076;SID=g.a000EQlW6I6jIYPzgoVsg5OkV_tHT0wECMyftXrR37eGbpsuig5FFrJMOVaoESx1poeMWN9ragACgYKAZ4SARISFQHGX2MiaE6AgdQZ2EU6wPKhMoIhexoVAUF8yKqr6vaBptrfN934MiNRlRqW0076;SID=g.a000EQlW6I6jIYPzgoVsg5OkV_tHT0wECMyftXrR37eGbpsuig5FFrJMOVaoESx1poeMWN9ragACgYKAZ4SARISFQHGX2MiaE6AgdQZ2EU6wPKhMoIhexoVAUF8yKqr6vaBptrfN934MiNRlRqW0076;SAPISID=wKM1UUGNYsJ1z7Dr/ApuUC5HmROo0WtON3;SAPISID=wKM1UUGNYsJ1z7Dr/ApuUC5HmROo0WtON3;SAPISID=wKM1UUGNYsJ1z7Dr/ApuUC5HmROo0WtON3;APISID=FqcKP6nqzJI2bnC6/Akpkg4dyiKhIqZNxs;APISID=FqcKP6nqzJI2bnC6/Akpkg4dyiKhIqZNxs;APISID=FqcKP6nqzJI2bnC6/Akpkg4dyiKhIqZNxs;SSID=ABN14AIg1KtL5fHzz;SSID=A1pQuJd0ERDmtwPlC;SSID=ABN14AIg1KtL5fHzz;VISITOR_INFO1_LIVE=A9HJwAH_icw;PREF=tz=tz=Asia.Kuala_Lumpur&f7=100&f6=40000000"; 
        
        const stream = ytdl(video.url, { 
            filter: 'audioandvideo', 
            quality: 'lowest',
            requestOptions: {
                headers: {
                    'cookie': COOKIE,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        });

        ws.send(JSON.stringify({ type: 'start', mime: 'video/mp4', title: video.title }));
        stream.on('data', (chunk) => ws.send(chunk));
        stream.on('end', () => {
            ws.send(JSON.stringify({ type: 'end' }));
            ws.close();
        });
        stream.on('error', (err) => {
            ws.send(JSON.stringify({ type: 'error', message: err.message }));
            ws.close();
        });
    } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
        ws.close();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
