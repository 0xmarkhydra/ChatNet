package main

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"

 "chatnet/internal/authx"
)

func TestFeedVisibilityAndBackgroundValidation(t *testing.T){
 for _,v:=range []string{"public","friends","private"} {
  if !validVisibility(v) {t.Errorf("expected visibility %q",v)}
 }
 for _,v:=range []string{"","PUBLIC","everyone","public; DROP TABLE posts"} {
  if validVisibility(v) {t.Errorf("unexpected visibility %q",v)}
 }
 for _,v:=range []string{"","violet","blue","sunset","mint","night"} {
  if !validBackground(v){t.Errorf("expected background %q",v)}
 }
 for _,v:=range []string{"black","url(javascript:)","../../root"} {
  if validBackground(v){t.Errorf("unexpected background %q",v)}
 }
}

func TestFeedManagementInvalidIDs(t *testing.T){
 s:=&server{}
 for _,value:=range []string{"0","-1","not-id","999999999999999999999"} {
  for _,call:=range []struct{method,path string;handler http.HandlerFunc}{
   {"GET","/api/posts/"+value,s.detailPost},
   {"PATCH","/api/posts/"+value,s.editPost},
   {"DELETE","/api/posts/"+value,s.deletePost},
   {"POST","/api/posts/"+value+"/save",s.toggleSave},
  }{
   w:=httptest.NewRecorder();r:=httptest.NewRequest(call.method,call.path,nil);r.SetPathValue("id",value)
   call.handler(w,r)
   if w.Code!=400{t.Errorf("%s %s got %d expected 400",call.method,call.path,w.Code)}
  }
 }
}

func TestFeedManagementInvalidInput(t *testing.T){
 token,err:=authx.Sign("feed-test-secret",12,"reviewer","reviewer")
 if err!=nil {t.Fatal(err)}
 s:=&server{}
 handler:=http.NewServeMux()
 handler.Handle("PATCH /api/posts/{id}",authx.Middleware("feed-test-secret",http.HandlerFunc(s.editPost)))
 handler.Handle("POST /api/feed/reports",authx.Middleware("feed-test-secret",http.HandlerFunc(s.reportFeed)))
 cases:=[]struct{path,method,body string}{
  {"/api/posts/1","PATCH",`{"content":"hello","visibility":"anyone"}`},
  {"/api/posts/1","PATCH",`{"content":"hello","visibility":"public","background":"javascript"}`},
  {"/api/posts/1","PATCH",`{"content":"hello","visibility":"public","extra":true}`},
  {"/api/feed/reports","POST",`{"targetType":"message","targetId":1,"reason":"Spam post"}`},
  {"/api/feed/reports","POST",`{"targetType":"post","targetId":0,"reason":"Spam post"}`},
  {"/api/feed/reports","POST",`{"targetType":"post","targetId":1,"reason":"x"}`},
  {"/api/feed/reports","POST",`{"targetType":"post","targetId":1,"reason":"Spam post","extra":1}`},
 }
 for _,tc:=range cases{
  r:=httptest.NewRequest(tc.method,tc.path,strings.NewReader(tc.body))
  r.Header.Set("Authorization","Bearer "+token)
  w:=httptest.NewRecorder();handler.ServeHTTP(w,r)
  if w.Code!=400{t.Errorf("%s %s got %d expected 400: %s",tc.method,tc.body,w.Code,w.Body.String())}
 }
}
