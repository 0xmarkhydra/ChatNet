package main

import (
 "math"
 "net/http"
 "net/http/httptest"
 "testing"
)

func TestMarketQuote(t *testing.T) {
 valid := []marketQuoteLine{
  {ID:1,Price:150,Unit:"TEST",Stock:5,Quantity:2},
  {ID:2,Price:75,Unit:"TEST",Stock:3,Quantity:1},
 }
 total,unit,err:=marketQuote(valid)
 if err!=nil||total!=375||unit!="TEST"{t.Fatalf("total=%d unit=%q err=%v",total,unit,err)}
 cases:=[]struct{name string;lines []marketQuoteLine}{
  {"empty",nil},
  {"out of stock",[]marketQuoteLine{{Price:100,Unit:"TEST",Stock:0,Quantity:1}}},
  {"mixed units",[]marketQuoteLine{{Price:100,Unit:"TEST",Stock:1,Quantity:1},{Price:1,Unit:"OTHER",Stock:1,Quantity:1}}},
  {"overflow multiplication",[]marketQuoteLine{{Price:math.MaxInt64,Unit:"TEST",Stock:2,Quantity:2}}},
  {"overflow sum",[]marketQuoteLine{{Price:math.MaxInt64,Unit:"TEST",Stock:1,Quantity:1},{Price:1,Unit:"TEST",Stock:1,Quantity:1}}},
  {"zero quantity",[]marketQuoteLine{{Price:10,Unit:"TEST",Stock:2,Quantity:0}}},
 }
 for _,tc:=range cases {
  t.Run(tc.name,func(t *testing.T){if _,_,err:=marketQuote(tc.lines);err==nil{t.Fatal("expected rejected quote")}})
 }
}

func TestMarketplaceEndpointsRequireAuthentication(t *testing.T){
 mux:=http.NewServeMux()
 s:=&server{jwtSecret:"test-jwt"}
 s.mountMarketplace(mux)
 for _,tc:=range []struct{method,path string}{
  {"GET","/api/marketplace/products"},
  {"POST","/api/marketplace/products"},
  {"GET","/api/marketplace/cart"},
  {"PUT","/api/marketplace/cart/1"},
  {"DELETE","/api/marketplace/cart/1"},
  {"POST","/api/marketplace/orders"},
  {"GET","/api/marketplace/orders"},
 }{
  req:=httptest.NewRequest(tc.method,tc.path,nil)
  res:=httptest.NewRecorder()
  mux.ServeHTTP(res,req)
  if res.Code!=http.StatusUnauthorized{t.Errorf("%s %s got %d",tc.method,tc.path,res.Code)}
 }
}

func TestPaymentRemainsUnconfigured(t *testing.T){
 if payment:=marketPaymentPending;payment!="awaiting_payment_configuration"{t.Fatal("payment unexpectedly enabled")}
}
