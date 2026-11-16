package objectstore

import (
	"context"
	"encoding/xml"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Open never exposes a raw S3 GET capability to browsers. The chat service
// verifies authorization against PostgreSQL before each call.
func (c *Client) Open(ctx context.Context, storageRef, byteRange string) (*http.Response, error) {
	key, valid := c.keyFromRef(storageRef)
	if !valid {
		return nil, fmt.Errorf("invalid storage reference")
	}
	signed, err := c.signedURL(http.MethodGet, key, time.Now().UTC().Add(30*time.Second))
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, signed, nil)
	if err != nil {
		return nil, err
	}
	if byteRange != "" {
		req.Header.Set("Range", byteRange)
	}
	client := c.stream
	if client == nil {
		client = c.http
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		resp.Body.Close()
		return nil, fmt.Errorf("storage returned HTTP %d", resp.StatusCode)
	}
	return resp, nil
}

func (c *Client) Delete(ctx context.Context, storageRef string) error {
	key, valid := c.keyFromRef(storageRef)
	if !valid {
		return fmt.Errorf("invalid storage reference")
	}
	signed, err := c.signedURL(http.MethodDelete, key, time.Now().UTC().Add(30*time.Second))
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, signed, nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("storage returned HTTP %d", resp.StatusCode)
	}
	return nil
}

// ChatObject is a stored candidate for orphan cleanup, not an authorization
// record. LastModified is checked again against the minimum retention period.
type ChatObject struct {
	StorageRef   string
	LastModified time.Time
}

type bucketList struct {
	Objects []struct {
		Key          string    `xml:"Key"`
		LastModified time.Time `xml:"LastModified"`
	} `xml:"Contents"`
	NextToken string `xml:"NextContinuationToken"`
}

// ListChatObjects scans the chat-only prefix in bounded pages. Other product
// scopes (feed/story/profile) are never candidates for this cleanup.
func (c *Client) ListChatObjects(ctx context.Context, continuation string) ([]ChatObject, string, error) {
	if !c.Configured() {
		return nil, "", fmt.Errorf("storage not configured")
	}
	params := map[string]string{"list-type": "2", "prefix": prefix + "/chat/", "max-keys": strconv.Itoa(300)}
	if continuation != "" {
		params["continuation-token"] = continuation
	}
	signed, err := c.signedURLWithQuery(http.MethodGet, "", time.Now().UTC().Add(30*time.Second), params)
	if err != nil {
		return nil, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, signed, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("storage list returned HTTP %d", resp.StatusCode)
	}
	var listing bucketList
	if err := xml.NewDecoder(resp.Body).Decode(&listing); err != nil {
		return nil, "", err
	}
	objects := make([]ChatObject, 0, len(listing.Objects))
	for _, object := range listing.Objects {
		// Never delete objects outside chat, even if a provider returns
		// unexpected keys in response to a prefix-filtered S3 listing.
		if !strings.HasPrefix(object.Key, prefix+"/chat/") || object.LastModified.IsZero() {
			continue
		}
		objects = append(objects, ChatObject{
			StorageRef:   fmt.Sprintf("s3://%s/%s", c.bucket, object.Key),
			LastModified: object.LastModified,
		})
	}
	return objects, listing.NextToken, nil
}
