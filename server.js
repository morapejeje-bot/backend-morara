const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const ytstream = require('yt-stream');

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
        
        // Pake yt-stream buat nyari & ambil video (lebih tahan blokir)
        const streamInfo = await ytstream.stream(query, {
            quality: 'low', // resolusi rendah biar downloadnya cepet
            type: 'video'
        });

        console.log(`Ketemu video! Mulai streaming...`);

        ws.send(JSON.stringify({ 
            type: 'start', 
            mime: 'video/mp4',
            title: query 
        }));

        // Kirim potongan video ke web (HTML)
        streamInfo.stream.on('data', (chunk) => {
            ws.send(chunk);
        });

        streamInfo.stream.on('end', () => {
            ws.send(JSON.stringify({ type: 'end' }));
            ws.close();
            console.log('Selesai mengirim video');
        });

        streamInfo.stream.on('error', (err) => {
            console.error(err);
            ws.send(JSON.stringify({ type: 'error', message: err.message }));
            ws.close();
        });

    } catch (error) {
        console.error(error);
        ws.send(JSON.stringify({ type: 'error', message: 'Gagal: ' + error.message }));
        ws.close();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
