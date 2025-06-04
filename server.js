const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

app.use(cors());
app.use(express.json());
app.use(`/${UPLOAD_DIR}`, express.static(path.join(__dirname, UPLOAD_DIR)));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT, // ✅ Add DB_PORT
});

db.connect((err) => {
  if (err) {
    console.error('❌ Error connecting to MySQL:', err);
    return;
  }
  console.log('✅ Connected to database successfully');
});

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded.' });
  }

  const { name, email } = req.body;
  const imageName = req.file.originalname;
  const imageUrl = `/${UPLOAD_DIR}/${req.file.filename}`;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  db.query(
    'INSERT INTO entries (name, email, image_name, image_url) VALUES (?, ?, ?, ?)',
    [name, email, imageName, imageUrl],
    (err, results) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ error: 'Error saving to database.' });
      }
      res.json({ message: '✅ Entry saved successfully', id: results.insertId });
    }
  );
});

app.get('/entries', (req, res) => {
  db.query('SELECT * FROM entries', (err, results) => {
    if (err) {
      console.error('❌ Error fetching entries:', err);
      return res.status(500).json({ error: 'Error fetching entries.' });
    }
    res.json(results);
  });
});

app.delete('/entries/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM entries WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Error deleting entry:', err);
      return res.status(500).json({ error: 'Error deleting entry.' });
    }
    res.json({ message: '✅ Entry deleted successfully' });
  });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
