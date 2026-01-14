'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Customer } from '@/types'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState<Partial<Customer>>({})
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  // 分頁狀態
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 购物金调整相关状态
  const [adjustingCustomer, setAdjustingCustomer] = useState<Customer | null>(null)
  const [adjustAmount, setAdjustAmount] = useState<string>('')
  const [adjustType, setAdjustType] = useState<'recharge' | 'deduct' | 'adjustment'>('recharge')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustError, setAdjustError] = useState('')

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (keyword) params.set('keyword', keyword)
      if (activeFilter !== null) params.set('active', String(activeFilter))

      const res = await fetch(`/api/customers?${params}`)
      const data = await res.json()
      if (data.ok) {
        setCustomers(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [activeFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1) // 搜尋時重置到第一頁
    fetchCustomers()
  }

  // 分頁計算
  const totalPages = Math.ceil(customers.length / pageSize)
  const paginatedCustomers = customers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData(customer)
    setError('')
  }

  const closeEditModal = () => {
    setEditingCustomer(null)
    setFormData({})
    setError('')
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCustomer) return

    setProcessing(true)
    setError('')

    try {
      const res = await fetch(`/api/customers?id=${editingCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (data.ok) {
        fetchCustomers()
        closeEditModal()
      } else {
        setError(data.error || '更新失敗')
      }
    } catch (err) {
      setError('更新失敗')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`確定要刪除客戶「${customer.customer_name}」嗎？\n\n此操作無法復原。`)) {
      return
    }

    try {
      const res = await fetch(`/api/customers?id=${customer.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.ok) {
        fetchCustomers()
        alert('刪除成功')
      } else {
        alert(data.error || '刪除失敗')
      }
    } catch (err) {
      alert('刪除失敗')
    }
  }

  const openAdjustModal = (customer: Customer) => {
    setAdjustingCustomer(customer)
    setAdjustAmount('')
    setAdjustType('recharge')
    setAdjustNote('')
    setAdjustError('')
  }

  const closeAdjustModal = () => {
    setAdjustingCustomer(null)
    setAdjustAmount('')
    setAdjustType('recharge')
    setAdjustNote('')
    setAdjustError('')
  }

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustingCustomer) return

    const amount = parseFloat(adjustAmount)
    if (isNaN(amount) || amount === 0) {
      setAdjustError('請輸入有效的金額')
      return
    }

    setProcessing(true)
    setAdjustError('')

    try {
      // 根据类型计算实际金额
      let finalAmount = amount
      if (adjustType === 'deduct') {
        finalAmount = -Math.abs(amount)
      } else if (adjustType === 'recharge') {
        finalAmount = Math.abs(amount)
      }

      const res = await fetch('/api/customers/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_code: adjustingCustomer.customer_code,
          amount: finalAmount,
          type: adjustType,
          note: adjustNote || undefined,
        }),
      })

      const data = await res.json()

      if (data.ok) {
        fetchCustomers()
        closeAdjustModal()
        alert('調整成功')
      } else {
        setAdjustError(data.error || '調整失敗')
      }
    } catch (err) {
      setAdjustError('調整失敗')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">客戶管理</h1>
          <Link
            href="/customers/new"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            + 新增客戶
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-lg bg-white dark:bg-gray-800 p-4 shadow">
          <form onSubmit={handleSearch} className="mb-4 flex gap-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜尋客戶名稱、編號、電話、地址"
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700 placeholder:text-gray-900 dark:placeholder:text-gray-400"
            />
            <button
              type="submit"
              className="rounded bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
            >
              搜尋
            </button>
          </form>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveFilter(null)}
              className={`rounded px-4 py-1 font-medium ${activeFilter === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
            >
              全部
            </button>
            <button
              onClick={() => setActiveFilter(true)}
              className={`rounded px-4 py-1 font-medium ${activeFilter === true
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
            >
              啟用
            </button>
            <button
              onClick={() => setActiveFilter(false)}
              className={`rounded px-4 py-1 font-medium ${activeFilter === false
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
            >
              停用
            </button>
          </div>
        </div>

        {/* Customers table */}
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-900 dark:text-gray-100">載入中...</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-gray-900 dark:text-gray-100">沒有客戶資料</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">客戶編號</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">客戶名稱</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">電話</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">門市地址</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">宅配地址</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">購物金</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">付款方式</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">LINE ID</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">狀態</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{customer.customer_code}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{customer.customer_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{customer.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div className="max-w-[200px] truncate" title={customer.store_address || ''}>
                          {customer.store_address || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div className="max-w-[200px] truncate" title={customer.delivery_address || ''}>
                          {customer.delivery_address || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-bold ${customer.store_credit >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                          }`}>
                          ${customer.store_credit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {customer.payment_method === 'cash' && '現金'}
                          {customer.payment_method === 'card' && '刷卡'}
                          {customer.payment_method === 'transfer' && '轉帳'}
                          {customer.payment_method === 'cod' && '貨到付款'}
                          {!customer.payment_method && '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{customer.line_id || '-'}</td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${customer.is_active
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                          {customer.is_active ? '啟用' : '停用'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => openAdjustModal(customer)}
                            className="rounded px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                            title="調整購物金"
                          >
                            💰
                          </button>
                          <button
                            onClick={() => openEditModal(customer)}
                            className="rounded px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => handleDelete(customer)}
                            className="rounded px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            刪除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 分頁控制 */}
          {!loading && customers.length > 0 && (
            <div className="px-6 py-4 border-t dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                共 {customers.length} 筆資料，顯示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, customers.length)} 筆
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                >
                  <option value={10}>10 筆/頁</option>
                  <option value={20}>20 筆/頁</option>
                  <option value={50}>50 筆/頁</option>
                  <option value={100}>100 筆/頁</option>
                </select>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded px-3 py-1 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一頁
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded px-3 py-1 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-800 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-100">編輯客戶</h2>

            {error && (
              <div className="mb-4 rounded bg-red-50 dark:bg-red-900 p-3 text-red-700 dark:text-red-200">{error}</div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                    客戶編號 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customer_code || ''}
                    onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                    客戶名稱 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name || ''}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">電話</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">LINE ID</label>
                  <input
                    type="text"
                    value={formData.line_id || ''}
                    onChange={(e) => setFormData({ ...formData, line_id: e.target.value })}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">付款方式</label>
                  <select
                    value={formData.payment_method || ''}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                  >
                    <option value="">請選擇</option>
                    <option value="cash">現金</option>
                    <option value="card">刷卡</option>
                    <option value="transfer">轉帳</option>
                    <option value="cod">貨到付款</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">門市地址</label>
                <input
                  type="text"
                  value={formData.store_address || ''}
                  onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                  placeholder="客戶店面地址"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">宅配地址</label>
                <input
                  type="text"
                  value={formData.delivery_address || ''}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                  placeholder="宅配或郵寄地址"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">備註</label>
                <textarea
                  value={formData.note || ''}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  rows={3}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">購物金餘額</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.store_credit ?? 0}
                    onChange={(e) => setFormData({ ...formData, store_credit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                    disabled
                    title="請使用「調整購物金」按鈕進行修改"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">購物金請使用下方的「調整購物金」按鈕修改</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">信用額度</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.credit_limit ?? 0}
                    onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">設為 0 表示不允許欠款</p>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active ?? true}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">啟用</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-800 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {processing ? '更新中...' : '確認更新'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {adjustingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-100">調整購物金</h2>

            <div className="mb-4 rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
              <div className="mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">客戶：</span>
                <span className="ml-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {adjustingCustomer.customer_name} ({adjustingCustomer.customer_code})
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">當前餘額：</span>
                <span className={`ml-2 text-lg font-bold ${adjustingCustomer.store_credit >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                  }`}>
                  ${adjustingCustomer.store_credit?.toFixed(2) || '0.00'}
                </span>
              </div>
              {adjustingCustomer.credit_limit > 0 && (
                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">信用額度：</span>
                  <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                    ${adjustingCustomer.credit_limit.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {adjustError && (
              <div className="mb-4 rounded bg-red-50 dark:bg-red-900/30 p-3 text-red-700 dark:text-red-200">{adjustError}</div>
            )}

            <form onSubmit={handleAdjustBalance} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  調整類型 <span className="text-red-500">*</span>
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                  required
                >
                  <option value="recharge">充值（增加購物金）</option>
                  <option value="deduct">扣減（減少購物金）</option>
                  <option value="adjustment">調整（可正可負）</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  金額 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                  placeholder="請輸入金額"
                  required
                />
                {adjustType === 'adjustment' && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">正數為增加，負數為減少</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">備註</label>
                <textarea
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 dark:bg-gray-700"
                  placeholder="選填"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeAdjustModal}
                  className="flex-1 rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600"
                >
                  {processing ? '處理中...' : '確認調整'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
