import { IpcMain } from 'electron'
import os from 'os'
import fs from 'fs'
import { exec } from 'child_process'

const runCommand = (cmd: string): Promise<string> => {
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
      if (error) {
        void error
      }
      resolve(stdout ? stdout.trim() : '')
    })
  })
}

function getOSName(): string {
  const platform = os.platform()
  if (platform === 'win32') return 'Windows'
  if (platform === 'darwin') return 'macOS'
  if (platform === 'linux') {
    try {
      const release = fs.readFileSync('/etc/os-release', 'utf8')
      const nameMatch = release.match(/^PRETTY_NAME="?([^"\n]+)"?/m)
      if (nameMatch) return nameMatch[1]
    } catch (_error) {
      void _error
    }
    return 'Linux'
  }
  return platform
}

const isLinux = os.platform() === 'linux'

let cpuLastSnapshot = os.cpus()

function getSystemCpuUsage(): string {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (let i = 0; i < cpus.length; i++) {
    const cpu = cpus[i]
    const prevCpu = cpuLastSnapshot[i]
    let currentTotal = 0
    for (const type in cpu.times) currentTotal += cpu.times[type]
    let prevTotal = 0
    for (const type in prevCpu.times) prevTotal += prevCpu.times[type]
    idle += cpu.times.idle - prevCpu.times.idle
    total += currentTotal - prevTotal
  }
  cpuLastSnapshot = cpus
  return total === 0 ? '0.0' : (((total - idle) / total) * 100).toFixed(1)
}

function getLinuxTemperature(): number {
  try {
    // Try thermal zones
    const zones = fs.readdirSync('/sys/class/thermal/').filter((d) => d.startsWith('thermal_zone'))
    for (const zone of zones) {
      const type = fs.readFileSync(`/sys/class/thermal/${zone}/type`, 'utf8').trim()
      const temp = parseInt(fs.readFileSync(`/sys/class/thermal/${zone}/temp`, 'utf8').trim(), 10)
      if (
        !isNaN(temp) &&
        (type.includes('cpu') || type.includes('x86') || type.includes('coretemp'))
      ) {
        return Math.round(temp / 1000)
      }
    }
    // Fallback: first zone with a valid reading
    for (const zone of zones) {
      const temp = parseInt(fs.readFileSync(`/sys/class/thermal/${zone}/temp`, 'utf8').trim(), 10)
      if (!isNaN(temp)) return Math.round(temp / 1000)
    }
  } catch (_error) {
    void _error
  }
  return 0
}

async function getLinuxInstalledApps(): Promise<{ name: string; id: string }[]> {
  const apps: { name: string; id: string }[] = []
  const seen = new Set<string>()

  // Scan .desktop files from standard XDG paths
  const desktopDirs = [
    '/usr/share/applications',
    '/usr/local/share/applications',
    `${os.homedir()}/.local/share/applications`
  ]

  for (const dir of desktopDirs) {
    try {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.desktop'))
      for (const file of files) {
        try {
          const content = fs.readFileSync(`${dir}/${file}`, 'utf8')
          // Skip hidden entries
          if (/^NoDisplay\s*=\s*true/m.test(content)) continue
          if (/^Terminal\s*=\s*true/m.test(content)) continue

          const nameMatch = content.match(/^Name=(.+)$/m)
          const execMatch = content.match(/^Exec=(.+)$/m)
          if (nameMatch && execMatch) {
            const name = nameMatch[1].trim()
            const id = file.replace('.desktop', '')
            if (!seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase())
              apps.push({ name, id })
            }
          }
        } catch (_error) {
          void _error
        }
      }
    } catch (_error) {
      void _error
    }
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name))
}

async function getLinuxDrives(): Promise<{ name: string; FreeGB: number; TotalGB: number }[]> {
  const drives: { name: string; FreeGB: number; TotalGB: number }[] = []
  try {
    const output = await runCommand(
      'df -B1 --output=target,avail,size -x tmpfs -x devtmpfs -x squashfs 2>/dev/null'
    )
    const lines = output.split('\n').slice(1) // skip header
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 3) {
        const mount = parts[0]
        const avail = parseInt(parts[1], 10)
        const total = parseInt(parts[2], 10)
        if (!isNaN(avail) && !isNaN(total) && total > 0) {
          drives.push({
            name: mount === '/' ? 'Root' : mount.split('/').pop() || mount,
            FreeGB: Math.round((avail / 1073741824) * 100) / 100,
            TotalGB: Math.round((total / 1073741824) * 100) / 100
          })
        }
      }
    }
  } catch (_error) {
    void _error
  }
  return drives
}

type WindowsAppEntry = { Name?: string; AppID?: string }

const isWindowsAppEntry = (value: unknown): value is WindowsAppEntry =>
  Boolean(value && typeof value === 'object')

export default function registerSystemHandlers(ipcMain: IpcMain): void {
  ipcMain.removeHandler('get-installed-apps')
  ipcMain.handle('get-installed-apps', async () => {
    try {
      const platform = os.platform()

      if (platform === 'win32') {
        const cmd = `powershell "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Depth 1"`
        const jsonOutput = await runCommand(cmd)
        if (!jsonOutput) return []
        let rawData: unknown
        try {
          rawData = JSON.parse(jsonOutput)
        } catch {
          return []
        }
        const appsArray = Array.isArray(rawData) ? rawData : [rawData]
        return appsArray
          .filter(isWindowsAppEntry)
          .filter((app) => Boolean(app.Name && app.AppID))
          .map((app) => ({ name: String(app.Name).trim(), id: String(app.AppID).trim() }))
          .sort((a, b) => a.name.localeCompare(b.name))
      }

      if (platform === 'linux') {
        return await getLinuxInstalledApps()
      }

      return []
    } catch (_error) {
      return []
    }
  })

  ipcMain.removeHandler('get-system-stats')
  ipcMain.handle('get-system-stats', async () => {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    return {
      cpu: getSystemCpuUsage(),
      memory: {
        total: (totalMem / 1024 ** 3).toFixed(1) + ' GB',
        free: (freeMem / 1024 ** 3).toFixed(1) + ' GB',
        usedPercentage: (((totalMem - freeMem) / totalMem) * 100).toFixed(1)
      },
      temperature: isLinux ? getLinuxTemperature() : 0,
      os: {
        type: getOSName(),
        uptime: (os.uptime() / 3600).toFixed(1) + 'h'
      }
    }
  })

  ipcMain.removeHandler('get-battery-info')
  ipcMain.handle('get-battery-info', async () => {
    try {
      if (isLinux) {
        // Try sysfs first
        const powerDir = '/sys/class/power_supply'
        try {
          const supplies = fs.readdirSync(powerDir)
          const batDir = supplies.find((d) => d.startsWith('BAT'))
          if (batDir) {
            const basePath = `${powerDir}/${batDir}`
            const capacity = parseInt(fs.readFileSync(`${basePath}/capacity`, 'utf8').trim(), 10)
            const status = fs.readFileSync(`${basePath}/status`, 'utf8').trim()
            if (!isNaN(capacity)) {
              return {
                percent: capacity,
                isCharging: status === 'Charging' || status === 'Full',
                hasBattery: true
              }
            }
          }
        } catch (_error) {
          void _error
        }

        // Fallback: acpi command
        try {
          const acpiOut = await runCommand('acpi -b 2>/dev/null')
          if (acpiOut && acpiOut.includes('Battery')) {
            const percentMatch = acpiOut.match(/(\d+)%/)
            const isCharging = acpiOut.includes('Charging') || acpiOut.includes('Full')
            if (percentMatch) {
              return {
                percent: parseInt(percentMatch[1], 10),
                isCharging,
                hasBattery: true
              }
            }
          }
        } catch (_error) {
          void _error
        }
      }

      // No battery found (desktop) or unsupported platform
      return { percent: 100, isCharging: true, hasBattery: false }
    } catch {
      return { percent: 100, isCharging: true, hasBattery: false }
    }
  })

  ipcMain.removeHandler('get-drives')
  ipcMain.handle('get-drives', async () => {
    try {
      const platform = os.platform()
      if (platform === 'win32') {
        const cmd = `powershell "Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='FreeGB';E={[math]::round($_.Free/1GB, 2)}}, @{N='TotalGB';E={[math]::round(($_.Used + $_.Free)/1GB, 2)}} | ConvertTo-Json"`
        const output = await runCommand(cmd)
        return output ? JSON.parse(output) : []
      }
      if (platform === 'linux') {
        return await getLinuxDrives()
      }
      return []
    } catch (_error) {
      return []
    }
  })
}
