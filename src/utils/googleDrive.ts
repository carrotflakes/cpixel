// Minimal Google Drive client using Google Identity Services (GIS) and REST
// No gapi client or Picker API required. We request the `drive.file` scope
// so the app can create and manage its own files in the user's Drive.

type DriveFile = { id: string; name: string; modifiedTime?: string }

let gisLoaded = false
let token: string | null = null
let tokenClient: any | null = null

function loadGIS(): Promise<void> {
  if (gisLoaded) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const id = 'google-identity-services'
    if (document.getElementById(id)) { gisLoaded = true; resolve(); return }
    const s = document.createElement('script')
    s.id = id
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => { gisLoaded = true; resolve() }
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(s)
  })
}

export const GoogleDrive = {
  isReady(): boolean {
    return !!tokenClient
  },
  isSignedIn(): boolean {
    return !!token
  },
  async init(clientId?: string): Promise<void> {
    if (!clientId) return // silently no-op; UI can show disabled state
    await loadGIS()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = (window as any).google
    if (!g?.accounts?.oauth2) throw new Error('GIS not available')
    tokenClient = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (res: any) => {
        if (res?.access_token) token = res.access_token
      },
    })
  },
  async signIn(prompt: 'consent' | 'none' = 'consent'): Promise<string> {
    if (!tokenClient) throw new Error('Drive not initialized')
    return new Promise<string>((resolve, reject) => {
      try {
        tokenClient!.requestAccessToken({ prompt, scope: 'https://www.googleapis.com/auth/drive.file' })
        const check = () => {
          if (token) resolve(token)
          else setTimeout(check, 50)
        }
        check()
      } catch (e) { reject(e) }
    })
  },
  async ensureToken(): Promise<string> {
    if (token) return token
    return this.signIn('consent')
  },
  async signOut(): Promise<void> {
    if (!token) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = (window as any).google
    if (g?.accounts?.oauth2?.revoke) {
      try { await g.accounts.oauth2.revoke(token) } catch { }
    }
    token = null
  },
  async listFiles(querySuffix?: string): Promise<DriveFile[]> {
    const tk = await this.ensureToken()
    const q = [`mimeType = 'application/json'`, 'trashed = false']
    // If a name filter is provided, apply it; otherwise, show all JSON files accessible to the app.
    // With drive.file scope, this will list only files created or opened by this app.
    if (querySuffix) {
      const esc = (s: string) => s.replace(/'/g, "\\'")
      q.push(`name contains '${esc(querySuffix)}'`)
    }
    const params = new URLSearchParams({
      q: q.join(' and '),
      fields: 'files(id,name,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: '50',
      spaces: 'drive',
    })
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${tk}` },
    })
    if (!res.ok) throw new Error(`Drive list failed: ${res.status}`)
    const json = await res.json()
    return (json.files || []) as DriveFile[]
  },
  async openFile(fileId: string): Promise<unknown> {
    const tk = await this.ensureToken()
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${tk}` },
    })
    if (!res.ok) throw new Error(`Drive download failed: ${res.status}`)
    return await res.json()
  },
  async saveJSON(name: string, data: unknown, fileId?: string): Promise<{ id: string; name: string }> {
    const tk = await this.ensureToken()
    const meta = { name, mimeType: 'application/json', appProperties: { app: 'cpixel' } }
    const boundary = 'cpixel-' + Math.random().toString(36).slice(2)
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelim = `\r\n--${boundary}--`
    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(meta) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(data) +
      closeDelim
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
    const method = fileId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${tk}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    })
    if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`)
    const out = await res.json()
    return { id: out.id, name: out.name }
  },
}

export type { DriveFile }
