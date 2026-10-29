import assert from 'node:assert/strict'
import { SessionResponseCache, mutationTags } from '../src/shared/lib/sessionCache.ts'
const cache=new SessionResponseCache()
let calls=0
const load=async()=>{calls++;return Response.json({n:calls})}
const a=await cache.read('a','/api/posts?limit=15',load)
assert.deepEqual(await a.json(),{n:1})
assert.deepEqual(await (await cache.read('a','/api/posts?limit=15',load)).json(),{n:1})
assert.equal(calls,1)
await cache.read('a','/api/posts?limit=15&scope=mine',load)
assert.equal(calls,2,'scope must have a separate cache key')
await cache.read('a','/api/posts?limit=15',load,true)
assert.equal(calls,3,'explicit reload bypasses cache')
cache.invalidate(mutationTags('/api/friends/2'))
await cache.read('a','/api/posts?limit=15',load)
assert.equal(calls,4,'relationship changes invalidate visibility-sensitive data')
await cache.read('b','/api/posts?limit=15',load)
assert.equal(calls,5,'accounts never share cached data')
cache.clear()
let finish
let started=0
const delayed=()=>{started++;return new Promise(resolve=>{finish=resolve})}
const one=cache.read('a','/api/profile',delayed)
const two=cache.read('a','/api/profile',delayed)
finish(Response.json({name:'An'}))
const responses=await Promise.all([one,two])
assert.equal(started,1)
assert.deepEqual(await responses[0].json(),await responses[1].json(),'each consumer has its own response body')
let complete
const stale=cache.read('a','/api/posts',()=>new Promise(resolve=>{complete=resolve}))
cache.invalidate(['feed'])
complete(Response.json({old:true}))
await assert.rejects(stale,/thay đổi/)
await cache.read('a','/api/posts',load)
const before=calls
const realNow=Date.now
try{
 Date.now=()=>realNow()+60000
 await cache.read('a','/api/posts',load)
 assert.equal(calls,before+1,'expired data is revalidated')
}finally{Date.now=realNow}
const failures=new SessionResponseCache()
let failedCalls=0
const fail=async()=>{failedCalls++;return Response.json({error:'offline'},{status:503})}
await failures.read('a','/api/profile',fail)
await failures.read('a','/api/profile',fail)
assert.equal(failedCalls,2,'errors must never be cached')
const uncachedBefore=calls
await cache.read('a','/api/privacy',load)
await cache.read('a','/api/privacy',load)
await cache.read('a','/api/conversations/1/messages',load)
await cache.read('a','/api/conversations/1/messages',load)
assert.equal(calls,uncachedBefore+4,'privacy and message reads remain fresh')
// A zero-TTL resource still deduplicates simultaneous reads, without reusing later responses.
let releaseMessages
let messageLoads=0
const messageLoader=()=>{messageLoads++;return new Promise(resolve=>{releaseMessages=resolve})}
const messageOne=cache.read('a','/api/conversations/9/messages',messageLoader)
const messageTwo=cache.read('a','/api/conversations/9/messages',messageLoader)
releaseMessages(Response.json([]))
await Promise.all([messageOne,messageTwo])
assert.equal(messageLoads,1)
let releaseOld
cache.clear()
const oldSession=cache.read('a','/api/profile',()=>new Promise(resolve=>{releaseOld=resolve}))
cache.clear()
releaseOld(Response.json({private:true}))
await assert.rejects(oldSession,/thay đổi/)
console.log('PASS: session isolation, deduplication, independent bodies, TTL, forced refresh, selective invalidation, stale-request protection and error recovery')
