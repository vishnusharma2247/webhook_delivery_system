package delivery

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

// SignPayload generates an HMAC-SHA256 signature of the payload using the subscription secret
func SignPayload(payload []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}