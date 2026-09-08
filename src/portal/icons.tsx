/**
 * Inlined Lucide icons.
 *
 * The plugin used to require `lucide-react` as a peer dependency for exactly
 * 5 icons across the portal live-chat widget. That made every integrator install an icon set,
 * and a missing install a build-time failure, for 5 paths totalling a few
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

export const ArrowLeft = createIcon('ArrowLeft', [
  ['path', { d: "m12 19-7-7 7-7" }],
  ['path', { d: "M19 12H5" }],
] as const)

export const MessageCircle = createIcon('MessageCircle', [
  ['path', { d: "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" }],
] as const)

export const Minimize2 = createIcon('Minimize2', [
  ['path', { d: "m14 10 7-7" }],
  ['path', { d: "M20 10h-6V4" }],
  ['path', { d: "m3 21 7-7" }],
  ['path', { d: "M4 14h6v6" }],
] as const)

export const Send = createIcon('Send', [
  ['path', { d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" }],
  ['path', { d: "m21.854 2.147-10.94 10.939" }],
] as const)

export const X = createIcon('X', [
  ['path', { d: "M18 6 6 18" }],
  ['path', { d: "m6 6 12 12" }],
] as const)
