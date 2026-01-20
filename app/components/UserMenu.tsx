'use client'

import { useAuth } from '../contexts/AuthContext'
import Link from 'next/link'

export default function UserMenu() {
  const { user, isAdmin, signOut } = useAuth()

  if (!user) {
    return (
      <div className="flex gap-2">
        <Link
          href="/login"
          className="px-4 py-2 text-white hover:text-blue-400 transition-colors"
        >
          Entrar
        </Link>
        <Link
          href="/signup"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          Criar Conta
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      {isAdmin && (
        <Link
          href="/languages"
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm transition-colors"
        >
          👑 Admin
        </Link>
      )}
      <span className="text-gray-300">{user.email}</span>
      <button
        onClick={() => signOut()}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
      >
        Sair
      </button>
    </div>
  )
}
