/**
 * Inlined Lucide icons.
 *
 * The plugin used to require `lucide-react` as a peer dependency for exactly
 * 15 icons across two admin views. That made every integrator install an icon set,
 * and a missing install a build-time failure, for 15 paths totalling a few
 * hundred bytes. They are inlined here instead, and `lucide-react` is no longer
 * a peer dependency.
 *
 * The geometry below is copied from lucide-react v1.41.0 and, like the rest of
 * Lucide, is under the ISC licence:
 *
 *   ISC License
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as
 *   part of Feather (MIT). All other copyright (c) for Lucide are held by
 *   Lucide Contributors 2022.
 *
 *   Permission to use, copy, modify, and/or distribute this software for any
 *   purpose with or without fee is hereby granted, provided that the above
 *   copyright notice and this permission notice appear in all copies.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 *   WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 *   MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 *   ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 *   WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 *   ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
 *   IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

import React from 'react'

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Rendered width and height. Lucide's own default is 24. */
  size?: number | string
}

type IconNode = ReadonlyArray<readonly [string, Record<string, string | number>]>

/**
 * Icons are decorative by default (`aria-hidden`): every control that has
 * nothing but an icon inside carries its own `aria-label`. Pass
 * `aria-hidden={false}` plus a label to make one meaningful on its own.
 */
function createIcon(displayName: string, nodes: IconNode): React.FC<IconProps> {
  const Icon: React.FC<IconProps> = ({ size = 24, strokeWidth = 2, ...rest }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {nodes.map(([tag, attrs], index) => React.createElement(tag, { key: index, ...attrs }))}
    </svg>
  )
  Icon.displayName = displayName
  return Icon
}

export const Bot = createIcon('Bot', [
  ['path', { d: "M12 8V4H8" }],
  ['rect', { width: "16", height: "12", x: "4", y: "8", rx: "2" }],
  ['path', { d: "M2 14h2" }],
  ['path', { d: "M20 14h2" }],
  ['path', { d: "M15 13v2" }],
  ['path', { d: "M9 13v2" }],
] as const)

export const ChevronDown = createIcon('ChevronDown', [
  ['path', { d: "m6 9 6 6 6-6" }],
] as const)

export const ChevronUp = createIcon('ChevronUp', [
  ['path', { d: "m18 15-6-6-6 6" }],
] as const)

export const Clock = createIcon('Clock', [
  ['circle', { cx: "12", cy: "12", r: "10" }],
  ['path', { d: "M12 6v6l4 2" }],
] as const)

export const FileSignature = createIcon('FileSignature', [
  ['path', { d: "M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z" }],
  ['path', { d: "M14.487 7.858A1 1 0 0 1 14 7V2" }],
  ['path', { d: "M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516" }],
  ['path', { d: "M8 18h1" }],
] as const)

export const Globe = createIcon('Globe', [
  ['circle', { cx: "12", cy: "12", r: "10" }],
  ['path', { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }],
  ['path', { d: "M2 12h20" }],
] as const)

export const Inbox = createIcon('Inbox', [
  ['polyline', { points: "22 12 16 12 14 15 10 15 8 12 2 12" }],
  ['path', { d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" }],
] as const)

export const Link2 = createIcon('Link2', [
  ['path', { d: "M9 17H7A5 5 0 0 1 7 7h2" }],
  ['path', { d: "M15 7h2a5 5 0 1 1 0 10h-2" }],
  ['line', { x1: "8", x2: "16", y1: "12", y2: "12" }],
] as const)

export const Mail = createIcon('Mail', [
  ['path', { d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" }],
  ['rect', { x: "2", y: "4", width: "20", height: "16", rx: "2" }],
] as const)

export const Paperclip = createIcon('Paperclip', [
  ['path', { d: "m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" }],
] as const)

export const Plus = createIcon('Plus', [
  ['path', { d: "M5 12h14" }],
  ['path', { d: "M12 5v14" }],
] as const)

export const Search = createIcon('Search', [
  ['path', { d: "m21 21-4.34-4.34" }],
  ['circle', { cx: "11", cy: "11", r: "8" }],
] as const)

export const Settings = createIcon('Settings', [
  ['path', { d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" }],
  ['circle', { cx: "12", cy: "12", r: "3" }],
] as const)

export const Timer = createIcon('Timer', [
  ['line', { x1: "10", x2: "14", y1: "2", y2: "2" }],
  ['line', { x1: "12", x2: "15", y1: "14", y2: "11" }],
  ['circle', { cx: "12", cy: "14", r: "8" }],
] as const)

export const X = createIcon('X', [
  ['path', { d: "M18 6 6 18" }],
  ['path', { d: "m6 6 12 12" }],
] as const)
