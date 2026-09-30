package main

import "testing"

func TestDirectKeyIsOrderIndependent(t *testing.T) {
	if got, want := directKey(9, 2), "2:9"; got != want {
		t.Fatalf("directKey(9,2)=%q want %q", got, want)
	}
	if directKey(2, 9) != directKey(9, 2) {
		t.Fatal("directKey must be order independent")
	}
}
