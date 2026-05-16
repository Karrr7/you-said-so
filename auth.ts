// auth.ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email
      return token
    },
    session({ session, token }) {
      if (token.email) session.user.email = token.email as string
      return session
    },
  },
})
