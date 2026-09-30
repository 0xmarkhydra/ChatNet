package mediax

import (
	"context"
	"errors"
	"fmt"
	"path"
	"strings"
	"time"

	"chatnet/internal/objectstore"
)

const (
	MaxChatAttachments = 10
	MaxFeedAttachments = 12
	MaxImageBytes      = 20 * 1024 * 1024
	MaxVideoBytes      = 150 * 1024 * 1024
	MaxAudioBytes      = 40 * 1024 * 1024
	MaxFileBytes       = 50 * 1024 * 1024
)

type UploadRequest struct {
	Scope       string `json:"scope"`
	Name        string `json:"name"`
	SizeBytes   int64  `json:"sizeBytes"`
	ContentType string `json:"contentType"`
}

type PresignedUpload struct {
	UploadURL   string    `json:"uploadUrl"`
	StorageRef  string    `json:"storageRef"`
	Key         string    `json:"key"`
	ExpiresAt   time.Time `json:"expiresAt"`
	Kind        string    `json:"kind"`
	DownloadURL string    `json:"downloadUrl"`
}

type AttachmentInput struct {
	StorageRef  string `json:"storageRef"`
	Name        string `json:"name"`
	SizeBytes   int64  `json:"sizeBytes"`
	ContentType string `json:"contentType"`
	Kind        string `json:"kind"`
}

type Attachment struct {
	ID          int64  `json:"id,omitempty"`
	StorageRef  string `json:"storageRef"`
	Name        string `json:"name"`
	SizeBytes   int64  `json:"sizeBytes"`
	ContentType string `json:"contentType"`
	Kind        string `json:"kind"`
	URL         string `json:"url,omitempty"`
}

func Presign(store *objectstore.Client, userID int64, req UploadRequest) (PresignedUpload, error) {
	if store == nil || !store.Configured() {
		return PresignedUpload{}, errors.New("kho file S3 chưa được cấu hình")
	}

	scope := strings.TrimSpace(strings.ToLower(req.Scope))
	kind, maxBytes, err := classify(scope, req.Name, req.ContentType)
	if err != nil {
		return PresignedUpload{}, err
	}
	if req.SizeBytes <= 0 || req.SizeBytes > maxBytes {
		return PresignedUpload{}, fmt.Errorf("kích thước file không hợp lệ, tối đa %d MB", maxBytes/1024/1024)
	}

	ticket, err := store.PresignPut(scope, userID, req.Name, 10*time.Minute)
	if err != nil {
		return PresignedUpload{}, err
	}
	downloadURL, err := store.SignedGetURL(ticket.StorageRef, time.Hour)
	if err != nil {
		return PresignedUpload{}, err
	}
	return PresignedUpload{
		UploadURL:   ticket.UploadURL,
		StorageRef:  ticket.StorageRef,
		Key:         ticket.Key,
		ExpiresAt:   ticket.ExpiresAt,
		Kind:        kind,
		DownloadURL: downloadURL,
	}, nil
}

func ValidateAttachments(ctx context.Context, store *objectstore.Client, scope string, userID int64, inputs []AttachmentInput, maxItems int) ([]Attachment, error) {
	if len(inputs) == 0 {
		return []Attachment{}, nil
	}
	if store == nil || !store.Configured() {
		return nil, errors.New("kho file S3 chưa được cấu hình")
	}
	if len(inputs) > maxItems {
		return nil, fmt.Errorf("chỉ được đính kèm tối đa %d file", maxItems)
	}

	items := make([]Attachment, 0, len(inputs))
	seen := make(map[string]struct{}, len(inputs))
	for _, input := range inputs {
		ref := strings.TrimSpace(input.StorageRef)
		name := strings.TrimSpace(input.Name)
		if ref == "" || name == "" {
			return nil, errors.New("thông tin file đính kèm không hợp lệ")
		}
		if _, exists := seen[ref]; exists {
			return nil, errors.New("file đính kèm bị trùng")
		}
		seen[ref] = struct{}{}
		if !store.Owns(ref, scope, userID) {
			return nil, errors.New("file đính kèm không thuộc người dùng hiện tại")
		}

		info, err := store.Inspect(ctx, ref)
		if err != nil {
			return nil, fmt.Errorf("không xác minh được file %q: %w", name, err)
		}
		kind, maxBytes, err := classify(scope, name, info.ContentType)
		if err != nil {
			return nil, err
		}
		if info.SizeBytes <= 0 || info.SizeBytes > maxBytes {
			return nil, fmt.Errorf("file %q vượt quá giới hạn dung lượng", name)
		}

		url, err := store.SignedGetURL(ref, time.Hour)
		if err != nil {
			return nil, err
		}
		items = append(items, Attachment{
			StorageRef:  ref,
			Name:        sanitizeName(name),
			SizeBytes:   info.SizeBytes,
			ContentType: info.ContentType,
			Kind:        kind,
			URL:         url,
		})
	}
	return items, nil
}

func SignAttachment(store *objectstore.Client, item *Attachment) {
	if item == nil || store == nil || !store.Configured() || item.StorageRef == "" {
		return
	}
	if signed, err := store.SignedGetURL(item.StorageRef, time.Hour); err == nil {
		item.URL = signed
	}
}

func PreviewLabel(kind string) string {
	switch kind {
	case "image":
		return "[Ảnh]"
	case "video":
		return "[Video]"
	case "audio":
		return "[Âm thanh]"
	default:
		return "[Tệp]"
	}
}

func classify(scope, fileName, contentType string) (string, int64, error) {
	scope = strings.TrimSpace(strings.ToLower(scope))
	if scope != "chat" && scope != "feed" {
		return "", 0, errors.New("nhóm upload không hợp lệ")
	}

	ext := strings.ToLower(path.Ext(strings.TrimSpace(fileName)))
	mime := strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	imageExt := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true, ".heic": true, ".heif": true}
	videoExt := map[string]bool{".mp4": true, ".mov": true, ".m4v": true, ".webm": true}
	audioExt := map[string]bool{".mp3": true, ".m4a": true, ".aac": true, ".wav": true, ".ogg": true}
	fileExt := map[string]bool{
		".pdf": true, ".doc": true, ".docx": true, ".xls": true, ".xlsx": true,
		".ppt": true, ".pptx": true, ".txt": true, ".csv": true, ".zip": true,
	}

	if imageExt[ext] && (strings.HasPrefix(mime, "image/") || mime == "" || mime == "application/octet-stream") {
		return "image", MaxImageBytes, nil
	}
	if videoExt[ext] && (strings.HasPrefix(mime, "video/") || mime == "" || mime == "application/octet-stream") {
		return "video", MaxVideoBytes, nil
	}
	if scope == "chat" && audioExt[ext] && (strings.HasPrefix(mime, "audio/") || mime == "" || mime == "application/octet-stream") {
		return "audio", MaxAudioBytes, nil
	}
	if scope == "chat" && fileExt[ext] {
		if mime == "text/html" || mime == "image/svg+xml" {
			return "", 0, errors.New("loại file không được phép")
		}
		return "file", MaxFileBytes, nil
	}
	if scope == "feed" {
		return "", 0, errors.New("tường nhà chỉ hỗ trợ ảnh và video")
	}
	return "", 0, errors.New("loại file không được phép")
}

func sanitizeName(name string) string {
	name = strings.TrimSpace(name)
	name = strings.ReplaceAll(name, "\\", "/")
	name = path.Base(name)
	if len([]rune(name)) > 180 {
		runes := []rune(name)
		name = string(runes[len(runes)-180:])
	}
	return name
}
