import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['tw', 'jp', 'us'] as const,
  defaultLocale: 'tw',
})
