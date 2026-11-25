package config

import (
	"fmt"
	"os"
	"strings"
)

const localEnvironment = "local"

var localSecretFallbacks = map[string]string{
	"JWT_SECRET": "chatnet-local-jwt-secret",
	"OTP_PEPPER": "chatnet-local-otp-pepper",
}

func Env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func RequiredSecret(key string) (string, error) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value, nil
	}
	if strings.EqualFold(strings.TrimSpace(os.Getenv("CHATNET_ENV")), localEnvironment) {
		if value, ok := localSecretFallbacks[key]; ok {
			return value, nil
		}
	}
	return "", fmt.Errorf("required secret %s is not configured", key)
}
