import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// Helper function to calculate days since a date
function daysSince(dateString: string): number {
  const date = new Date(dateString)
  const today = new Date()
  const diffTime = today.getTime() - date.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

// Helper function to calculate days until a date
function daysUntil(dateString: string): number {
  const date = new Date(dateString)
  const today = new Date()
  const diffTime = date.getTime() - today.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

// GET /api/finance/dashboard - 獲取財務總覽數據
export async function GET(request: NextRequest) {
  try {
    const today = new Date().toISOString().split('T')[0]

    // 1. 獲取所有帳戶及其餘額
    const { data: accounts, error: accountsError } = await (supabaseServer
      .from('accounts') as any)
      .select('*')
      .eq('is_active', true)
      .order('account_type', { ascending: true })
      .order('account_name', { ascending: true })

    if (accountsError) {
      return NextResponse.json(
        { ok: false, error: accountsError.message },
        { status: 500 }
      )
    }

    // 2. 計算今日支出
    const { data: todayExpenses, error: expensesError } = await (supabaseServer
      .from('expenses') as any)
      .select('amount, account_id')
      .eq('date', today)

    if (expensesError) {
      return NextResponse.json(
        { ok: false, error: expensesError.message },
        { status: 500 }
      )
    }

    const todayExpensesTotal = todayExpenses?.reduce(
      (sum: number, exp: any) => sum + exp.amount,
      0
    ) || 0

    // 3. 計算今日銷售收入
    const { data: todaySales, error: salesError } = await (supabaseServer
      .from('sales') as any)
      .select('total, payment_method, account_id, is_paid')
      .gte('sale_date', today)
      .lte('sale_date', today + 'T23:59:59')
      .eq('is_paid', true)

    const todaySalesTotal = salesError ? 0 : (todaySales?.reduce(
      (sum: number, sale: any) => sum + sale.total,
      0
    ) || 0)

    // 4. 按帳戶類型分組
    const accountsByType = {
      cash: accounts?.filter((a: any) => a.account_type === 'cash') || [],
      bank: accounts?.filter((a: any) => a.account_type === 'bank') || [],
      petty_cash: accounts?.filter((a: any) => a.account_type === 'petty_cash') || [],
    }

    // 5. 計算各類型總額
    const totals = {
      cash: accountsByType.cash.reduce((sum: number, a: any) => sum + a.balance, 0),
      bank: accountsByType.bank.reduce((sum: number, a: any) => sum + a.balance, 0),
      petty_cash: accountsByType.petty_cash.reduce((sum: number, a: any) => sum + a.balance, 0),
      total: accounts?.reduce((sum: number, a: any) => sum + a.balance, 0) || 0,
    }

    // 6. 今日淨現金流
    const todayNetCashFlow = todaySalesTotal - todayExpensesTotal

    // 7. 今日各帳戶支出統計
    const todayExpensesByAccount = todayExpenses?.reduce((acc: any, exp: any) => {
      if (exp.account_id) {
        acc[exp.account_id] = (acc[exp.account_id] || 0) + exp.amount
      }
      return acc
    }, {}) || {}

    // 8. 今日各帳戶收入統計
    const todaySalesByAccount = todaySales?.reduce((acc: any, sale: any) => {
      if (sale.account_id) {
        acc[sale.account_id] = (acc[sale.account_id] || 0) + sale.total
      }
      return acc
    }, {}) || {}

    // ========== 新增：AR 帳齡分析 ==========
    const { data: arAccounts } = await supabaseServer
      .from('partner_accounts')
      .select('balance, due_date, partner_code')
      .eq('partner_type', 'customer')
      .eq('direction', 'AR')
      .neq('status', 'paid')

    const arAging = {
      current: 0,      // 0-30 天
      days31_60: 0,    // 31-60 天
      days61_90: 0,    // 61-90 天
      over90: 0,       // 90 天以上
      total: 0
    }

    const arOverdueList: Array<{ partner_code: string; balance: number; days_overdue: number }> = []

      ; (arAccounts as any[])?.forEach(ar => {
        const daysOverdue = daysSince(ar.due_date)
        arAging.total += ar.balance

        if (daysOverdue <= 0) {
          arAging.current += ar.balance
        } else if (daysOverdue <= 30) {
          arAging.current += ar.balance
        } else if (daysOverdue <= 60) {
          arAging.days31_60 += ar.balance
        } else if (daysOverdue <= 90) {
          arAging.days61_90 += ar.balance
        } else {
          arAging.over90 += ar.balance
        }

        // 逾期清單（只列已逾期的）
        if (daysOverdue > 0) {
          arOverdueList.push({
            partner_code: ar.partner_code,
            balance: ar.balance,
            days_overdue: daysOverdue
          })
        }
      })

    // 排序逾期清單（逾期天數最多的排前面）
    arOverdueList.sort((a, b) => b.days_overdue - a.days_overdue)

    // ========== 新增：AP 到期提醒 ==========
    const { data: apAccounts } = await supabaseServer
      .from('partner_accounts')
      .select('balance, due_date, partner_code, ref_id')
      .eq('partner_type', 'vendor')
      .eq('direction', 'AP')
      .neq('status', 'paid')

    const apAging = {
      current: 0,
      days31_60: 0,
      days61_90: 0,
      over90: 0,
      total: 0
    }

    const apDueSoon: Array<{ partner_code: string; balance: number; days_until_due: number }> = []
    const apOverdueList: Array<{ partner_code: string; balance: number; days_overdue: number }> = []

      ; (apAccounts as any[])?.forEach(ap => {
        const daysUntilDue = daysUntil(ap.due_date)
        apAging.total += ap.balance

        if (daysUntilDue >= 0) {
          // 未到期
          if (daysUntilDue <= 7) {
            apDueSoon.push({
              partner_code: ap.partner_code,
              balance: ap.balance,
              days_until_due: daysUntilDue
            })
          }
          apAging.current += ap.balance
        } else {
          // 已逾期
          const daysOverdue = Math.abs(daysUntilDue)
          if (daysOverdue <= 30) {
            apAging.current += ap.balance
          } else if (daysOverdue <= 60) {
            apAging.days31_60 += ap.balance
          } else if (daysOverdue <= 90) {
            apAging.days61_90 += ap.balance
          } else {
            apAging.over90 += ap.balance
          }

          apOverdueList.push({
            partner_code: ap.partner_code,
            balance: ap.balance,
            days_overdue: daysOverdue
          })
        }
      })

    // 排序
    apDueSoon.sort((a, b) => a.days_until_due - b.days_until_due)
    apOverdueList.sort((a, b) => b.days_overdue - a.days_overdue)

    // ========== 新增：庫存總金額 ==========
    const { data: products } = await supabaseServer
      .from('products')
      .select('stock, avg_cost')
      .eq('is_active', true)

    const inventoryValue = (products as any[])?.reduce(
      (sum, p) => sum + (p.stock * (p.avg_cost || 0)),
      0
    ) || 0

    const inventoryCount = (products as any[])?.reduce(
      (sum, p) => sum + p.stock,
      0
    ) || 0

    // ========== 新增：近7天毛利率趨勢 ==========
    const profitTrend: Array<{ date: string; revenue: number; cost: number; grossProfit: number; grossMargin: number }> = []

    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const { data: daySales } = await (supabaseServer
        .from('sales') as any)
        .select('total, sale_items(cost, quantity)')
        .gte('sale_date', dateStr)
        .lte('sale_date', dateStr + 'T23:59:59')
        .eq('status', 'confirmed')

      const revenue = (daySales as any[])?.reduce((sum, s) => sum + s.total, 0) || 0
      const cost = (daySales as any[])?.reduce((sum, s) => {
        const saleCost = (s.sale_items || []).reduce(
          (itemSum: number, item: any) => itemSum + (item.cost || 0) * item.quantity,
          0
        )
        return sum + saleCost
      }, 0) || 0

      const grossProfit = revenue - cost
      const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

      profitTrend.push({
        date: dateStr,
        revenue,
        cost,
        grossProfit,
        grossMargin: Math.round(grossMargin * 10) / 10
      })
    }

    return NextResponse.json({
      ok: true,
      data: {
        accounts: accountsByType,
        totals,
        today: {
          sales: todaySalesTotal,
          expenses: todayExpensesTotal,
          netCashFlow: todayNetCashFlow,
          expensesByAccount: todayExpensesByAccount,
          salesByAccount: todaySalesByAccount,
        },
        // 新增數據
        arAging,
        arOverdueList: arOverdueList.slice(0, 10), // 前10筆
        apAging,
        apDueSoon: apDueSoon.slice(0, 10),
        apOverdueList: apOverdueList.slice(0, 10),
        inventory: {
          totalValue: inventoryValue,
          totalQuantity: inventoryCount
        },
        profitTrend,
      },
    })
  } catch (error) {
    console.error('Finance dashboard error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
