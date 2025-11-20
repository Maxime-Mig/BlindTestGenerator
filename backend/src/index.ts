import express from 'express';
import cors from 'cors';
import path from 'path';
import gameRoutes from './routes/gameRoutes';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Serve static clips
app.use('/static', express.static(path.join(__dirname, '../../backend/static')));

// Routes
app.use('/api/game', gameRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`🚀 TypeScript backend running on http://localhost:${PORT}`);
});
