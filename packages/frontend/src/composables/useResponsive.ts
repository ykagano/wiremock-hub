import { useBreakpoints } from '@vueuse/core'

const breakpoints = useBreakpoints({
  tablet: 769,
  desktop: 1025,
})

export function useResponsive() {
  const isMobile = breakpoints.smaller('tablet')
  const isTablet = breakpoints.between('tablet', 'desktop')
  const isDesktop = breakpoints.greaterOrEqual('desktop')

  return { isMobile, isTablet, isDesktop }
}
