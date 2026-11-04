// Local-only demonstration: isolated PGlite, no dotenv and no real pg pools.
import { createServer } from 'vite';
process.env.ITAM_MOCK_PORT='4320';
await import('./mock-api.ts');
const vite=await createServer({server:{host:'127.0.0.1',port:4321,strictPort:true,proxy:{'/api':'http://127.0.0.1:4320'}}});
await vite.listen();
console.log('Preview local: http://127.0.0.1:4321');
