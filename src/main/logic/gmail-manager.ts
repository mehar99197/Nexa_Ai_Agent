import { IpcMain, app, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import process from 'process'
import { authenticate } from '@google-cloud/local-auth'
import { google, type gmail_v1 } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

const SCOPES = ['https://mail.google.com/']
const TOKEN_PATH = path.join(app.getPath('userData'), 'gmail_token.json')
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json')

type ParsedAttachment = { filename?: string; mimeType?: string; size?: number }
type ParsedMessage = { text: string; html: string; attachments: ParsedAttachment[] }
type GmailUiMessage = {
  id?: string
  from: string
  subject: string
  date: string
  preview?: string
  body: string
  attachments: ParsedAttachment[]
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export default function registerGmailHandlers(ipcMain: IpcMain): void {
  async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
    try {
      const content = await fs.readFile(TOKEN_PATH, 'utf-8')
      const credentials = JSON.parse(content)
      return google.auth.fromJSON(credentials) as OAuth2Client
    } catch (_error) {
      return null
    }
  }

  async function saveCredentials(client: OAuth2Client): Promise<void> {
    const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8')
    const keys = JSON.parse(content)
    const key = keys.installed || keys.web
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token
    })
    await fs.writeFile(TOKEN_PATH, payload)
  }

  async function authorize(): Promise<{ client: OAuth2Client | null; isNewLogin: boolean }> {
    let client = await loadSavedCredentialsIfExist()
    if (client) return { client, isNewLogin: false }

    client = (await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH
    })) as unknown as OAuth2Client
    if (client && client.credentials) {
      await saveCredentials(client)
    }

    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      mainWindow.setAlwaysOnTop(true)
      mainWindow.setAlwaysOnTop(false)
    }

    return { client, isNewLogin: true }
  }

  const makeEmail = (to: string, subject: string, body: string): string => {
    const str = [`To: ${to}`, `Subject: ${subject}`, '', body].join('\n')
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  function parseMessageParts(
    part: gmail_v1.Schema$MessagePart | undefined,
    result: ParsedMessage = { text: '', html: '', attachments: [] }
  ): ParsedMessage {
    if (!part) return result

    if (part.filename && part.filename.length > 0) {
      result.attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || undefined,
        size: part.body?.size ?? undefined
      })
    } else {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        result.text += Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        result.html += Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
    }

    if (part.parts && part.parts.length > 0) {
      for (const childPart of part.parts) {
        parseMessageParts(childPart, result)
      }
    }
    return result
  }

  ipcMain.removeHandler('gmail-read')
  ipcMain.handle('gmail-read', async (_event, maxResults = 5) => {
    try {
      const { client: auth, isNewLogin } = await authorize()
      if (!auth) throw new Error('Failed to authenticate.')

      const gmail = google.gmail({ version: 'v1', auth })
      const res = await gmail.users.messages.list({ userId: 'me', maxResults })
      const messages = res.data.messages || []

      const prefix = isNewLogin
        ? '[SYSTEM NOTICE: Gmail Login was just completed successfully. Tell the user this before reading the emails.]\n\n'
        : ''

      if (!messages.length) return { speechText: prefix + '📭 Inbox is empty.', uiData: [] }

      const emailListForNexa: string[] = []
      const uiDataArray: GmailUiMessage[] = []

      for (const msg of messages) {
        const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id! })
        const headers = fullMsg.data.payload?.headers || []

        const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject'
        const from = headers.find((h) => h.name === 'From')?.value || 'Unknown'
        const date = headers.find((h) => h.name === 'Date')?.value || ''
        const snippet = fullMsg.data.snippet || ''

        const parsed = parseMessageParts(fullMsg.data.payload)

        emailListForNexa.push(`📧 From: ${from}\nSubject: ${subject}\nPreview: ${snippet}\n`)

        uiDataArray.push({
          id: fullMsg.data.id || msg.id || undefined,
          from,
          subject,
          date,
          preview: snippet,
          body: parsed.html || parsed.text || snippet,
          attachments: parsed.attachments
        })
      }

      return {
        speechText: prefix + emailListForNexa.join('\n---\n'),
        uiData: uiDataArray
      }
    } catch (e: unknown) {
      return { speechText: `❌ Gmail Error: ${getErrorMessage(e)}`, uiData: [] }
    }
  })

  ipcMain.removeHandler('gmail-send')
  ipcMain.handle('gmail-send', async (_event, { to, subject, body }) => {
    try {
      const { client: auth, isNewLogin } = await authorize()
      if (!auth) throw new Error('Failed to authenticate.')
      const gmail = google.gmail({ version: 'v1', auth })
      const raw = makeEmail(to, subject, body)

      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })

      const prefix = isNewLogin ? '[SYSTEM NOTICE: Login successful.]\n\n' : ''
      return prefix + `✅ Email successfully sent to ${to}.`
    } catch (e: unknown) {
      return `❌ Send Error: ${getErrorMessage(e)}`
    }
  })

  ipcMain.removeHandler('gmail-draft')
  ipcMain.handle('gmail-draft', async (_event, { to, subject, body }) => {
    try {
      const { client: auth, isNewLogin } = await authorize()
      if (!auth) throw new Error('Failed to authenticate.')
      const gmail = google.gmail({ version: 'v1', auth })
      const raw = makeEmail(to, subject, body)

      await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw } } })

      const prefix = isNewLogin ? '[SYSTEM NOTICE: Login successful.]\n\n' : ''
      return prefix + `✅ Draft created for ${to}. You can review it in your Gmail.`
    } catch (e: unknown) {
      return `❌ Draft Error: ${getErrorMessage(e)}`
    }
  })
}
