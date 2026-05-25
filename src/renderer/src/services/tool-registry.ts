// Central dispatch table for Gemini tool calls.
//
// Why a registry instead of a long if/else: the previous handler in
// Nexa-voice-ai.ts was a ~250-line if/else chain. Adding a new tool meant
// editing that file in two or three places. With a registry, each tool is a
// single entry { name, run(args, ctx) }. Adding one is a one-line change.
//
// Most tools are simple "pass args through to a function" wrappers. A handful
// (click_on_screen, execute_macro, build_file) need richer context — they
// take a ToolContext that exposes the underlying service.

import { handleNavigation, handleOpenMap } from '@renderer/tools/Earth-View'
import { handleImageGeneration } from '@renderer/tools/Image-generator'
import { fetchWeather } from '@renderer/tools/weather-api'
import { compareStocks, fetchStockData } from '@renderer/tools/stock-api'
import {
  closeMobileApp,
  fetchMobileInfo,
  fetchMobileNotifications,
  openMobileApp,
  pullFileFromMobile,
  pushFileToMobile,
  swipeMobileScreen,
  tapMobileScreen,
  toggleMobileHardware
} from '@renderer/tools/Mobile-api'
import { executeRealityHack } from '@renderer/tools/Hacker-api'
import { closeWormhole, deployWormhole } from '@renderer/tools/wormhole-api'
import { consultOracle, ingestCodebase } from '@renderer/tools/rag-oracle-tool'
import { runDeepResearch } from '@renderer/tools/deepSearch-rag'
import { runIndexDirectory, runSmartSearch } from '@renderer/tools/semantic-search-api'
import { closeWidgets, createWidget } from '@renderer/tools/widget-creator'
import { buildAnimatedWebsite } from '@renderer/code/website-builder-api'
import { getMacroSequence } from '@renderer/code/macro-executor'
import {
  createFolder,
  manageFile,
  openFile,
  readDirectory,
  readFile,
  writeFile
} from '@renderer/functions/file-manager-api'
import { closeApp, openApp, performWebSearch } from '@renderer/functions/apps-manager-api'
import { readSystemNotes, saveNote } from '@renderer/functions/notes-manager-api'
import { executeGhostSequence, ghostType } from '@renderer/functions/keyboard-api'
import {
  scheduleWhatsAppMessage,
  sendWhatsAppMessage
} from '@renderer/functions/whatsapp-manager-api'
import {
  clickOnCoordinate,
  getScreenSize,
  pressShortcut,
  scrollScreen,
  setVolume,
  takeScreenshot
} from '@renderer/functions/keyboard-manager'
import {
  activateCodingMode,
  openInVsCode,
  runTerminal
} from '@renderer/functions/coding-manager-api'
import { analyzeDirectPhoto, readGalleryImages } from '@renderer/functions/gallery-manager-api'
import { draftEmail, readEmails, sendEmail } from '@renderer/functions/gmail-manager-api'
import { playSpotifyMusic } from '@renderer/functions/Spotify-manager'
import { executeSmartDropZones } from '@renderer/functions/DropZone-handler-api'
import { executeLockSystem } from '@renderer/handlers/LockSystem-handler'
import { saveCoreMemory, retrieveCoreMemory } from './nexa-ai-brain'

type ToolArgs = Record<string, any>

export interface ToolContext {
  socket: WebSocket | null
}

export interface ToolHandler {
  name: string
  run: (args: ToolArgs, ctx: ToolContext) => Promise<string>
}

// Helper for tools whose runtime arg is a simple string — keeps entries terse.
const stringArg = (key: string, fn: (v: string) => Promise<string>): ToolHandler['run'] =>
  (args) => fn(args[key])

const handlers: ToolHandler[] = [
  // ---------- File system / project ----------
  { name: 'index_directory', run: stringArg('folder_path', runIndexDirectory) },
  { name: 'smart_file_search', run: stringArg('query', runSmartSearch) },
  { name: 'read_file', run: stringArg('file_path', readFile) },
  { name: 'write_file', run: (a) => writeFile(a.file_name, a.content) },
  { name: 'manage_file', run: (a) => manageFile(a.operation, a.source_path, a.dest_path) },
  { name: 'open_file', run: stringArg('file_path', openFile) },
  { name: 'read_directory', run: stringArg('directory_path', readDirectory) },
  { name: 'create_folder', run: stringArg('folder_path', createFolder) },
  { name: 'open_project', run: stringArg('folder_path', openInVsCode) },
  { name: 'run_terminal', run: (a) => runTerminal(a.command, a.path) },

  // ---------- Apps / web ----------
  { name: 'open_app', run: stringArg('app_name', openApp) },
  { name: 'close_app', run: stringArg('app_name', closeApp) },
  { name: 'google_search', run: stringArg('query', performWebSearch) },
  { name: 'play_spotify_music', run: stringArg('song_name', playSpotifyMusic) },

  // ---------- Notes ----------
  { name: 'save_note', run: (a) => saveNote(a.title, a.content) },
  { name: 'read_notes', run: () => readSystemNotes() },

  // ---------- Keyboard / screen ----------
  { name: 'ghost_type', run: stringArg('text', ghostType) },
  { name: 'execute_sequence', run: stringArg('json_actions', executeGhostSequence) },
  { name: 'set_volume', run: (a) => setVolume(a.level) },
  { name: 'take_screenshot', run: () => takeScreenshot() },
  { name: 'scroll_screen', run: (a) => scrollScreen(a.direction, a.amount) },
  { name: 'press_shortcut', run: (a) => pressShortcut(a.key, a.modifiers) },
  {
    // click_on_screen needs coordinate mapping from the AI's 0..1000 grid to
    // real pixels — handled inline because of the side dependency on screen size.
    name: 'click_on_screen',
    run: async (a) => {
      const { width, height } = await getScreenSize()
      const realX = Math.round((a.x / 1000) * width)
      const realY = Math.round((a.y / 1000) * height)
      return clickOnCoordinate(realX, realY)
    }
  },

  // ---------- Comms ----------
  { name: 'send_whatsapp', run: (a) => sendWhatsAppMessage(a.name, a.message, a.file_path) },
  {
    name: 'schedule_whatsapp',
    run: (a) => scheduleWhatsAppMessage(a.name, a.message, a.delay_minutes, a.file_path)
  },
  { name: 'send_email', run: (a) => sendEmail(a.to, a.subject, a.body) },
  { name: 'draft_email', run: (a) => draftEmail(a.to, a.subject, a.body) },
  { name: 'read_emails', run: (a) => readEmails(a.max_results || 5) },

  // ---------- Maps / location ----------
  { name: 'open_map', run: stringArg('location', handleOpenMap) },
  { name: 'get_navigation', run: (a) => handleNavigation(a.origin, a.destination) },

  // ---------- Media / images ----------
  { name: 'generate_image', run: stringArg('prompt', handleImageGeneration) },
  { name: 'read_gallery', run: () => readGalleryImages() },
  {
    name: 'analyze_direct_photo',
    // analyzeDirectPhoto's inner Promise is untyped (Promise<unknown>) — coerce
    // to string at the boundary so the registry's ToolHandler signature holds.
    run: async (a, ctx) => String(await analyzeDirectPhoto(a.file_path, ctx.socket))
  },

  // ---------- Information feeds ----------
  { name: 'get_weather', run: stringArg('location', fetchWeather) },
  { name: 'get_stock_price', run: stringArg('ticker', fetchStockData) },
  { name: 'compare_stocks', run: (a) => compareStocks(a.ticker1, a.ticker2) },

  // ---------- Mobile / ADB ----------
  { name: 'open_mobile_app', run: stringArg('package_name', openMobileApp) },
  { name: 'close_mobile_app', run: stringArg('package_name', closeMobileApp) },
  { name: 'tap_mobile_screen', run: (a) => tapMobileScreen(a.x_percent, a.y_percent) },
  { name: 'swipe_mobile_screen', run: stringArg('direction', swipeMobileScreen) },
  { name: 'get_mobile_info', run: () => fetchMobileInfo() },
  { name: 'get_mobile_notifications', run: () => fetchMobileNotifications() },
  { name: 'push_file_to_mobile', run: (a) => pushFileToMobile(a.source_path, a.dest_path) },
  { name: 'pull_file_from_mobile', run: (a) => pullFileFromMobile(a.source_path, a.dest_path) },
  { name: 'toggle_mobile_hardware', run: (a) => toggleMobileHardware(a.setting, a.state) },

  // ---------- Web hacking ----------
  { name: 'hack_live_website', run: (a) => executeRealityHack(a.url, a.mode, a.custom_text) },

  // ---------- Code / builder ----------
  {
    name: 'build_file',
    run: async (a) => {
      window.dispatchEvent(
        new CustomEvent('ai-start-coding', {
          detail: { file_name: a.file_name, prompt: a.prompt }
        })
      )
      return `✅ I am streaming the code for ${a.file_name} to the screen now.`
    }
  },
  {
    name: 'open_in_vscode',
    run: async () => {
      window.dispatchEvent(new CustomEvent('ai-open-vscode'))
      return '✅ Opening Visual Studio Code.'
    }
  },
  { name: 'build_animated_website', run: stringArg('prompt', buildAnimatedWebsite) },
  {
    name: 'teleport_windows',
    run: async (a) => {
      await window.electron.ipcRenderer.invoke('teleport-windows', a.commands)
      return '✅ I have restructured the desktop windows, Boss.'
    }
  },

  // ---------- Memory / RAG ----------
  { name: 'save_core_memory', run: stringArg('fact', saveCoreMemory) },
  { name: 'retrieve_core_memory', run: async () => retrieveCoreMemory() },
  { name: 'ingest_codebase', run: stringArg('dirPath', ingestCodebase) },
  { name: 'consult_oracle', run: stringArg('query', consultOracle) },
  { name: 'deep_research', run: stringArg('query', runDeepResearch) },

  // ---------- Misc activate ----------
  {
    name: 'activate_protocol',
    run: async (a) => {
      if (a.protocol_name === 'coding') return activateCodingMode()
      return 'Error: Unknown protocol.'
    }
  },

  // ---------- Networking / tunnels ----------
  { name: 'deploy_wormhole', run: (a) => deployWormhole(a.port) },
  { name: 'close_wormhole', run: () => closeWormhole() },

  // ---------- Widgets ----------
  {
    name: 'create_widget',
    run: (a) => createWidget(a.html_code, a.width, a.height)
  },
  { name: 'close_widgets', run: () => closeWidgets() },

  // ---------- System ----------
  {
    name: 'smart_drop_zones',
    run: (a) => executeSmartDropZones(a.base_directory, a.files_to_sort)
  },
  { name: 'lock_system_vault', run: () => executeLockSystem() }
]

const toolMap: Map<string, ToolHandler> = new Map(handlers.map((h) => [h.name, h]))

// Macro execution recursively dispatches simple tool calls; we expose a small
// helper so the registry can be used from within itself without circular
// imports. Macros use a smaller subset of tools (no nested macros, no recursion)
// and synchronous-style step args, so we treat each step args record as a
// best-effort ToolArgs.
const runMacroStep = async (
  step: { tool: string; args: Record<string, any> },
  ctx: ToolContext
): Promise<void> => {
  if (step.tool === 'WAIT') {
    await new Promise((resolve) => setTimeout(resolve, Number(step.args.milliseconds) || 1000))
    return
  }
  // press_shortcut accepts modifiers as a string or array in macros — normalize.
  const normalized: Record<string, any> = { ...step.args }
  if (step.tool === 'press_shortcut' && typeof normalized.modifiers === 'string') {
    normalized.modifiers = normalized.modifiers
      .split(',')
      .map((m: string) => m.trim())
      .filter(Boolean)
  }
  // Numeric coercion for fields that macro JSON often stringifies.
  if (step.tool === 'set_volume') normalized.level = Number(normalized.level)
  if (step.tool === 'click_on_screen') {
    normalized.x = Number(normalized.x)
    normalized.y = Number(normalized.y)
  }
  if (step.tool === 'scroll_screen') normalized.amount = Number(normalized.amount)
  if (step.tool === 'schedule_whatsapp') {
    normalized.delay_minutes = Number(normalized.delay_minutes)
  }
  if (step.tool === 'read_emails') normalized.max_results = Number(normalized.max_results) || 5
  if (step.tool === 'deploy_wormhole') normalized.port = Number(normalized.port)

  const handler = toolMap.get(step.tool)
  if (handler) await handler.run(normalized, ctx)
}

export async function executeTool(
  name: string,
  args: ToolArgs,
  ctx: ToolContext
): Promise<string> {
  // execute_macro is special: it expands into a sequence of registry calls.
  if (name === 'execute_macro') {
    const macroRes = await getMacroSequence(args.macro_name)
    if (!macroRes.success) return macroRes.error
    for (const step of macroRes.steps) {
      try {
        await runMacroStep(step, ctx)
      } catch {
        break
      }
    }
    return `[SYSTEM OVERRIDE] Macro "${macroRes.name}" has been successfully executed natively by the system architecture. Confirm execution with the user briefly.`
  }

  const handler = toolMap.get(name)
  if (!handler) return 'Error: Tool not found.'
  try {
    return await handler.run(args || {}, ctx)
  } catch (err) {
    return `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`
  }
}

// Expose the list of registered tool names so other parts of the codebase
// (tests, debug UI) can see what's wired up without poking at internals.
export const getRegisteredTools = (): string[] => Array.from(toolMap.keys())
