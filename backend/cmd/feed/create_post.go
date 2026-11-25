package main

import (
	"context"
	"strings"
	"unicode/utf8"

	"chatnet/internal/mediax"
)

type createPostInputError string

func (err createPostInputError) Error() string { return string(err) }

type createPostError string

func (err createPostError) Error() string { return string(err) }

func (s *server) createPost(ctx context.Context, userID int64, content, visibility, background string, publishLocation *postLocation, attachmentInputs []mediax.AttachmentInput) (post, error) {
	content = strings.TrimSpace(content)
	if visibility == "" {
		visibility = "public"
	}
	if !validVisibility(visibility) || !validBackground(background) {
		return post{}, createPostInputError("invalid post visibility or background")
	}
	if utf8.RuneCountInString(content) > 5000 {
		return post{}, createPostInputError("content must be <= 5000 characters")
	}

	attachments, err := mediax.ValidateAttachments(ctx, s.storage, "feed", userID, attachmentInputs, mediax.MaxFeedAttachments)
	if err != nil {
		return post{}, createPostInputError(err.Error())
	}
	if content == "" && len(attachments) == 0 {
		return post{}, createPostInputError("post content or attachment is required")
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return post{}, createPostError("cannot create post")
	}
	defer tx.Rollback(ctx)

	var created post
	if err := tx.QueryRow(ctx, "SELECT username,display_name FROM users WHERE id=$1", userID).Scan(&created.Author, &created.AuthorDisplayName); err != nil {
		return post{}, createPostError("cannot load post author")
	}
	created.Visibility = visibility
	created.Background = background
	created.PublishLocation = publishLocation
	created.Attachments = attachments
	if err := tx.QueryRow(ctx, `
		INSERT INTO posts(user_id,content,visibility,background,publish_location)
		VALUES($1,$2,$3,$4,$5)
		RETURNING id,content,likes_count,created_at,updated_at`,
		userID, content, visibility, background, publishLocation,
	).Scan(&created.ID, &created.Content, &created.Likes, &created.CreatedAt, &created.UpdatedAt); err != nil {
		return post{}, createPostError("cannot create post")
	}

	for position, attachment := range attachments {
		if _, err := tx.Exec(ctx, `
			INSERT INTO post_attachments(
				post_id,storage_ref,original_name,content_type,size_bytes,kind,position
			) VALUES($1,$2,$3,$4,$5,$6,$7)`,
			created.ID,
			attachment.StorageRef,
			attachment.Name,
			attachment.ContentType,
			attachment.SizeBytes,
			attachment.Kind,
			position,
		); err != nil {
			return post{}, createPostError("cannot save post attachment")
		}
	}
	newMentions, err := s.syncPostMentions(ctx, tx, created.ID, userID, created.Content, created.Visibility)
	if err != nil {
		return post{}, createPostError("cannot save post mentions")
	}
	if err := tx.Commit(ctx); err != nil {
		return post{}, createPostError("cannot save post")
	}
	s.pushPostMentions(created.ID, created.AuthorDisplayName, newMentions)

	created.Comments = []comment{}
	return created, nil
}
