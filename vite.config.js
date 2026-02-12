import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import suggestCaloriesHandler from './api/suggest-calories.js'

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (!process.env.OPENAI_API_KEY && env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
  }

  return {
    plugins: [
      react(),
      {
        name: 'local-api-routes',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url || !req.url.startsWith('/api/suggest-calories')) {
              return next()
            }

            if (req.method === 'POST') {
              req.body = await readJsonBody(req)
            }

            return suggestCaloriesHandler(req, res)
          })
        },
      },
    ],
  }
})
