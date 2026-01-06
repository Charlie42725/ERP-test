import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/purchases/:id - Get purchase details with items
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // Get purchase
    const { data: purchase, error: purchaseError } = await (supabaseServer
      .from('purchases') as any)
      .select('*')
      .eq('id', id)
      .single()

    if (purchaseError) {
      return NextResponse.json(
        { ok: false, error: 'Purchase not found' },
        { status: 404 }
      )
    }

    // Get purchase items with product details
    const { data: items, error: itemsError } = await (supabaseServer
      .from('purchase_items') as any)
      .select(`
        *,
        products:product_id (
          id,
          item_code,
          name,
          unit
        )
      `)
      .eq('purchase_id', id)

    if (itemsError) {
      return NextResponse.json(
        { ok: false, error: itemsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...purchase,
        items,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/purchases/:id - Delete purchase and restore inventory
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // 1. Delete related partner accounts (AP)
    // Delete by purchase_item_id (new method)
    const { data: itemsForAP, error: itemsForAPError } = await (supabaseServer
      .from('purchase_items') as any)
      .select('id')
      .eq('purchase_id', id)

    if (!itemsForAPError && itemsForAP && itemsForAP.length > 0) {
      const itemIds = itemsForAP.map((item: any) => item.id)

      // Delete AP records by purchase_item_id
      await (supabaseServer
        .from('partner_accounts') as any)
        .delete()
        .in('purchase_item_id', itemIds)
    }

    // Also delete by ref_id (old method, for backward compatibility)
    const { error: apDeleteError2 } = await (supabaseServer
      .from('partner_accounts') as any)
      .delete()
      .eq('ref_type', 'purchase')
      .eq('ref_id', id)

    if (apDeleteError2) {
      return NextResponse.json(
        { ok: false, error: `Failed to delete AP: ${apDeleteError2.message}` },
        { status: 500 }
      )
    }

    // 2. Delete purchase items (triggers will handle inventory restoration via inventory_logs)
    await (supabaseServer.from('purchase_items') as any).delete().eq('purchase_id', id)

    // 3. Delete purchase
    const { error: deleteError } = await (supabaseServer
      .from('purchases') as any)
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json(
        { ok: false, error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
