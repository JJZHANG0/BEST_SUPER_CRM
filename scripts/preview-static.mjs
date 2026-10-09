import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('out');const base='/BEST_SUPER_CRM';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.pdf':'application/pdf','.webmanifest':'application/manifest+json','.txt':'text/plain'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname===base){res.writeHead(302,{Location:base+'/'});return res.end()}if(!url.pathname.startsWith(base+'/')){res.writeHead(404);return res.end('Not found')};const suffix=decodeURIComponent(url.pathname.slice(base.length));let file=path.resolve(root,'.'+suffix);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()};if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404);res.end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('Static preview: http://127.0.0.1:4173/BEST_SUPER_CRM/'));
