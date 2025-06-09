const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpPath = 'uploads/';
    if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
    cb(null, tmpPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());

// ✅ FIX: Use connection pool instead of single connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Check DB connection on startup
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ MySQL connection error:', err);
  } else {
    console.log('✅ Connected to MySQL');
    connection.release();
  }
});

// Upload route
app.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });

  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'private_uploads',
      access_mode: 'authenticated',
    });

    const imageUrl = result.secure_url;
    const imageName = req.file.originalname;

    fs.unlinkSync(req.file.path); // Delete local temp file

    db.query(
      'INSERT INTO entries (name, email, image_name, image_url) VALUES (?, ?, ?, ?)',
      [name, email, imageName, imageUrl],
      (err, results) => {
        if (err) {
          console.error('❌ MySQL insert error:', err);
          return res.status(500).json({ error: 'DB insert failed.' });
        }
        res.json({ message: '✅ Entry saved', id: results.insertId });
      }
    );
  } catch (err) {
    console.error('❌ Cloudinary error:', err);
    res.status(500).json({ error: 'Cloudinary upload failed.' });
  }
});

// Fetch entries
app.get('/entries', (req, res) => {
  db.query('SELECT * FROM entries', (err, results) => {
    if (err) {
      console.error('❌ Error fetching entries:', err);
      return res.status(500).json({ error: 'DB fetch failed.', details: err });
    }
    res.json(results);
  });
});

// Delete entry
app.delete('/entries/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM entries WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'DB delete failed.' });
    res.json({ message: '✅ Entry deleted' });
  });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
