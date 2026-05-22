import type { ReactElement } from 'react'
import {
  RiTerminalBoxLine,
  RiGlobalLine,
  RiPhoneLine,
  RiSettings4Line,
  RiFlashlightLine,
  RiKeyboardLine,
  RiVolumeUpLine,
  RiMailLine,
  RiServerLine
} from 'react-icons/ri'
import { ListStartIcon } from 'lucide-react'

export const getIcon = (name: string, size = 16): ReactElement => {
  if (name.includes('mobile') || name.includes('whatsapp'))
    return <RiPhoneLine size={size} className="text-blue-400" />
  if (name.includes('terminal') || name.includes('code') || name.includes('app'))
    return <RiTerminalBoxLine size={size} className="text-emerald-400" />
  if (name.includes('web') || name.includes('search') || name.includes('research'))
    return <RiGlobalLine size={size} className="text-cyan-400" />
  if (name.includes('type') || name.includes('shortcut') || name.includes('sequence'))
    return <RiKeyboardLine size={size} className="text-yellow-400" />
  if (name.includes('volume')) return <RiVolumeUpLine size={size} className="text-pink-400" />
  if (name.includes('email')) return <RiMailLine size={size} className="text-orange-400" />
  if (name.includes('wormhole')) return <RiServerLine size={size} className="text-purple-400" />

  if (name === 'WAIT') return <RiFlashlightLine size={size} className="text-purple-400" />
  if (name === 'TRIGGER') return <ListStartIcon size={size} className="text-red-400" />
  return <RiSettings4Line size={size} className="text-zinc-400" />
}
