/**
 * jsdom has no `matchMedia`, so MUI's `useMediaQuery` reports false and every
 * test renders the desktop layout. This stub answers the min-width and
 * max-width queries MUI's breakpoints use, for a viewport `width` pixels wide.
 * The test config's `unstubGlobals` removes it after each test.
 */
export function mockMatchMedia(width: number) {
  const matches = (query: string) => {
    const min = /min-width:\s*([\d.]+)px/.exec(query)
    const max = /max-width:\s*([\d.]+)px/.exec(query)
    return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]))
  }
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}
