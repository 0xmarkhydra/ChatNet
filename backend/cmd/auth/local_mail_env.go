package main

import (
	"bufio"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// parseLocalMailEnv reads only the email sender settings. Never pass the
// database, Redis, or JWT settings from a developer's .env into this process.
func parseLocalMailEnv(input io.Reader) map[string]string {
	values := make(map[string]string, 3)
	scanner := bufio.NewScanner(input)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, raw, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		switch key {
		case "RESEND_API_KEY", "CHATNET_EMAIL_FROM", "RESEND_API_BASE_URL":
		default:
			continue
		}
		raw = strings.TrimSpace(raw)
		if len(raw) >= 2 && raw[0] == '"' && raw[len(raw)-1] == '"' {
			if unquoted, err := strconv.Unquote(raw); err == nil {
				raw = unquoted
			}
		} else if len(raw) >= 2 && raw[0] == '\'' && raw[len(raw)-1] == '\'' {
			raw = raw[1 : len(raw)-1]
		} else if index := strings.Index(raw, " #"); index >= 0 {
			raw = strings.TrimSpace(raw[:index])
		}
		if raw != "" {
			values[key] = raw
		}
	}
	return values
}

// localMailEnv is a local-development convenience, not a production config
// source. Production must provide explicit env vars. In particular, never
// import DATABASE_URL or JWT_SECRET from another checkout.
func localMailEnv() map[string]string {
	if os.Getenv("DATABASE_URL") != "" ||
		os.Getenv("RAILWAY_ENVIRONMENT") != "" ||
		os.Getenv("RAILWAY_PROJECT_ID") != "" {
		return nil
	}
	cwd, err := os.Getwd()
	if err != nil {
		return nil
	}
	missing := map[string]bool{}
	for _, key := range []string{"RESEND_API_KEY", "CHATNET_EMAIL_FROM", "RESEND_API_BASE_URL"} {
		missing[key] = strings.TrimSpace(os.Getenv(key)) == ""
	}
	result := make(map[string]string)
	for _, relative := range []string{".env", "../.env", "../../../../.env"} {
		file, err := os.Open(filepath.Join(cwd, relative))
		if err != nil {
			continue
		}
		parsed := parseLocalMailEnv(file)
		_ = file.Close()
		for key, value := range parsed {
			if missing[key] && result[key] == "" {
				result[key] = value
			}
		}
		if result["RESEND_API_KEY"] != "" && result["CHATNET_EMAIL_FROM"] != "" {
			break
		}
	}
	if result["RESEND_API_KEY"] != "" && result["CHATNET_EMAIL_FROM"] != "" {
		log.Print("auth: local email provider configuration loaded (credentials hidden)")
	}
	return result
}
