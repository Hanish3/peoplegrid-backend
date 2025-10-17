const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

// GET profile
router.get('/', async (req, res) => {
  try {
    const userProfile = await pool.query(
      'SELECT user_id, username, email, profile_picture_url, bio, relationship_status, age, pronouns FROM users WHERE user_id = $1',
      [req.userId]
    );
    if (userProfile.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(userProfile.rows[0]);
  } catch (err) {
    console.error('Get Profile Error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// UPDATE profile
router.put('/', async (req, res) => {
  try {
    const { username, bio, relationship_status, age, pronouns } = req.body;
    const existingUser = await pool.query('SELECT * FROM users WHERE username = $1 AND user_id != $2', [username, req.userId]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }
    const updatedUser = await pool.query(
      `UPDATE users SET username = $1, bio = $2, relationship_status = $3, age = $4, pronouns = $5 WHERE user_id = $6 RETURNING user_id, username, email, bio, relationship_status, age, pronouns`,
      [username, bio, relationship_status, age, pronouns, req.userId]
    );
    res.json({ message: 'Profile updated successfully!', user: updatedUser.rows[0] });
  } catch (err) {
    console.error('Update Profile Error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// UPLOAD profile photo
router.post('/upload-photo', upload.single('profilePhoto'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ folder: "peoplegrid_profiles" }, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }).end(req.file.buffer);
        });
        const imageUrl = uploadResult.secure_url;
        await pool.query('UPDATE users SET profile_picture_url = $1 WHERE user_id = $2', [imageUrl, req.userId]);
        res.json({ message: 'Profile photo updated successfully!', profile_picture_url: imageUrl });
    } catch (err) {
        console.error('Photo Upload Error:', err.message);
        res.status(500).json({ error: 'Server error during photo upload.' });
    }
});

module.exports = router;