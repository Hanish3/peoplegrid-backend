const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

// --- GET All Posts ---
router.get('/', async (req, res) => {
  try {
    const allPosts = await pool.query(
      `SELECT 
         p.post_id, p.content, p.created_at, p.post_type, p.title, p.media_url,
         u.user_id, u.username, u.profile_picture_url,
         (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) AS like_count,
         (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comment_count,
         EXISTS(SELECT 1 FROM likes WHERE post_id = p.post_id AND user_id = $1) AS is_liked_by_user
       FROM posts p 
       JOIN users u ON p.user_id = u.user_id 
       ORDER BY p.created_at DESC`,
       [req.userId]
    );
    res.json(allPosts.rows);
  } catch (err) {
    console.error('Get Posts Error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// --- CREATE a New Post ---
router.post('/', upload.single('mediaFile'), async (req, res) => {
  try {
    const { content, title, post_type } = req.body;
    let mediaUrl = null;

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: "peoplegrid_posts" }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }).end(req.file.buffer);
      });
      mediaUrl = uploadResult.secure_url;
    }

    const newPost = await pool.query(
      'INSERT INTO posts (user_id, content, title, post_type, media_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, content, title, post_type, mediaUrl]
    );
    res.status(201).json(newPost.rows[0]);
  } catch (err) {
    console.error('Create Post Error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// --- LIKE/UNLIKE a Post ---
router.post('/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;
    const existingLike = await pool.query("SELECT * FROM likes WHERE user_id = $1 AND post_id = $2", [userId, postId]);

    if (existingLike.rows.length > 0) {
      await pool.query("DELETE FROM likes WHERE user_id = $1 AND post_id = $2", [userId, postId]);
      res.json({ message: "Post unliked." });
    } else {
      await pool.query("INSERT INTO likes (user_id, post_id) VALUES ($1, $2)", [userId, postId]);
      res.json({ message: "Post liked." });
    }
  } catch (err) {
    console.error('Like Post Error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// --- GET Comments for a Post ---
router.get('/:postId/comments', async (req, res) => {
    try {
        const { postId } = req.params;
        const comments = await pool.query(
            `SELECT c.comment_id, c.comment_text, c.created_at, u.username, u.user_id 
             FROM comments c 
             JOIN users u ON c.user_id = u.user_id 
             WHERE c.post_id = $1 
             ORDER BY c.created_at ASC`,
            [postId]
        );
        res.json(comments.rows);
    } catch (err) {
        console.error('Get Comments Error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// --- ADD a Comment to a Post ---
router.post('/:postId/comment', async (req, res) => {
    try {
        const { postId } = req.params;
        const { comment_text } = req.body;
        const newComment = await pool.query(
            'INSERT INTO comments (post_id, user_id, comment_text) VALUES ($1, $2, $3) RETURNING *',
            [postId, req.userId, comment_text]
        );
        res.status(201).json(newComment.rows[0]);
    } catch (err) {
        console.error('Add Comment Error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE a post
router.delete('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const loggedInUserId = req.userId;
    const postResult = await pool.query('SELECT user_id FROM posts WHERE post_id = $1', [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    const postAuthorId = postResult.rows[0].user_id;
    if (postAuthorId !== loggedInUserId) {
      return res.status(403).json({ error: 'You are not authorized to delete this post.' });
    }
    await pool.query('DELETE FROM posts WHERE post_id = $1', [postId]);
    res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    console.error('Delete Post Error:', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;