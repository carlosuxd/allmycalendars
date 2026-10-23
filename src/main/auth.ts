import { shell } from 'electron'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { randomBytes } from 'crypto'
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library'
import * as store from './store'
import type { Account } from '@shared/types'

const CLIENT_ID = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID as string | undefined
// For "Desktop app" OAuth clients Google treats the secret as non-confidential.
const CLIENT_SECRET = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET as string | undefined

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly']
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && !CLIENT_ID.startsWith('your-'))
}

function newClient(redirectUri?: string): OAuth2Client {
  return new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri })
}

const clients = new Map<string, OAuth2Client>()

/** An authorized client for a saved account; refreshes access tokens automatically. */
export function clientFor(email: string): OAuth2Client {
  let client = clients.get(email)
  if (!client) {
    const refreshToken = store.getRefreshToken(email)
    if (!refreshToken) throw new Error(`No saved sign-in for ${email}`)
    client = newClient()
    client.setCredentials({ refresh_token: refreshToken })
    clients.set(email, client)
  }
  return client
}

export function forget(email: string): void {
  clients.delete(email)
}

const page = (title: string, body: string): string =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>
  <body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#f6f7f9;color:#1c2024">
  <div style="text-align:center"><h2>${title}</h2><p>${body}</p></div></body>`

/**
 * Signs in a Google account using the system browser, PKCE and a loopback
 * redirect, as Google recommends for desktop apps.
 */
export async function signIn(): Promise<Account> {
  if (!isConfigured()) throw new Error('Google client ID is not configured. See README.md.')

  const state = randomBytes(16).toString('hex')
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const client = newClient(redirectUri)
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync()

  try {
    const code = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Sign-in timed out')), SIGN_IN_TIMEOUT_MS)
      server.on('request', (req, res) => {
        const url = new URL(req.url ?? '/', redirectUri)
        if (url.pathname !== '/') {
          res.writeHead(404).end()
          return
        }
        const error = url.searchParams.get('error')
        const got = url.searchParams.get('code')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        if (error || !got || url.searchParams.get('state') !== state) {
          res.end(page('Sign-in failed', 'You can close this tab and try again.'))
          clearTimeout(timer)
          reject(new Error(error ?? 'Sign-in was cancelled'))
          return
        }
        res.end(page('Signed in', 'You can close this tab and return to All My Calendars.'))
        clearTimeout(timer)
        resolve(got)
      })
      void shell.openExternal(
        client.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent select_account', // always returns a refresh token and lets you pick the account
          scope: SCOPES,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: CodeChallengeMethod.S256
        })
      )
    })

    const { tokens } = await client.getToken({ code, codeVerifier })
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token')
    if (!tokens.scope?.includes('calendar.readonly')) {
      throw new Error('Calendar access was not granted. Tick the calendar checkbox on the Google consent screen.')
    }
    // The ID token comes straight from Google's token endpoint over TLS, so reading it is safe.
    const payload = JSON.parse(Buffer.from(tokens.id_token!.split('.')[1], 'base64url').toString('utf8'))
    const email = String(payload.email)

    clients.delete(email)
    return store.saveAccount(email, tokens.refresh_token)
  } finally {
    server.close()
  }
}
