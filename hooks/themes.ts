// Palettes from popular Neovim color schemes. Colors are 0xRRGGBB.
export type Theme = {
  name: string
  accent: number // logo, HEAD, highlights
  frame: [number, number] // border gradient, left → right
  dim: number // section labels
  faint: number // secondary text
  ghost: number // empty track cells
  add: [number, number] // added-lines bar gradient
  del: [number, number] // removed-lines bar gradient
  warn: number // running spinner
  info: number // new files, hashes
  lanes: number[] // one color per agent
  spark: number[] // 8 levels, calm → hot
}

export const THEMES: Record<string, Theme> = {
  catppuccin: {
    name: 'catppuccin',
    accent: 0xcba6f7,
    frame: [0x89b4fa, 0xf5c2e7],
    dim: 0xb4befe,
    faint: 0x7f849c,
    ghost: 0x45475a,
    add: [0x94e2d5, 0xa6e3a1],
    del: [0xeba0ac, 0xf38ba8],
    warn: 0xf9e2af,
    info: 0x89dceb,
    lanes: [0xcba6f7, 0x89b4fa, 0xa6e3a1, 0xfab387, 0xf5c2e7, 0x94e2d5, 0xf9e2af],
    spark: [0x74c7ec, 0x89b4fa, 0xb4befe, 0xcba6f7, 0xf5c2e7, 0xeba0ac, 0xfab387, 0xf9e2af],
  },
  tokyonight: {
    name: 'tokyonight',
    accent: 0x7aa2f7,
    frame: [0x7aa2f7, 0xbb9af7],
    dim: 0x7dcfff,
    faint: 0x565f89,
    ghost: 0x292e42,
    add: [0x73daca, 0x9ece6a],
    del: [0xff9e64, 0xf7768e],
    warn: 0xe0af68,
    info: 0x2ac3de,
    lanes: [0x7aa2f7, 0xbb9af7, 0x9ece6a, 0xff9e64, 0x7dcfff, 0xf7768e, 0x1abc9c],
    spark: [0x3d59a1, 0x5a7ad8, 0x7aa2f7, 0x7dcfff, 0x2ac3de, 0xbb9af7, 0xff9e64, 0xf7768e],
  },
  gruvbox: {
    name: 'gruvbox',
    accent: 0xfe8019,
    frame: [0xfabd2f, 0xfe8019],
    dim: 0xd5c4a1,
    faint: 0x928374,
    ghost: 0x3c3836,
    add: [0x8ec07c, 0xb8bb26],
    del: [0xfe8019, 0xfb4934],
    warn: 0xfabd2f,
    info: 0x83a598,
    lanes: [0xfe8019, 0x83a598, 0xb8bb26, 0xd3869b, 0xfabd2f, 0x8ec07c, 0xfb4934],
    spark: [0x458588, 0x83a598, 0x8ec07c, 0xb8bb26, 0xfabd2f, 0xfe8019, 0xfb4934, 0xd3869b],
  },
  rosepine: {
    name: 'rosepine',
    accent: 0xebbcba,
    frame: [0xc4a7e7, 0xebbcba],
    dim: 0x908caa,
    faint: 0x6e6a86,
    ghost: 0x26233a,
    add: [0x9ccfd8, 0x31748f],
    del: [0xf6c177, 0xeb6f92],
    warn: 0xf6c177,
    info: 0x9ccfd8,
    lanes: [0xebbcba, 0xc4a7e7, 0x9ccfd8, 0xf6c177, 0xeb6f92, 0x31748f, 0xe0def4],
    spark: [0x31748f, 0x3e8fb0, 0x9ccfd8, 0xc4a7e7, 0xebbcba, 0xf6c177, 0xeb6f92, 0xeb6f92],
  },
  kanagawa: {
    name: 'kanagawa',
    accent: 0xe6c384,
    frame: [0x7e9cd8, 0x957fb8],
    dim: 0xc8c093,
    faint: 0x727169,
    ghost: 0x363646,
    add: [0x7aa89f, 0x98bb6c],
    del: [0xffa066, 0xff5d62],
    warn: 0xe6c384,
    info: 0x7fb4ca,
    lanes: [0xe6c384, 0x7e9cd8, 0x98bb6c, 0xd27e99, 0x7fb4ca, 0xffa066, 0x957fb8],
    spark: [0x223249, 0x2d4f67, 0x7e9cd8, 0x7fb4ca, 0x7aa89f, 0xe6c384, 0xffa066, 0xff5d62],
  },
  nord: {
    name: 'nord',
    accent: 0x88c0d0,
    frame: [0x5e81ac, 0x8fbcbb],
    dim: 0xd8dee9,
    faint: 0x4c566a,
    ghost: 0x3b4252,
    add: [0x8fbcbb, 0xa3be8c],
    del: [0xd08770, 0xbf616a],
    warn: 0xebcb8b,
    info: 0x81a1c1,
    lanes: [0x88c0d0, 0xb48ead, 0xa3be8c, 0xd08770, 0x81a1c1, 0xebcb8b, 0xbf616a],
    spark: [0x5e81ac, 0x81a1c1, 0x88c0d0, 0x8fbcbb, 0xa3be8c, 0xebcb8b, 0xd08770, 0xbf616a],
  },
  dracula: {
    name: 'dracula',
    accent: 0xff79c6,
    frame: [0xbd93f9, 0xff79c6],
    dim: 0x8be9fd,
    faint: 0x6272a4,
    ghost: 0x44475a,
    add: [0x8be9fd, 0x50fa7b],
    del: [0xffb86c, 0xff5555],
    warn: 0xf1fa8c,
    info: 0x8be9fd,
    lanes: [0xbd93f9, 0xff79c6, 0x50fa7b, 0xffb86c, 0x8be9fd, 0xf1fa8c, 0xff5555],
    spark: [0x6272a4, 0x8d7fd0, 0xbd93f9, 0xd486e0, 0xff79c6, 0xff9a9a, 0xffb86c, 0xf1fa8c],
  },
  claude: {
    name: 'claude',
    accent: 0xd97757,
    frame: [0xb8664a, 0xe8906f],
    dim: 0xa8a29e,
    faint: 0x6e6a66,
    ghost: 0x2f2d2b,
    add: [0x5fb8a0, 0x6fbf73],
    del: [0xe8906f, 0xe0707a],
    warn: 0xe3b35c,
    info: 0x6a9bcc,
    lanes: [0xd97757, 0x6a9bcc, 0x8fbf7f, 0xb18bd6, 0xe3b35c, 0xd486a8, 0x5fb8b0],
    spark: [0x6b4a3d, 0x7f5242, 0x935b47, 0xa8634c, 0xbc6b51, 0xd97757, 0xe8906f, 0xf2ad8f],
  },
}

export const DEFAULT_THEME = 'catppuccin'

export function themeOf(name: string | undefined): Theme {
  return THEMES[name ?? ''] ?? THEMES[DEFAULT_THEME]!
}

/** Blend two colors; t = 0 gives a, t = 1 gives b. */
export function lerp(a: number, b: number, t: number) {
  const k = Math.max(0, Math.min(1, t))
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff
    const y = (b >> shift) & 0xff
    return Math.round(x + (y - x) * k) << shift
  }
  return ch(16) | ch(8) | ch(0)
}

export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
