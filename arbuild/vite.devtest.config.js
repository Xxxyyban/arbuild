// TEMP-DEVTEST: plain-HTTP dev server with stand-in users and in-memory data, for the showcase.
// Nothing here talks to Firebase: auth, classes, lab sessions and the admin's accounts are mocked.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'

const root = process.cwd()
const mock = (f) => path.resolve(root, 'src/__devmocks__', f)
const swap = {
  [path.resolve(root, 'src/context/AuthContext.jsx')]: mock('AuthContext.jsx'),
  [path.resolve(root, 'src/lab/Classes.js')]: mock('Classes.js'),
  [path.resolve(root, 'src/lab/Sessions.js')]: mock('Sessions.js'),
  [path.resolve(root, 'src/lab/useLabSession.js')]: mock('useLabSession.js'),
  [path.resolve(root, 'src/lab/People.js')]: mock('People.js'),
  [path.resolve(root, 'src/lab/SignIns.js')]: mock('SignIns.js'),
  [path.resolve(root, 'src/lab/Announcements.js')]: mock('Announcements.js'),
  [path.resolve(root, 'src/lab/Visits.js')]: mock('Visits.js'),
}
// the admin page talks to Firebase directly
const ADMIN = path.resolve(root, 'src/pages/Admin.jsx')
const ADMIN_SWAP = { 'firebase/firestore': mock('adminFirebase.js'), 'firebase/auth': mock('adminFirebase.js'), 'firebase/app': mock('adminFirebase.js') }

const devMocks = {
  name: 'dev-mocks',
  enforce: 'pre',
  async resolveId(source, importer) {
    if (source.endsWith('?real')) return path.resolve(root, source.replace(/^\//, '').replace('?real', ''))
    if (!importer || importer.includes('__devmocks__')) return null
    // a URL the browser asks for (/src/...) is always the real file; only the app's own imports are swapped
    if (source.startsWith('/')) return null
    if (path.resolve(importer.split('?')[0]) === ADMIN && ADMIN_SWAP[source]) return ADMIN_SWAP[source]
    const r = await this.resolve(source, importer, { skipSelf: true })
    if (r && swap[path.resolve(r.id)]) return swap[path.resolve(r.id)]
    return null
  },
}
// the WebGL profiler (window.__glstats), before the app's own scripts
const glprof = {
  name: 'glprof',
  transformIndexHtml: (html) => html.replace('<head>', '<head><script>' + fs.readFileSync(mock('glprof.js'), 'utf8') + '</script>'),
}
export default defineConfig({ plugins: [devMocks, glprof, react()], server: { host: true, allowedHosts: true } })
