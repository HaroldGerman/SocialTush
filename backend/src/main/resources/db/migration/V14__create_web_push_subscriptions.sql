CREATE TABLE web_push_subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_web_push_subscriptions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_web_push_subscriptions_endpoint UNIQUE (endpoint)
);

CREATE INDEX idx_web_push_subscriptions_user_id
    ON web_push_subscriptions(user_id);

CREATE INDEX idx_web_push_subscriptions_active
    ON web_push_subscriptions(is_active);
