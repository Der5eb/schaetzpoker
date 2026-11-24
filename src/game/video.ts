export type VideoRegistry = Map<string, HTMLIFrameElement>

/** Steuert ein eingebettetes YouTube-Video über die IFrame-API (postMessage). */
export function controlVideo(iframe: HTMLIFrameElement, cmd: 'play' | 'pause' | 'restart') {
  const send = (func: string, args: unknown[] = []) =>
    iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
  if (cmd === 'play') send('playVideo')
  if (cmd === 'pause') send('pauseVideo')
  if (cmd === 'restart') {
    const start = Number(new URL(iframe.src).searchParams.get('start') ?? 0)
    send('seekTo', [start, true])
    send('playVideo')
  }
}
