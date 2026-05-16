// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth'

export const GET = handlers.GET as unknown as typeof handlers.GET
export const POST = handlers.POST as unknown as typeof handlers.POST
