export function createMarkerIcon(color: string, label: string): string {
  const safeLabel = label.replace(/[<>&"']/gu, '').slice(0, 2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 42 50"><path fill="${color}" stroke="#f1ede4" stroke-width="2" d="M21 1C10 1 2 9 2 20c0 14 19 28 19 28s19-14 19-28C40 9 32 1 21 1Z"/><circle cx="21" cy="20" r="10" fill="#121315"/><text x="21" y="24" text-anchor="middle" fill="#f1ede4" font-size="10" font-family="monospace">${safeLabel}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
