const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// --- SEARCH for users by username ---
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json([]);
    }
    const searchResults = await pool.query(
      "SELECT user_id, username, profile_picture_url FROM users WHERE username ILIKE $1 AND user_id != $2 LIMIT 10",
      [`%${query}%`, req.userId]
    );
    res.json(searchResults.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- SEND a friend request ---
router.post('/request/:recipientId', async (req, res) => {
    try {
        const { recipientId } = req.params;
        const senderId = req.userId;

        if (senderId.toString() === recipientId) {
            return res.status(400).json({ error: "You cannot add yourself as a friend." });
        }
        
        const user_one_id = Math.min(senderId, recipientId);
        const user_two_id = Math.max(senderId, recipientId);

        const existing = await pool.query(
            "SELECT * FROM friendships WHERE user_one_id = $1 AND user_two_id = $2",
            [user_one_id, user_two_id]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "A friendship request already exists or you are already friends." });
        }
        
        await pool.query(
            "INSERT INTO friendships (user_one_id, user_two_id, action_user_id, status) VALUES ($1, $2, $3, 'pending')",
            [user_one_id, user_two_id, senderId]
        );
        res.status(201).json({ message: "Friend request sent." });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- GET pending friend requests ---
router.get('/pending', async (req, res) => {
    try {
        const pendingRequests = await pool.query(
            `SELECT u.user_id, u.username, u.profile_picture_url 
             FROM friendships f
             JOIN users u ON u.user_id = f.action_user_id
             WHERE (f.user_one_id = $1 OR f.user_two_id = $1) 
               AND f.status = 'pending' 
               AND f.action_user_id != $1`,
            [req.userId]
        );
        res.json(pendingRequests.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- ACCEPT a friend request ---
router.put('/accept/:requesterId', async (req, res) => {
    try {
        const { requesterId } = req.params;
        const recipientId = req.userId;
        const user_one_id = Math.min(requesterId, recipientId);
        const user_two_id = Math.max(requesterId, recipientId);
        await pool.query(
            "UPDATE friendships SET status = 'accepted' WHERE user_one_id = $1 AND user_two_id = $2 AND action_user_id = $3 AND status = 'pending'",
            [user_one_id, user_two_id, requesterId]
        );
        res.json({ message: "Friend request accepted." });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- GET list of all accepted friends ---
router.get('/list', async (req, res) => {
    try {
        const friends = await pool.query(
            `SELECT u.user_id, u.username, u.profile_picture_url 
             FROM users u
             JOIN friendships f ON (f.user_one_id = u.user_id OR f.user_two_id = u.user_id)
             WHERE (f.user_one_id = $1 OR f.user_two_id = $1)
               AND u.user_id != $1
               AND f.status = 'accepted'`,
            [req.userId]
        );
        res.json(friends.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;