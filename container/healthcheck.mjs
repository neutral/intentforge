import http from 'node:http';
const origin = new URL(process.env.INTENTFORGE_ORIGIN ?? 'http://127.0.0.1:4800');
const request = http.get({host:'127.0.0.1',port:4800,path:'/healthz',headers:{Host:origin.host},timeout:3500}, response => {
  response.resume(); response.on('end',()=>process.exit(response.statusCode === 200 ? 0 : 1));
});
request.on('error',()=>process.exit(1));
request.on('timeout',()=>{request.destroy();process.exit(1);});
