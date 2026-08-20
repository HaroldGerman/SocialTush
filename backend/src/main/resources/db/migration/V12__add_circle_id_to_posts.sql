-- Circle posts remain attached to their circle. The default restrictive FK
-- deliberately prevents deleting a circle while it still owns posts.
ALTER TABLE posts
    ADD COLUMN circle_id UUID NULL;

ALTER TABLE posts
    ADD CONSTRAINT fk_posts_circle
    FOREIGN KEY (circle_id) REFERENCES circles(id);

CREATE INDEX idx_posts_circle_id ON posts(circle_id);
