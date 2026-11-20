import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'instructor' | 'customer'
      customerId: string
    } & DefaultSession['user']
  }

  interface User {
    role?: 'instructor' | 'customer'
  }
}