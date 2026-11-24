import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function Qr({ value, className }: { value: string; className?: string }) {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    QRCode.toString(value, { type: 'svg', margin: 1, color: { dark: '#08170f', light: '#f3e9d2' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [value])

  return <div className={className} role="img" aria-label="QR-Code" dangerouslySetInnerHTML={{ __html: svg }} />
}
