-- V8__add_cleared_at_to_conversation_participants.sql
ALTER TABLE conversation_participants ADD COLUMN cleared_at TIMESTAMP WITH TIME ZONE;
