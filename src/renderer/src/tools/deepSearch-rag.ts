export const runDeepResearch = async (query: string): Promise<string> => {
  try {
    window.dispatchEvent(new CustomEvent('deep-research-start', { detail: { query } }))

    const { getSecureKey } = await import('../config/secure-keys')
    const [tavilyKey, groqKey] = await Promise.all([
      getSecureKey('tavilyKey'),
      getSecureKey('groqKey')
    ])

    const result = await window.electron.ipcRenderer.invoke('execute-deep-research', {
      query,
      tavilyKey,
      groqKey
    })

    if (result.success) {
      window.dispatchEvent(
        new CustomEvent('deep-research-done', {
          detail: { success: true, summary: result.summary }
        })
      )
      return `✅ Research complete. Here is a summary of the data so you can inform the user: ${result.summary}`
    }

    window.dispatchEvent(new CustomEvent('deep-research-done', { detail: { success: false } }))
    return `❌ Research failed: ${result.error}`
  } catch (error) {
    const { hudAlert } = await import('../components/hudToastStore')
    hudAlert(`Deep research failed\n${String(error)}`, 'error')
    return `❌ System failure: ${String(error)}`
  }
}
