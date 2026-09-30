package objectstore

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"
)

const prefix = "chatnet"

type Client struct {
	endpoint       *url.URL
	bucket         string
	region         string
	accessKey      string
	secretKey      string
	forcePathStyle bool
	http           *http.Client
}

type PresignedUpload struct {
	UploadURL  string    `json:"uploadUrl"`
	StorageRef string    `json:"storageRef"`
	Key        string    `json:"key"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

type ObjectInfo struct {
	SizeBytes   int64
	ContentType string
}

func NewFromEnv() *Client {
	rawEndpoint := strings.TrimSpace(os.Getenv("S3_ENDPOINT"))
	var endpoint *url.URL
	if rawEndpoint != "" {
		endpoint, _ = url.Parse(strings.TrimRight(rawEndpoint, "/") + "/")
	}

	forcePathStyle := true
	if raw := strings.TrimSpace(os.Getenv("S3_FORCE_PATH_STYLE")); raw != "" {
		if parsed, err := strconv.ParseBool(raw); err == nil {
			forcePathStyle = parsed
		}
	}

	return &Client{
		endpoint:       endpoint,
		bucket:         strings.TrimSpace(os.Getenv("S3_BUCKET")),
		region:         strings.TrimSpace(os.Getenv("S3_REGION")),
		accessKey:      strings.TrimSpace(os.Getenv("S3_ACCESS_KEY_ID")),
		secretKey:      strings.TrimSpace(os.Getenv("S3_SECRET_ACCESS_KEY")),
		forcePathStyle: forcePathStyle,
		http:           &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) Configured() bool {
	return c != nil &&
		c.endpoint != nil &&
		c.endpoint.Scheme != "" &&
		c.endpoint.Host != "" &&
		c.bucket != "" &&
		c.region != "" &&
		c.accessKey != "" &&
		c.secretKey != ""
}

func (c *Client) PresignPut(scope string, userID int64, originalName string, ttl time.Duration) (PresignedUpload, error) {
	if !c.Configured() {
		return PresignedUpload{}, errors.New("S3 storage is not configured")
	}
	scope = strings.TrimSpace(scope)
	if scope != "chat" && scope != "feed" {
		return PresignedUpload{}, errors.New("invalid media scope")
	}
	if userID <= 0 {
		return PresignedUpload{}, errors.New("invalid user")
	}

	ext := strings.ToLower(path.Ext(strings.TrimSpace(originalName)))
	if len(ext) > 12 {
		return PresignedUpload{}, errors.New("invalid file extension")
	}
	for _, r := range ext {
		if !(r == '.' || r >= 'a' && r <= 'z' || r >= '0' && r <= '9') {
			return PresignedUpload{}, errors.New("invalid file extension")
		}
	}

	randomID, err := randomHex(16)
	if err != nil {
		return PresignedUpload{}, err
	}
	key := fmt.Sprintf("%s/%s/%d/%s/%s%s", prefix, scope, userID, time.Now().UTC().Format("2006/01"), randomID, ext)
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	expiresAt := time.Now().UTC().Add(ttl)
	uploadURL, err := c.signedURL(http.MethodPut, key, expiresAt)
	if err != nil {
		return PresignedUpload{}, err
	}

	return PresignedUpload{
		UploadURL:  uploadURL,
		StorageRef: fmt.Sprintf("s3://%s/%s", c.bucket, key),
		Key:        key,
		ExpiresAt:  expiresAt,
	}, nil
}

func (c *Client) SignedGetURL(storageRef string, ttl time.Duration) (string, error) {
	key, ok := c.keyFromRef(storageRef)
	if !ok {
		return "", errors.New("invalid storage reference")
	}
	if ttl <= 0 {
		ttl = time.Hour
	}
	return c.signedURL(http.MethodGet, key, time.Now().UTC().Add(ttl))
}

func (c *Client) Owns(storageRef, scope string, userID int64) bool {
	key, ok := c.keyFromRef(storageRef)
	if !ok {
		return false
	}
	expected := fmt.Sprintf("%s/%s/%d/", prefix, scope, userID)
	return strings.HasPrefix(key, expected)
}

func (c *Client) Inspect(ctx context.Context, storageRef string) (ObjectInfo, error) {
	key, ok := c.keyFromRef(storageRef)
	if !ok {
		return ObjectInfo{}, errors.New("invalid storage reference")
	}
	signed, err := c.signedURL(http.MethodHead, key, time.Now().UTC().Add(2*time.Minute))
	if err != nil {
		return ObjectInfo{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, signed, nil)
	if err != nil {
		return ObjectInfo{}, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return ObjectInfo{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ObjectInfo{}, fmt.Errorf("storage returned HTTP %d", resp.StatusCode)
	}
	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	return ObjectInfo{SizeBytes: resp.ContentLength, ContentType: contentType}, nil
}

func (c *Client) keyFromRef(storageRef string) (string, bool) {
	if !c.Configured() {
		return "", false
	}
	start := "s3://" + c.bucket + "/"
	if !strings.HasPrefix(storageRef, start) {
		return "", false
	}
	key := strings.TrimPrefix(storageRef, start)
	if key == "" || strings.Contains(key, "..") || !strings.HasPrefix(key, prefix+"/") {
		return "", false
	}
	return key, true
}

func (c *Client) signedURL(method, key string, expiresAt time.Time) (string, error) {
	if !c.Configured() {
		return "", errors.New("S3 storage is not configured")
	}
	if key == "" || strings.Contains(key, "..") {
		return "", errors.New("invalid object key")
	}

	now := time.Now().UTC()
	date := now.Format("20060102")
	amzDate := now.Format("20060102T150405Z")
	scope := fmt.Sprintf("%s/%s/s3/aws4_request", date, c.region)
	expires := int(time.Until(expiresAt).Seconds())
	if expires < 1 {
		expires = 1
	}
	if expires > 604800 {
		expires = 604800
	}

	var host string
	var rawPath string
	if c.forcePathStyle {
		host = c.endpoint.Host
		rawPath = joinPath(c.endpoint.Path, c.bucket, key)
	} else {
		host = c.bucket + "." + c.endpoint.Host
		rawPath = joinPath(c.endpoint.Path, key)
	}
	canonicalURI := encodePath(rawPath)

	params := map[string]string{
		"X-Amz-Algorithm":     "AWS4-HMAC-SHA256",
		"X-Amz-Credential":    c.accessKey + "/" + scope,
		"X-Amz-Date":          amzDate,
		"X-Amz-Expires":       strconv.Itoa(expires),
		"X-Amz-SignedHeaders": "host",
	}
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	queryParts := make([]string, 0, len(keys))
	for _, k := range keys {
		queryParts = append(queryParts, awsEncode(k)+"="+awsEncode(params[k]))
	}
	canonicalQuery := strings.Join(queryParts, "&")
	canonicalHeaders := "host:" + host + "\n"
	canonicalRequest := method + "\n" + canonicalURI + "\n" + canonicalQuery + "\n" + canonicalHeaders + "\nhost\nUNSIGNED-PAYLOAD"
	stringToSign := "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + sha256Hex(canonicalRequest)

	kDate := hmacSHA256([]byte("AWS4"+c.secretKey), date)
	kRegion := hmacSHA256(kDate, c.region)
	kService := hmacSHA256(kRegion, "s3")
	kSigning := hmacSHA256(kService, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256(kSigning, stringToSign))

	return c.endpoint.Scheme + "://" + host + canonicalURI + "?" + canonicalQuery + "&X-Amz-Signature=" + signature, nil
}

func joinPath(parts ...string) string {
	clean := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.Trim(part, "/")
		if part != "" {
			clean = append(clean, part)
		}
	}
	return "/" + strings.Join(clean, "/")
}

func encodePath(raw string) string {
	segments := strings.Split(strings.Trim(raw, "/"), "/")
	encoded := make([]string, 0, len(segments))
	for _, segment := range segments {
		if segment == "" {
			continue
		}
		encoded = append(encoded, awsEncode(segment))
	}
	return "/" + strings.Join(encoded, "/")
}

func awsEncode(value string) string {
	return strings.ReplaceAll(url.QueryEscape(value), "+", "%20")
}

func sha256Hex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func hmacSHA256(key []byte, value string) []byte {
	h := hmac.New(sha256.New, key)
	_, _ = h.Write([]byte(value))
	return h.Sum(nil)
}

func randomHex(bytesCount int) (string, error) {
	buf := make([]byte, bytesCount)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
