-- V2__create_circles_schema.sql: Circles domain schema for SocialTush

CREATE TABLE IF NOT EXISTS circles (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    avatar_url VARCHAR(512),
    cover_url VARCHAR(512),
    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    type VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city VARCHAR(100),
    country VARCHAR(100),
    language VARCHAR(10) DEFAULT 'es',
    members_count INT NOT NULL DEFAULT 1,
    active_now_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS circle_members (
    id UUID PRIMARY KEY,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_circle_members UNIQUE (circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS circle_join_requests (
    id UUID PRIMARY KEY,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_circle_join_requests UNIQUE (circle_id, user_id)
);
