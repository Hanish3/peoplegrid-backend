-- Table to store all user accounts
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store all posts
CREATE TABLE posts (
    post_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    content TEXT,
    media_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- Table to manage friendships between users
CREATE TABLE friendships (
    friendship_id SERIAL PRIMARY KEY,
    user_one_id INT NOT NULL,
    user_two_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    action_user_id INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(), -- Corrected typo here
    
    UNIQUE (user_one_id, user_two_id),

    FOREIGN KEY(user_one_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY(user_two_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY(action_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);