import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST /api/rebuild-ar - Rebuild AR records for all unpaid sales
export async function POST(request: NextRequest) {
  try {
    // Get all sales
    const { data: sales, error: salesError } = await supabaseServer
      .from('sales')
      .select('*, sale_items(*)')

    if (salesError) {
      return NextResponse.json(
        { ok: false, error: salesError.message },
        { status: 500 }
      )
    }

    if (!sales || sales.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No sales found',
        created: 0
      })
    }

    let totalCreated = 0
    const results = []

    for (const sale of sales) {
      // Check if AR records already exist for this sale
      const { data: existingAR } = await supabaseServer
        .from('partner_accounts')
        .select('id, sale_item_id')
        .eq('ref_type', 'sale')
        .eq('ref_id', sale.id)

      // If all items already have AR records, skip
      const items = sale.sale_items || []
      if (items.length === 0) {
        results.push({
          sale_no: sale.sale_no,
          status: 'error',
          message: 'No items found'
        })
        continue
      }

      const existingItemIds = new Set(existingAR?.map(ar => ar.sale_item_id).filter(Boolean))
      const itemsToCreate = items.filter((item: any) => !existingItemIds.has(item.id))

      if (itemsToCreate.length === 0) {
        results.push({
          sale_no: sale.sale_no,
          status: 'skipped',
          message: 'AR records already exist for all items'
        })
        continue
      }

      // Get total AR amount and paid amount for this sale
      let totalARAmount = 0
      let totalPaid = 0
      if (existingAR && existingAR.length > 0) {
        const { data: existingARDetails } = await supabaseServer
          .from('partner_accounts')
          .select('amount, received_paid')
          .eq('ref_type', 'sale')
          .eq('ref_id', sale.id)

        totalARAmount = existingARDetails?.reduce((sum, ar) => sum + ar.amount, 0) || 0
        totalPaid = existingARDetails?.reduce((sum, ar) => sum + ar.received_paid, 0) || 0
      }

      // Calculate remaining amount to allocate
      const totalItemSubtotal = items.reduce((sum: number, item: any) => sum + item.subtotal, 0)
      const remainingAmount = sale.total - totalARAmount

      // Delete old AR records without sale_item_id
      if (existingAR && existingAR.some(ar => !ar.sale_item_id)) {
        await supabaseServer
          .from('partner_accounts')
          .delete()
          .eq('ref_type', 'sale')
          .eq('ref_id', sale.id)
          .is('sale_item_id', null)
      }

      // Create new AR records for items that don't have them
      const arRecords = itemsToCreate.map((item: any) => {
        // Proportionally distribute the paid amount
        const itemPortion = item.subtotal / totalItemSubtotal
        const itemPaid = totalPaid > 0 ? Math.round(totalPaid * itemPortion) : 0

        return {
          partner_type: 'customer',
          partner_code: sale.customer_code,
          direction: 'AR',
          ref_type: 'sale',
          ref_id: sale.id,
          sale_item_id: item.id,
          amount: item.subtotal,
          received_paid: itemPaid,
          due_date: sale.sale_date || new Date().toISOString().split('T')[0],
          status: itemPaid >= item.subtotal ? 'paid' : itemPaid > 0 ? 'partial' : 'unpaid',
        }
      })

      const { error: insertError } = await supabaseServer
        .from('partner_accounts')
        .insert(arRecords)

      if (insertError) {
        results.push({
          sale_no: sale.sale_no,
          status: 'error',
          message: insertError.message
        })
      } else {
        totalCreated += itemsToCreate.length
        results.push({
          sale_no: sale.sale_no,
          status: 'success',
          items_created: itemsToCreate.length
        })
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Created ${totalCreated} AR records for ${sales.length} sales`,
      created: totalCreated,
      results
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
