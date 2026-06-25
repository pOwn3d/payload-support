import { DATE_LOCALE } from '../shared/dateLocale'

export function timeAgo(d: string): string {
  const date = new Date(d), now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString(DATE_LOCALE, { hour: '2-digit', minute: '2-digit' })
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (date.toDateString() === y.toDateString()) return `Hier, ${date.toLocaleTimeString(DATE_LOCALE, { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function dateLabel(d: string): string {
  const date = new Date(d), now = new Date()
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui"
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (date.toDateString() === y.toDateString()) return 'Hier'
  return date.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long' })
}
