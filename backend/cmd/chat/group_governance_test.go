package main

import (
	"strings"
	"testing"
)

func TestGroupPermissionMatrix(t *testing.T) {
	denied := groupGovernanceSettings{}
	allowed := groupGovernanceSettings{AdminCanInvite: true, AdminCanApprove: true, AdminCanEditInfo: true}
	for _, action := range []string{"invite", "approve", "edit", "audit"} {
		if !groupPermission("owner", denied, action) {
			t.Errorf("owner must be allowed to %s", action)
		}
		if groupPermission("member", allowed, action) {
			t.Errorf("member must not be allowed to %s", action)
		}
	}
	for _, action := range []string{"invite", "approve", "edit"} {
		if groupPermission("admin", denied, action) {
			t.Errorf("disabled admin permission %s was granted", action)
		}
		if !groupPermission("admin", allowed, action) {
			t.Errorf("enabled admin permission %s was refused", action)
		}
	}
	if !groupPermission("admin", denied, "audit") {
		t.Fatal("admins should read the audit trail")
	}
	if groupPermission("admin", allowed, "unknown") {
		t.Fatal("unknown permissions must default to deny")
	}
}

func TestInviteTokenHash(t *testing.T) {
	token := strings.Repeat("a1", 32)
	hash, ok := inviteHash(token)
	if !ok || len(hash) != 64 || hash == token {
		t.Fatal("invite token must become a separate fixed-length hash")
	}
	hash2, ok := inviteHash(token)
	if !ok || hash != hash2 {
		t.Fatal("same invite token must produce stable hash")
	}
	for _, value := range []string{"", "short", strings.Repeat("z", 64), strings.Repeat("ab", 31), strings.Repeat("0", 65)} {
		if _, valid := inviteHash(value); valid {
			t.Errorf("accepted malformed invitation token: %q", value)
		}
	}
}
