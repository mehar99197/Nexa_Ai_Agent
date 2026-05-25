import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getHudToasts, subscribeHudToasts } from './hudToastStore'
import type { Toast, ToastKind } from './hudToastStore'

const colorByKind: Record<ToastKind, { ring: string; glow: string; text: string }> = {
  info: { ring: 'border-cyan-400/40', glow: 'shadow-cyan-500/20', text: 'text-cyan-300' },
  warn: { ring: 'border-amber-400/50', glow: 'shadow-amber-500/30', text: 'text-amber-300' },
  error: { ring: 'border-red-500/60', glow: 'shadow-red-500/30', text: 'text-red-300' },
  success: {
    ring: 'border-emerald-400/50',
    glow: 'shadow-emerald-500/30',
    text: 'text-emerald-300'
  }
}

export function HudToastHost(): React.JSX.Element {
  const [items, setItems] = useState<Toast[]>(getHudToasts())
  useEffect(() => {
    const unsubscribe = subscribeHudToasts(setItems)
    return () => unsubscribe()
  }, [])
  return (
    <div className="pointer-events-none fixed top-6 right-6 z-9999 flex flex-col gap-2">
      <AnimatePresence>
        {items.map((t) => {
          const c = colorByKind[t.kind]
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 24, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className={`pointer-events-auto min-w-70 max-w-105 bg-black/40 backdrop-blur-xl border ${c.ring} ${c.glow} shadow-2xl rounded-md px-4 py-3`}
            >
              <div className={`font-mono tracking-widest uppercase text-[10px] mb-1 ${c.text}`}>
                {t.kind === 'error'
                  ? 'SYSTEM ALERT'
                  : t.kind === 'warn'
                    ? 'CAUTION'
                    : t.kind === 'success'
                      ? 'CONFIRMED'
                      : 'NOTICE'}
              </div>
              <div className="text-sm text-white/90 wrap-break-word">{t.title}</div>
              {t.detail ? (
                <div className="text-xs text-white/60 mt-1 wrap-break-word">{t.detail}</div>
              ) : null}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default HudToastHost
