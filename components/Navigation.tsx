'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

type UserRole = 'admin' | 'staff'

type NavItem = {
  href: string
  label: string
  roles: UserRole[] // Which roles can access this page
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: '營收報表', roles: ['admin'] },
  { href: '/pos', label: 'POS 收銀', roles: ['admin', 'staff'] },
  //{ href: '/live-import', label: '直播訂單匯入', roles: ['admin', 'staff'] },
  { href: '/products', label: '商品庫', roles: ['admin'] },
  { href: '/ichiban-kuji', label: '一番賞庫', roles: ['admin'] },
  { href: '/vendors', label: '廠商管理', roles: ['admin'] },
  { href: '/customers', label: '客戶管理', roles: ['admin'] },
  { href: '/purchases', label: '進貨管理', roles: ['admin', 'staff'] },
  { href: '/deliveries', label: '待出貨', roles: ['admin', 'staff'] },
  { href: '/sales', label: '銷售記錄', roles: ['admin'] },
  { href: '/ar', label: '應收帳款', roles: ['admin'] },
  { href: '/ap', label: '應付帳款', roles: ['admin'] },
  { href: '/expenses', label: '會計記帳', roles: ['admin', 'staff'] },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<{ username: string; role: UserRole } | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setUser(data.data)
        }
      })
      .catch(() => {
        // Ignore error
      })
  }, [])

  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) return

    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      // 使用 window.location.href 強制完整刷新，清除所有前端狀態
      window.location.href = '/login'
    } catch (err) {
      alert('登出失敗')
      setLoggingOut(false)
    }
  }

  // Filter nav items based on user role
  const filteredNavItems = user
    ? navItems.filter(item => item.roles.includes(user.role))
    : navItems

  return (
    <nav className="sticky top-0 z-50 border-b bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto max-w-full px-2 sm:px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-6 lg:gap-8 min-w-0 flex-1">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Image
                src="/logo.jpg"
                alt="ToyFlow ERP Logo"
                width={40}
                height={40}
                className="rounded-lg shadow-sm sm:w-11 sm:h-11"
              />
              <span className="hidden sm:inline text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">失控 ERP</span>
            </Link>

            {/* Desktop Navigation - 使用横向滚动 */}
            <div className="hidden lg:flex gap-1 xl:gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500 pb-1">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-lg px-2.5 xl:px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                    pathname === item.href
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md scale-105'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 hover:shadow-sm'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* User Info - 只在较大屏幕显示 */}
            {user && (
              <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                  {user.username}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  user.role === 'admin'
                    ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
                }`}>
                  {user.role === 'admin' ? '管理員' : '員工'}
                </span>
              </div>
            )}

            {/* Logout Button - 只在较大屏幕显示 */}
            {user && (
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 border border-red-200 dark:border-red-800 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {loggingOut ? '登出中' : '登出'}
              </button>
            )}

            <ThemeToggle />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 lg:hidden transition-all duration-200 border border-gray-200 dark:border-gray-600"
              aria-label="切換選單"
            >
              <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="border-t pb-4 pt-3 dark:border-gray-700 lg:hidden bg-gradient-to-b from-gray-50 to-white dark:from-gray-750 dark:to-gray-800">
            {/* Mobile User Info */}
            {user && (
              <div className="flex items-center justify-between px-4 py-3 mb-3 bg-gray-100 dark:bg-gray-700 rounded-xl mx-3 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {user.username}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded ${
                    user.role === 'admin'
                      ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
                  }`}>
                    {user.role === 'admin' ? '管理員' : '員工'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-red-600 dark:text-red-400 disabled:opacity-50 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-800"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {loggingOut ? '登出中' : '登出'}
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1.5 px-3">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 shadow-sm ${
                    pathname === item.href
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md scale-[1.02]'
                      : 'text-gray-700 bg-white hover:bg-gray-50 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
