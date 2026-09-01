import { useEffect, useState } from 'react'

const DISMISSED = 'piano-tutor.install.dismissed'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own flag, which predates the standard one and is still the only
    // way to tell on an iPhone.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isApple(): boolean {
  const ua = navigator.userAgent
  // An iPad on recent iPadOS reports itself as a Mac, so touch points decide it.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * Offers to put the app on the home screen. Chromium hands over an install
 * prompt; Safari never has, so on Apple devices the only thing on offer is
 * telling you where the button is.
 */
export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showApple, setShowApple] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isStandalone()) return
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    if (isApple()) setShowApple(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const close = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch { /* storage unavailable */ }
  }

  if (dismissed || isStandalone() || (!prompt && !showApple)) return null

  return (
    <section className="install">
      <div className="install-text">
        <strong>Put this on your home screen</strong>
        {prompt ? (
          <span>It opens full screen, works without a signal, and keeps your songs.</span>
        ) : (
          <span>
            Tap <b>Share</b> at the bottom of Safari, then <b>Add to Home Screen</b>. It opens full
            screen and works without a signal.
          </span>
        )}
      </div>
      {prompt && (
        <button
          className="primary"
          onClick={async () => {
            await prompt.prompt()
            await prompt.userChoice
            setPrompt(null)
            close()
          }}
        >
          Install
        </button>
      )}
      <button className="ghost small" onClick={close} aria-label="Dismiss">✕</button>
    </section>
  )
}
