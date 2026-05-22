import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs/promises'

interface Workflow {
  name: string
  description: string
  nodes: unknown[]
  edges: unknown[]
  updatedAt: number
}

interface WorkflowInput {
  name: string
  description: string
  nodes: unknown[]
  edges: unknown[]
}

interface WorkflowNameInput {
  name: string
}

async function readWorkflows(filePath: string): Promise<Workflow[]> {
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data) as Workflow[]
  } catch {
    return []
  }
}

export default function registerWorkflowManager(): void {
  const WORKFLOWS_FILE = path.join(app.getPath('userData'), 'nexa_workflows.json')

  ipcMain.handle('load-workflows', async () => {
    const workflows = await readWorkflows(WORKFLOWS_FILE)
    return { success: true, workflows }
  })

  ipcMain.handle('save-workflow', async (_, { name, description, nodes, edges }: WorkflowInput) => {
    try {
      const workflows = await readWorkflows(WORKFLOWS_FILE)
      const existingIndex = workflows.findIndex((w) => w.name === name)
      const newWorkflow = { name, description, nodes, edges, updatedAt: Date.now() }

      if (existingIndex >= 0) {
        workflows[existingIndex] = newWorkflow
      } else {
        workflows.push(newWorkflow)
      }

      await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2))
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('delete-workflow', async (_, { name }: WorkflowNameInput) => {
    try {
      const workflows = (await readWorkflows(WORKFLOWS_FILE)).filter((w) => w.name !== name)

      await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2))
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
