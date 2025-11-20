import express from 'express';
import cors from 'cors';
import path from 'path';
import { scanLibrary, startRound, checkGuess } from './controllers/gameController';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static clips
app.use('/clips', express.static(path.join(__dirname, '../public/clips')));

// Routes
app.post('/api/scan', scanLibrary);
app.get('/api/game/start', startRound);
app.post('/api/game/guess', checkGuess);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
