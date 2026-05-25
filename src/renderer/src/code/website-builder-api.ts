import { getSecureKey } from '../config/secure-keys'

interface BuildAnimatedWebsiteResponse {
  success: boolean
  filePath?: string
  error?: string
}

export const buildAnimatedWebsite = async (prompt: string): Promise<string> => {
  try {
    const geminiKey = await getSecureKey('geminiKey')

    if (!geminiKey.trim()) {
      return `❌ System Error: Missing Gemini API Key. Please update it in the Command Center Vault.`
    }

    const res = (await window.electron.ipcRenderer.invoke('build-animated-website', {
      prompt,
      geminiKey
    })) as BuildAnimatedWebsiteResponse

    if (res.success) {
      return `✅ Website generated successfully and saved to ${res.filePath}.`
    } else {
      return `❌ System Error during synthesis: ${res.error}`
    }
  } catch {
    return `System Error: Unable to establish connection to the Live Forge.`
  }
}
