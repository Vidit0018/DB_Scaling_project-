require('dotenv').config();
const express = require('express');
const dbRoutes = require('./routes/dbRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy is useful if your app is hosted behind a reverse proxy (like Neon, Heroku, Render)
// This ensures req.ip and req.headers['x-forwarded-for'] work correctly.
app.set('trust proxy', true);

app.use(express.json());

// Professional base routing
app.use('/api/v1', dbRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the DB Project API. Go to /api/v1/base to test the database connection and log your visit.');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
