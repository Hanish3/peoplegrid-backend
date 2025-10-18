require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const pool = require('./db');
const authMiddleware = require('./middleware/auth');
const cloudinary = require('cloudinary').v2; // Make sure cloudinary is imported

// --- ROUTE IMPORTS ---
// --- THE FIX: ADD CLOUDINARY CONFIGURATION HERE ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const postsRoutes = require('./routes/posts');
const friendsRoutes = require('./routes/friends');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- API ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/friends', friendsRoutes);

// --- API ROUTE TO GET CHAT HISTORY ---
app.get('/api/messages/:otherUserId', authMiddleware, async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const currentUserId = req.userId;

        const messages = await pool.query(
            `SELECT * FROM messages 
             WHERE (sender_id = $1 AND receiver_id = $2) 
                OR (sender_id = $2 AND receiver_id = $1)
             ORDER BY created_at ASC`,
            [currentUserId, otherUserId]
        );
        res.json(messages.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// --- REAL-TIME LOGIC ---
let onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('addUser', (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} is online.`);
  });

  socket.on('sendMessage', async ({ senderId, receiverId, text }) => {
    await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, message_text) VALUES ($1, $2, $3)',
        [senderId, receiverId, text]
    );

    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receiveMessage', {
        sender_id: senderId,
        message_text: text,
      });
    }
  });

  socket.on('disconnect', () => {
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    console.log('A user disconnected:', socket.id);
  });
});

// --- Start the server ---
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});