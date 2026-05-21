export const getMacroSequence = async (macroName: string) => {
  try {
    const workflowsRes = await (window as any).electron.ipcRenderer.invoke('load-workflows')
    const workflows = workflowsRes.workflows || []

    if (workflows.length === 0) return { success: false, error: `No macros exist.` }

    // First: exact match (case-insensitive)
    let macro = workflows.find(
      (w: any) => w.name.toLowerCase().trim() === macroName.toLowerCase().trim()
    )

    // Second: substring match
    if (!macro) {
      const targetLower = macroName.toLowerCase().trim()
      macro = workflows.find(
        (w: any) =>
          w.name.toLowerCase().includes(targetLower) || targetLower.includes(w.name.toLowerCase())
      )
    }

    if (!macro) {
      const availableMacros = workflows.map((w: any) => `"${w.name}"`).join(', ')
      return {
        success: false,
        error: `ERROR: Macro '${macroName}' not found. Available: [ ${availableMacros} ]. Re-call the tool silently with the exact name.`
      }
    }

    let sequence: any = []

    // Find the entry point: TRIGGER_VOICE, TRIGGER, or first node
    const triggerNode = macro.nodes.find(
      (n: any) => n.data.tool.name === 'TRIGGER_VOICE' || n.data.tool.name === 'TRIGGER'
    ) || macro.nodes[0]

    let queue = [triggerNode]
    let visited = new Set()

    while (queue.length > 0) {
      let currentNode = queue.shift()
      if (!currentNode || visited.has(currentNode.id)) continue
      visited.add(currentNode.id)

      const toolName = currentNode.data.tool.name
      const inputs = currentNode.data.inputs || {}

      // Skip trigger nodes (both types)
      if (toolName !== 'TRIGGER_VOICE' && toolName !== 'TRIGGER') {
        sequence.push({ tool: toolName, args: inputs })
      }

      const outgoingEdges = macro.edges.filter((e: any) => e.source === currentNode.id)
      for (const edge of outgoingEdges) {
        const nextNode = macro.nodes.find((n: any) => n.id === edge.target)
        if (nextNode) queue.push(nextNode)
      }
    }

    return { success: true, name: macro.name, steps: sequence }
  } catch (err) {
    return { success: false, error: `Failed to load macro: ${String(err)}` }
  }
}
