/** GreenRev Roadtrip local static server + Paystack TEST ONLY integration.
 * Node.js 20+. No third-party dependencies. No live-key support.
 * IMPORTANT: local prototype, not a production wallet system.
 */
'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=__dirname;
// Tiny .env reader; no packages or keys in frontend.
if(fs.existsSync(path.join(root,'.env'))){
 for(const line of fs.readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/)){
  const m=line.match(/^([A-Z_]+)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
 }
}
const PORT=Number(process.env.PORT||5173);
const secret=process.env.PAYSTACK_TEST_SECRET||'';
if(secret&&!secret.startsWith('sk_test_'))throw Error('SAFETY: Only sk_test_ Paystack keys are accepted. Do not use live keys.');
const BASE=process.env.PAYSTACK_API_BASE||'https://api.paystack.co';
if(BASE!=='https://api.paystack.co'&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE))throw Error('API base override only allowed on localhost for integration tests.');
const ledgerPath=path.join(root,'.local-test-payments.json');
let ledger={};try{ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'))}catch(_){}
const packs={5000000:100,25000000:250,100000000:500};
function saveLedger(){fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2),{mode:0o600})}
function respond(res,code,obj){const data=JSON.stringify(obj);res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(data),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data)}
function collect(req){return new Promise((resolve,reject)=>{let chunks='',bytes=0;req.on('data',part=>{bytes+=part.length;if(bytes>8192){reject(Error('Request too large'));req.destroy();return}chunks+=part});req.on('end',()=>{try{resolve(JSON.parse(chunks))}catch{reject(Error('Invalid JSON'))}});req.on('error',reject)})}
async function paystack(url,method='GET',data){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);try{
 const r=await fetch(BASE+url,{method,headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:controller.signal});const result=await r.json();if(!r.ok||!result.status)throw Error(String(result.message||'Paystack request failed'));return result.data;
}finally{clearTimeout(timer)}}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.md':'text/plain; charset=utf-8'};
const publicFiles=new Set(['index.html','game.js','world3d.js','styles.css','favicon.svg']);
const server=http.createServer(async(req,res)=>{
 try{
 const u=new URL(req.url,'http://localhost:'+PORT);
 if(u.pathname==='/api/config'&&req.method==='GET')return respond(res,200,{provider:'Paystack',mode:'TEST ONLY',configured:secret.startsWith('sk_test_')});
 if(u.pathname==='/api/payments/initialize'&&req.method==='POST'){
  if(!secret)return respond(res,503,{error:'Paystack test mode is not configured. Add PAYSTACK_TEST_SECRET=sk_test_… to .env and restart node server.js. No real money is needed.'});
  const data=await collect(req),credit=Number(data.credit),email=String(data.email||'').trim();
  if(!Object.hasOwn(packs,credit)||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||email.length>160)return respond(res,400,{error:'Valid email and test package required.'});
  const amount=packs[credit]*100,reference='GRTEST_'+crypto.randomUUID().replace(/-/g,'');
  // Paystack redirect returns to THIS local test game. A public HTTPS URL may be required in some environments.
  const callback='http://localhost:'+PORT+'/';
  ledger[reference]={credit,amount,currency:'NGN',email,status:'pending',created:new Date().toISOString()};saveLedger();
  const result=await paystack('/transaction/initialize','POST',{email,amount,currency:'NGN',reference,callback_url:callback,metadata:{custom_fields:[{display_name:'GreenRev Test Credits',variable_name:'game_credit',value:String(credit)}]}});
  if(!/^https:\/\/checkout\.paystack\.com\/[A-Za-z0-9]+/.test(result.authorization_url||''))throw Error('Unexpected checkout URL from Paystack');
  return respond(res,200,{reference,checkout_url:result.authorization_url});
 }
 if(u.pathname==='/api/payments/verify'&&req.method==='GET'){
  if(!secret)return respond(res,503,{error:'Paystack test key is not configured.'});
  const reference=u.searchParams.get('reference')||'';if(!/^GRTEST_[a-f0-9]{32}$/.test(reference))return respond(res,400,{error:'Bad payment reference.'});
  const entry=ledger[reference];if(!entry)return respond(res,404,{error:'This payment reference was not initiated by your local GreenRev server.'});
  const result=await paystack('/transaction/verify/'+encodeURIComponent(reference));
  const same=result.reference===reference&&result.status==='success'&&result.domain==='test'&&result.amount===entry.amount&&result.currency===entry.currency&&String(result.customer?.email||'').toLowerCase()===entry.email.toLowerCase();
  if(!same)return respond(res,409,{verified:false,error:'Payment pending/failed, or the provider response did not match the expected test amount, currency, email and reference.'});
  if(entry.status!=='verified'){entry.status='verified';entry.verified=new Date().toISOString();saveLedger()}
  return respond(res,200,{verified:true,credit:entry.credit,reference});
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return respond(res,405,{error:'Method not allowed'});
 const filename=(u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1)));
 if(!publicFiles.has(filename))return respond(res,404,{error:'Not found'});
 const target=path.join(root,filename);if(!fs.existsSync(target))return respond(res,404,{error:'Missing asset '+filename});
 res.writeHead(200,{'Content-Type':MIME[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 fs.createReadStream(target).pipe(res);
 }catch(err){console.error('Server error:',err.message);if(!res.headersSent)respond(res,500,{error:err.message||'Server failed'})}
});
server.listen(PORT,'127.0.0.1',()=>console.log('GreenRev local game: http://localhost:'+PORT+' | Paystack TEST configured: '+Boolean(secret)));
