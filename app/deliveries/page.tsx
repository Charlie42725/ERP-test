'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'

type DeliveryItem = {
  id: string
  product_id: string
  quantity: number
  products: {
    name: string
    item_code: string
    unit: string
    stock: number
  }
}

type Delivery = {
  id: string
  delivery_no: string
  status: string
  delivery_date: string | null
  method: string | null
  note: string | null
  created_at: string
  sales: {
    sale_no: string
    customer_code: string | null
    total: number
    is_paid: boolean
    customers?: {
      customer_name: string
    }
  }
  delivery_items: DeliveryItem[]
}

export default function PendingDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchDeliveries()
  }, [])

  const fetchDeliveries = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/deliveries?status=draft')
      const data = await res.json()
      if (data.ok) {
        setDeliveries(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch deliveries:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const handleConfirmDelivery = async (id: string, deliveryNo: string) => {
    if (!confirm(`確定要確認出貨 ${deliveryNo} 嗎？\n\n此操作將扣減庫存，且無法復原。`)) {
      return
    }

    setConfirming(id)
    try {
      const res = await fetch(`/api/deliveries/${id}/confirm`, {
        method: 'PATCH',
      })

      const data = await res.json()

      if (data.ok) {
        alert('出貨確認成功，庫存已扣減')
        fetchDeliveries() // 刷新列表
      } else {
        alert(`確認失敗：${data.error}`)
      }
    } catch (err) {
      alert('確認失敗')
    } finally {
      setConfirming(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">待出貨清單</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              已下單但尚未出貨的訂單
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-900 dark:text-gray-100">載入中...</div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-4">📦</div>
              <div className="text-gray-900 dark:text-gray-100 font-semibold mb-2">沒有待出貨訂單</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">所有訂單都已出貨</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">出貨單號</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">銷售單號</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">客戶</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">金額</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">收款狀態</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">交貨方式</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">建單時間</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {deliveries.map((delivery) => (
                    <React.Fragment key={delivery.id}>
                      <tr
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                        onClick={() => toggleRow(delivery.id)}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-600">
                              {expandedRows.has(delivery.id) ? '▼' : '▶'}
                            </span>
                            {delivery.delivery_no}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {delivery.sales.sale_no}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {delivery.sales.customers?.customer_name || delivery.sales.customer_code || '散客'}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(delivery.sales.total)}
                        </td>
                        <td className="px-6 py-4 text-center text-sm">
                          <span
                            className={`inline-block rounded px-2 py-1 text-xs ${
                              delivery.sales.is_paid
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                            }`}
                          >
                            {delivery.sales.is_paid ? '已收款' : '未收款'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {delivery.method || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {formatDate(delivery.created_at)}
                        </td>
                        <td className="px-6 py-4 text-center text-sm" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleConfirmDelivery(delivery.id, delivery.delivery_no)}
                            disabled={confirming === delivery.id}
                            className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {confirming === delivery.id ? '處理中...' : '確認出貨'}
                          </button>
                        </td>
                      </tr>
                      {expandedRows.has(delivery.id) && delivery.delivery_items && (
                        <tr key={`${delivery.id}-details`}>
                          <td colSpan={8} className="bg-gray-50 dark:bg-gray-900 px-6 py-4">
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                              <h4 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">出貨明細</h4>
                              {delivery.note && (
                                <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-semibold">備註：</span>{delivery.note}
                                </div>
                              )}
                              <table className="w-full">
                                <thead className="border-b">
                                  <tr>
                                    <th className="pb-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-100">品號</th>
                                    <th className="pb-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-100">商品名稱</th>
                                    <th className="pb-2 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">數量</th>
                                    <th className="pb-2 text-right text-xs font-semibold text-gray-900 dark:text-gray-100">目前庫存</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                  {delivery.delivery_items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="py-2 text-sm text-gray-900 dark:text-gray-100">{item.products.item_code}</td>
                                      <td className="py-2 text-sm text-gray-900 dark:text-gray-100">{item.products.name}</td>
                                      <td className="py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                                        {item.quantity} {item.products.unit}
                                      </td>
                                      <td className="py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                                        <span className={item.products.stock < item.quantity ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                                          {item.products.stock}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
