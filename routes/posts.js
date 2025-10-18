const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply authentication middleware to all post routes
router.use(authMiddleware);

// --- GET All Posts (Corrected) ---
router.get('/', async (req, res) => {
  try {
    const allPosts = await pool.query(
      `SELECT 
        p.id AS post_id, p.content, p.created_at, p.post_type, p.title, p.media_url,
        u.id AS user_id, u.username, u.profile_picture_url,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) AS is_liked_by_user
      FROM posts p 
      JOIN users u ON p.user_id = u.id 
      ORDER BY p.created_at DESC`,
      [req.userId]
    );
    res.json(allPosts.rows);
  } catch (err) {
    console.error('Get Posts Error:', err.message);
    res.status(500).json({ error: 'Server error while fetching posts.' });
  }
});

// --- CREATE a New Post (No changes needed, was already correct) ---
router.post('/', upload.single('mediaFile'), async (req, res) => {
  try {
    const { content, title, post_type } = req.body;
    let mediaUrl = null;

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: "peoplegrid_posts", resource_type: "auto" }, (error, result) => {
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
    // You might want to fetch the created post with user details to return to the frontend
    res.status(201).json(newPost.rows[0]);
  } catch (err) {
    console.error('Create Post Error:', err.message);
    res.status(500).json({ error: 'Server error while creating post.' });
  }
});

// --- LIKE/UNLIKE a Post (Corrected postId parameter) ---
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
    res.status(500).json({ error: 'Server error while liking post.' });
  }
});

// --- GET Comments for a Post (Corrected) ---
router.get('/:postId/comments', async (req, res) => {
    try {
        const { postId } = req.params;
        const comments = await pool.query(
            `SELECT c.id AS comment_id, c.comment_text, c.created_at, u.username, u.id AS user_id 
             FROM comments c 
             JOIN users u ON c.user_id = u.id 
             WHERE c.post_id = $1 
             ORDER BY c.created_at ASC`,
            [postId]
        );
        res.json(comments.rows);
    } catch (err) {
        console.error('Get Comments Error:', err.message);
        res.status(500).json({ error: 'Server error while fetching comments.' });
    }
});

// --- ADD a Comment to a Post (Corrected postId parameter) ---
router.post('/:postId/comment', async (req, res) => {
    try {
        const { postId } = req.params;
        const { comment_text } = req.body;
        const newComment = await pool.query(
            'INSERT INTO comments (post_id, user_id, comment_text) VALUES ($1, $2, $3) RETURNING id, comment_text, created_at',
            [postId, req.userId, comment_text]
        );
        res.status(201).json(newComment.rows[0]);
    } catch (err) {
        console.error('Add Comment Error:', err.message);
        res.status(500).json({ error: 'Server error while adding comment.' });
    }
});

// --- DELETE a post (Corrected) ---
router.delete('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const loggedInUserId = req.userId;

    const postResult = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const postAuthorId = postResult.rows[0].user_id;
    if (postAuthorId !== loggedInUserId) {
      return res.status(403).json({ error: 'You are not authorized to delete this post.' });
    }

    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
    res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    console.error('Delete Post Error:', err.message);
    res.status(500).json({ error: 'Server error while deleting post.' });
  }
});

module.exports = router;