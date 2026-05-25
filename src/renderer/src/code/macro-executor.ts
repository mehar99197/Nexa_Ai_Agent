interface MacroNode {
  id: string
  data: {
    tool: {
      name: string
    }
    inputs?: Partial<MacroArgs>
  }
}

interface MacroEdge {
  source: string
  target: string
}

interface MacroWorkflow {
  name: string
  nodes: MacroNode[]
  edges: MacroEdge[]
}

interface LoadWorkflowsResult {
  workflows?: MacroWorkflow[]
}

type MacroArgs = Record<string, string | string[] | undefined> & {
  app_name: string
  name: string
  message: string
  file_path: string
  query: string
  command: string
  path: string
  text: string
  to: string
  subject: string
  body: string
  direction: 'up' | 'down'
  key: string
  modifiers?: string | string[]
}

interface MacroStep {
  tool: string
  args: MacroArgs
}

// Exported so consumers can narrow against the same union the function returns.
// (Without export, TS may resolve cross-file callers as the inferred return
// type and lose the discriminant in some configurations.)
export type MacroSequenceResult =
  | { success: true; name: string; steps: MacroStep[] }
  | { success: false; error: string }

export const getMacroSequence = async (macroName: string): Promise<MacroSequenceResult> => {
  try {
    const workflowsRes = (await window.electron.ipcRenderer.invoke(
      'load-workflows'
    )) as LoadWorkflowsResult
    const workflows = workflowsRes.workflows || []

    if (workflows.length === 0) return { success: false, error: `No macros exist.` }

    // First: exact match (case-insensitive)
    let macro = workflows.find(
      (w) => w.name.toLowerCase().trim() === macroName.toLowerCase().trim()
    )

    // Second: substring match
    if (!macro) {
      const targetLower = macroName.toLowerCase().trim()
      macro = workflows.find(
        (w) =>
          w.name.toLowerCase().includes(targetLower) || targetLower.includes(w.name.toLowerCase())
      )
    }

    if (!macro) {
      const availableMacros = workflows.map((w) => `"${w.name}"`).join(', ')
      return {
        success: false,
        error: `ERROR: Macro '${macroName}' not found. Available: [ ${availableMacros} ]. Re-call the tool silently with the exact name.`
      }
    }

    const sequence: MacroStep[] = []

    // Find the entry point: TRIGGER_VOICE, TRIGGER, or first node
    const triggerNode =
      macro.nodes.find(
        (n) => n.data.tool.name === 'TRIGGER_VOICE' || n.data.tool.name === 'TRIGGER'
      ) || macro.nodes[0]

    const queue = [triggerNode]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const currentNode = queue.shift()
      if (!currentNode || visited.has(currentNode.id)) continue
      visited.add(currentNode.id)

      const toolName = currentNode.data.tool.name
      const inputs = (currentNode.data.inputs || {}) as MacroArgs

      // Skip trigger nodes (both types)
      if (toolName !== 'TRIGGER_VOICE' && toolName !== 'TRIGGER') {
        sequence.push({ tool: toolName, args: inputs })
      }

      const outgoingEdges = macro.edges.filter((e) => e.source === currentNode.id)
      for (const edge of outgoingEdges) {
        const nextNode = macro.nodes.find((n) => n.id === edge.target)
        if (nextNode) queue.push(nextNode)
      }
    }

    return { success: true, name: macro.name, steps: sequence }
  } catch (err) {
    return { success: false, error: `Failed to load macro: ${String(err)}` }
  }
}
