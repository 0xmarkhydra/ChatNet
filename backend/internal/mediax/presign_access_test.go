package mediax

import (
	"strings"
	"testing"

	"chatnet/internal/objectstore"
)

func TestChatPresignDoesNotExposeS3DownloadURL(t *testing.T) {
	t.Setenv("S3_ENDPOINT", "https://s3.example.test")
	t.Setenv("S3_BUCKET", "private-media")
	t.Setenv("S3_REGION", "us-east-1")
	t.Setenv("S3_ACCESS_KEY_ID", "test-access")
	t.Setenv("S3_SECRET_ACCESS_KEY", "test-secret")
	store := objectstore.NewFromEnv()
	chat, err := Presign(store, 42, UploadRequest{Scope: "chat", Name: "image.jpg", SizeBytes: 42, ContentType: "image/jpeg"})
	if err != nil {
		t.Fatal(err)
	}
	if chat.DownloadURL != "" {
		t.Fatal("chat upload leaked a raw S3 GET URL")
	}
	if !strings.Contains(chat.UploadURL, "X-Amz-Signature=") {
		t.Fatal("upload ticket missing signature")
	}
	feed, err := Presign(store, 42, UploadRequest{Scope: "feed", Name: "image.jpg", SizeBytes: 42, ContentType: "image/jpeg"})
	if err != nil {
		t.Fatal(err)
	}
	if feed.DownloadURL == "" {
		t.Fatal("non-chat presign unexpectedly changed")
	}
}
