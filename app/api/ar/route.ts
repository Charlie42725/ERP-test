import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET /api/ar - List accounts receivable
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerCode = searchParams.get('customer_code')
    const status = searchParams.get('status')
    const dueBefore = searchParams.get('due_before')
    const keyword = searchParams.get('keyword')

    let query = supabaseServer
      .from('partner_accounts')
      .select('*')
      .eq('partner_type', 'customer')
      .eq('direction', 'AR')
      .order('created_at', { ascending: false })

    if (customerCode) {
      query = query.eq('partner_code', customerCode)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (dueBefore) {
      query = query.lte('due_date', dueBefore)
    }

    if (keyword) {
      query = query.ilike('partner_code', `%${keyword}%`)
    }

    const { data: accounts, error } = await query

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    // Fetch customer details
    const customerCodes = [...new Set((accounts as any[])?.map(a => a.partner_code) || [])]
    const { data: customers } = await supabaseServer
      .from('customers')
      .select('customer_code, customer_name')
      .in('customer_code', customerCodes)

    // Fetch sale item details for accounts with sale_item_id
    const itemIds = (accounts as any[])?.filter(a => a.sale_item_id).map(a => a.sale_item_id) || []
    let itemsMap = new Map()

    if (itemIds.length > 0) {
      const { data: items } = await supabaseServer
        .from('sale_items')
        .select('id, quantity, price, subtotal, product_id, sale_id, snapshot_name, products:product_id(item_code, unit)')
        .in('id', itemIds)

      itemsMap = new Map(
        (items as any[])?.map(item => [item.id, item]) || []
      )
    }

    // Fetch sales details to get sale_no
    const saleIds = [...new Set((accounts as any[])?.filter(a => a.ref_type === 'sale').map(a => a.ref_id) || [])]
    let salesMap = new Map()

    if (saleIds.length > 0) {
      const { data: sales } = await supabaseServer
        .from('sales')
        .select('id, sale_no, sale_date, payment_method')
        .in('id', saleIds)

      salesMap = new Map(
        (sales as any[])?.map(s => [s.id, s]) || []
      )
    }

    // Map customer names and sales to accounts
    const customersMap = new Map(
      (customers as any[])?.map(c => [c.customer_code, c]) || []
    )

    const accountsWithDetails = (accounts as any[])?.map(account => ({
      ...account,
      customers: customersMap.get(account.partner_code) || null,
      sale_item: account.sale_item_id ? itemsMap.get(account.sale_item_id) : null,
      sales: account.ref_type === 'sale' ? salesMap.get(account.ref_id) : null
    }))

    return NextResponse.json({ ok: true, data: accountsWithDetails })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
