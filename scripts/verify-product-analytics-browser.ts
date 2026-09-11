// Local component QA fallback. Uses real read-only analytics data and the production Products
// component/theme/charts; it does not test the authenticated application shell or native devices.
import 'dotenv/config';
import { build } from 'esbuild';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { getSupplierAnalytics } from '../src/services/supplierAnalytics.service.js';

const prisma = new PrismaClient();
const frontend = resolve('../k03pr4p05-fe');
const environment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
const sample = await prisma.purchaseOrderSettlement.findFirstOrThrow({ where: { environment, status: 'SETTLED' }, orderBy: { settledAt: 'desc' } });
const day = new Date(sample.settledAt.valueOf() + 8 * 3600000).toISOString().slice(0, 10);
const bundle = await build({
  absWorkingDir: frontend, bundle: true, write: false, format: 'iife', platform: 'browser',
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
  loader: { '.js': 'jsx', '.ttf': 'dataurl', '.png': 'dataurl' },
  define: { __DEV__: 'false', global: 'globalThis', 'process.env.NODE_ENV': '"production"' },
  alias: { 'react-native': 'react-native-web', 'react-native-svg': resolve(frontend, 'node_modules/react-native-svg/src/ReactNativeSVG.web.ts') },
  plugins: [{ name: 'qa-api-boundary', setup(b) {
    b.onResolve({ filter: /apiClient$/ }, () => ({ path: 'qa-api', namespace: 'qa' }));
    b.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: 'export function graphQLRequest() { throw new Error("Use the QA read-only endpoint"); }' }));
  } }],
  stdin: { resolveDir: frontend, loader: 'tsx', contents: `
    import React, {useEffect,useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {View} from 'react-native';
    import {ThemeProvider,useTheme} from './contexts/ThemeContext';
    import ProductsAnalytics from './components/supplier/analytics/ProductsAnalytics';
    function App() {
      const {colors,toggleTheme}=useTheme();
      const [width,setWidth]=useState(window.innerWidth);
      const [data,setData]=useState(null);
      const [busy,setBusy]=useState(false);
      const [search,setSearch]=useState('');
      const [error,setError]=useState(false);
      const [options,setOptions]=useState({productPage:1,productLimit:20,productSort:'REVENUE',productDirection:'DESC'});
      useEffect(()=>{let live=true;setBusy(true);setError(false);fetch('/report?input='+encodeURIComponent(JSON.stringify({...options,search}))).then(r=>r.json()).then(d=>{if(live)setData(d)}).catch(()=>{if(live)setError(true)}).finally(()=>{if(live)setBusy(false)});return ()=>{live=false}},[options,search]);
      return <View onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={{backgroundColor:colors.background,padding:width<680?14:24,gap:16,minHeight:'100vh'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={toggleTheme}>QA: Toggle theme</button><button onClick={()=>setSearch(search?'':'__no_product_sales_qa__')}>QA: Toggle empty results</button><button onClick={()=>setOptions({...options})}>QA: Refresh</button></div>
        {error?<div>Unable to load QA data</div>:<ProductsAnalytics data={data} loading={!data} busy={busy} width={width} options={options} onOptionsChange={next=>setOptions({...options,...next,productPage:next.productPage??1})}/>}
      </View>
    }
    createRoot(document.getElementById('root')).render(<ThemeProvider><App/></ThemeProvider>);
  ` },
});
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1:9339');
    if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(bundle.outputFiles[0].contents); return; }
    if (url.pathname === '/report') {
      const input = JSON.parse(url.searchParams.get('input') ?? '{}');
      const data = await getSupplierAnalytics(prisma, sample.supplierOrgId, { ...input, startDate: day, endDate: day });
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#root{min-height:100vh}button{min-height:44px}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  } catch { res.statusCode = 500; res.end('{"error":"QA analytics unavailable"}'); }
});
server.listen(9339, '127.0.0.1', () => console.log('Products component QA: http://127.0.0.1:9339 (real settlement data, read-only)'));
process.on('SIGINT', () => { server.close(); void prisma.$disconnect().then(() => process.exit(0)); });
