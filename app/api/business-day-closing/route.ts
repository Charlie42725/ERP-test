import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET /api/business-day-closing - 獲取上次結帳時間和當日統計
export async function GET(request: NextRequest) {
  try {
    // 從 URL 參數獲取來源（pos 或 live），預設為 pos
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || 'pos'

    if (source !== 'pos' && source !== 'live') {
      return NextResponse.json(
        { ok: false, error: 'Invalid source. Must be "pos" or "live"' },
        { status: 400 }
      )
    }

    // 1. 獲取上次結帳時間（按來源）
    const { data: lastClosing } = await (supabaseServer
      .from('business_day_closings') as any)
      .select('closing_time')
      .eq('source', source)
      .order('closing_time', { ascending: false })
      .limit(1)
      .single()

    // 如果沒有結帳記錄，使用今天零點（台灣時區 UTC+8）
    let lastClosingTime = lastClosing?.closing_time
    if (!lastClosingTime) {
      // 計算台灣時區的今天零點
      const now = new Date()
      const taiwanNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
      const taiwanToday = taiwanNow.toISOString().split('T')[0]
      // 台灣今天零點 = UTC 前一天的 16:00
      const utcMidnight = new Date(taiwanToday + 'T00:00:00+08:00')
      lastClosingTime = utcMidnight.toISOString()

      console.log('[日結 GET] 時間計算:', {
        now: now.toISOString(),
        taiwanNow: taiwanNow.toISOString(),
        taiwanToday,
        lastClosingTime
      })
    }

    // 2. 計算當日銷售統計（按來源篩選，包含未收款訂單）
    const { data: sales, error: salesError } = await (supabaseServer
      .from('sales') as any)
      .select('total, payment_method, account_id, is_paid, source, sale_no, created_at')
      .gte('created_at', lastClosingTime)
      .eq('source', source)
      .eq('status', 'confirmed')
      // 包含金額為 0 的訂單（例如：促銷、贈品等）

    console.log('[日結 GET] 查詢參數:', { source, lastClosingTime })
    console.log('[日結 GET] 找到的銷售:', sales)

    if (salesError) {
      console.error('[日結 GET] 查詢錯誤:', salesError)
      return NextResponse.json(
        { ok: false, error: salesError.message },
        { status: 500 }
      )
    }

    // 3. 統計各種付款方式（區分已收款和未收款）
    const stats = {
      sales_count: sales?.length || 0,

      // 總計（包含未收款）
      total_sales: 0,
      total_cash: 0,
      total_card: 0,
      total_transfer: 0,
      total_cod: 0,

      // 已收款統計
      paid_count: 0,
      paid_sales: 0,
      paid_cash: 0,
      paid_card: 0,
      paid_transfer: 0,
      paid_cod: 0,

      // 未收款統計
      unpaid_count: 0,
      unpaid_sales: 0,
      unpaid_cash: 0,
      unpaid_card: 0,
      unpaid_transfer: 0,
      unpaid_cod: 0,

      sales_by_account: {} as { [key: string]: number },
    }

    sales?.forEach((sale: any) => {
      // 總計統計
      stats.total_sales += sale.total

      // 按付款方式分類（總計）
      if (sale.payment_method === 'cash') {
        stats.total_cash += sale.total
      } else if (sale.payment_method === 'card') {
        stats.total_card += sale.total
      } else if (sale.payment_method === 'cod') {
        stats.total_cod += sale.total
      } else if (sale.payment_method.startsWith('transfer_')) {
        stats.total_transfer += sale.total
      }

      // 區分已收款和未收款
      if (sale.is_paid) {
        stats.paid_count += 1
        stats.paid_sales += sale.total

        if (sale.payment_method === 'cash') {
          stats.paid_cash += sale.total
        } else if (sale.payment_method === 'card') {
          stats.paid_card += sale.total
        } else if (sale.payment_method === 'cod') {
          stats.paid_cod += sale.total
        } else if (sale.payment_method.startsWith('transfer_')) {
          stats.paid_transfer += sale.total
        }

        // 按帳戶統計（僅已收款）
        if (sale.account_id) {
          stats.sales_by_account[sale.account_id] =
            (stats.sales_by_account[sale.account_id] || 0) + sale.total
        }
      } else {
        stats.unpaid_count += 1
        stats.unpaid_sales += sale.total

        if (sale.payment_method === 'cash') {
          stats.unpaid_cash += sale.total
        } else if (sale.payment_method === 'card') {
          stats.unpaid_card += sale.total
        } else if (sale.payment_method === 'cod') {
          stats.unpaid_cod += sale.total
        } else if (sale.payment_method.startsWith('transfer_')) {
          stats.unpaid_transfer += sale.total
        }
      }
    })

    return NextResponse.json({
      ok: true,
      data: {
        last_closing_time: lastClosingTime,
        current_stats: stats,
      },
    })
  } catch (error) {
    console.error('Business day closing GET error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/business-day-closing - 執行日結
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, note } = body

    // 驗證來源參數
    if (!source || (source !== 'pos' && source !== 'live')) {
      return NextResponse.json(
        { ok: false, error: 'Invalid source. Must be "pos" or "live"' },
        { status: 400 }
      )
    }

    // 1. 獲取上次結帳時間（按來源）
    const { data: lastClosing } = await (supabaseServer
      .from('business_day_closings') as any)
      .select('closing_time')
      .eq('source', source)
      .order('closing_time', { ascending: false })
      .limit(1)
      .single()

    // 如果沒有結帳記錄，使用今天零點（台灣時區 UTC+8）
    let lastClosingTime = lastClosing?.closing_time
    if (!lastClosingTime) {
      // 計算台灣時區的今天零點
      const now = new Date()
      const taiwanNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
      const taiwanToday = taiwanNow.toISOString().split('T')[0]
      // 台灣今天零點 = UTC 前一天的 16:00
      const utcMidnight = new Date(taiwanToday + 'T00:00:00+08:00')
      lastClosingTime = utcMidnight.toISOString()
    }

    // 2. 計算當日銷售統計（按來源篩選，包含未收款訂單）
    const { data: sales, error: salesError } = await (supabaseServer
      .from('sales') as any)
      .select('total, payment_method, account_id, is_paid, source, sale_no, created_at')
      .gte('created_at', lastClosingTime)
      .eq('source', source)
      .eq('status', 'confirmed')
      .gt('total', 0)  // 排除金額為 0 的訂單

    console.log('[日結 POST] 查詢參數:', { source, lastClosingTime })
    console.log('[日結 POST] 找到的銷售:', sales)

    if (salesError) {
      console.error('[日結 POST] 查詢錯誤:', salesError)
      return NextResponse.json(
        { ok: false, error: salesError.message },
        { status: 500 }
      )
    }

    // 3. 統計各種付款方式（區分已收款和未收款）
    const stats = {
      sales_count: sales?.length || 0,

      // 總計（包含未收款）
      total_sales: 0,
      total_cash: 0,
      total_card: 0,
      total_transfer: 0,
      total_cod: 0,

      // 已收款統計
      paid_count: 0,
      paid_sales: 0,
      paid_cash: 0,
      paid_card: 0,
      paid_transfer: 0,
      paid_cod: 0,

      // 未收款統計
      unpaid_count: 0,
      unpaid_sales: 0,

      sales_by_account: {} as { [key: string]: number },
    }

    sales?.forEach((sale: any) => {
      // 總計統計
      stats.total_sales += sale.total

      // 按付款方式分類（總計）
      if (sale.payment_method === 'cash') {
        stats.total_cash += sale.total
      } else if (sale.payment_method === 'card') {
        stats.total_card += sale.total
      } else if (sale.payment_method === 'cod') {
        stats.total_cod += sale.total
      } else if (sale.payment_method.startsWith('transfer_')) {
        stats.total_transfer += sale.total
      }

      // 區分已收款和未收款
      if (sale.is_paid) {
        stats.paid_count += 1
        stats.paid_sales += sale.total

        if (sale.payment_method === 'cash') {
          stats.paid_cash += sale.total
        } else if (sale.payment_method === 'card') {
          stats.paid_card += sale.total
        } else if (sale.payment_method === 'cod') {
          stats.paid_cod += sale.total
        } else if (sale.payment_method.startsWith('transfer_')) {
          stats.paid_transfer += sale.total
        }

        // 按帳戶統計（僅已收款）
        if (sale.account_id) {
          stats.sales_by_account[sale.account_id] =
            (stats.sales_by_account[sale.account_id] || 0) + sale.total
        }
      } else {
        stats.unpaid_count += 1
        stats.unpaid_sales += sale.total
      }
    })

    // 4. 插入日結記錄
    const { data: closing, error: closingError } = await (supabaseServer
      .from('business_day_closings') as any)
      .insert({
        source: source,
        closing_time: new Date().toISOString(),
        sales_count: stats.sales_count,
        total_sales: stats.total_sales,
        total_cash: stats.total_cash,
        total_card: stats.total_card,
        total_transfer: stats.total_transfer,
        total_cod: stats.total_cod,
        // 已收款統計
        paid_count: stats.paid_count,
        paid_sales: stats.paid_sales,
        paid_cash: stats.paid_cash,
        paid_card: stats.paid_card,
        paid_transfer: stats.paid_transfer,
        paid_cod: stats.paid_cod,
        // 未收款統計
        unpaid_count: stats.unpaid_count,
        unpaid_sales: stats.unpaid_sales,
        sales_by_account: stats.sales_by_account,
        note: note || null,
      })
      .select()
      .single()

    if (closingError) {
      return NextResponse.json(
        { ok: false, error: closingError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { ok: true, data: closing },
      { status: 201 }
    )
  } catch (error) {
    console.error('Business day closing POST error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
