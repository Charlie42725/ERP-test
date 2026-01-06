import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { saleUpdateSchema } from '@/lib/schemas'
import { fromZodError } from 'zod-validation-error'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/sales/:id - Get sale details with items
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // Get sale
    const { data: sale, error: saleError } = await (supabaseServer
      .from('sales') as any)
      .select('*')
      .eq('id', id)
      .single()

    if (saleError) {
      return NextResponse.json(
        { ok: false, error: 'Sale not found' },
        { status: 404 }
      )
    }

    // Get sale items with product details
    const { data: items, error: itemsError } = await (supabaseServer
      .from('sale_items') as any)
      .select(`
        *,
        products:product_id (
          id,
          item_code,
          name,
          unit
        )
      `)
      .eq('sale_id', id)

    if (itemsError) {
      return NextResponse.json(
        { ok: false, error: itemsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...sale,
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

// PATCH /api/sales/:id - Update sale payment method
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    // Validate input
    const validation = saleUpdateSchema.safeParse(body)
    if (!validation.success) {
      const error = fromZodError(validation.error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      )
    }

    const { payment_method } = validation.data

    // Update sale payment method
    const { data: sale, error } = await (supabaseServer
      .from('sales') as any)
      .update({
        payment_method,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, data: sale })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/sales/:id - Delete sale and restore inventory
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // 1. Check if sale exists and get its status
    const { data: sale, error: fetchError } = await (supabaseServer
      .from('sales') as any)
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError || !sale) {
      return NextResponse.json(
        { ok: false, error: 'Sale not found' },
        { status: 404 }
      )
    }

    // 2. If confirmed, need to restore ONLY ichiban kuji remaining (product stock auto-restored by DB trigger)
    if (sale.status === 'confirmed') {
      // Get all sale items (including ichiban kuji info)
      const { data: items, error: itemsError } = await (supabaseServer
        .from('sale_items') as any)
        .select('product_id, quantity, ichiban_kuji_prize_id, ichiban_kuji_id')
        .eq('sale_id', id)

      if (itemsError) {
        return NextResponse.json(
          { ok: false, error: itemsError.message },
          { status: 500 }
        )
      }

      // Restore ONLY ichiban kuji remaining (product stock will be auto-restored by DB trigger)
      for (const item of items || []) {
        // 如果是從一番賞售出的，恢復一番賞庫存
        if (item.ichiban_kuji_prize_id) {
          const { data: prize, error: fetchPrizeError } = await (supabaseServer
            .from('ichiban_kuji_prizes') as any)
            .select('remaining')
            .eq('id', item.ichiban_kuji_prize_id)
            .single()

          if (fetchPrizeError) {
            return NextResponse.json(
              { ok: false, error: `Failed to fetch prize: ${fetchPrizeError.message}` },
              { status: 500 }
            )
          }

          // 恢復一番賞庫的 remaining
          const { error: updatePrizeError } = await (supabaseServer
            .from('ichiban_kuji_prizes') as any)
            .update({ remaining: prize.remaining + item.quantity })
            .eq('id', item.ichiban_kuji_prize_id)

          if (updatePrizeError) {
            return NextResponse.json(
              { ok: false, error: `Failed to restore prize inventory: ${updatePrizeError.message}` },
              { status: 500 }
            )
          }
        }
      }
      // Product stock will be auto-restored by DB trigger when sale_items are deleted
    }

    // 3. Delete related partner accounts (AR)
    const { error: arDeleteError } = await (supabaseServer
      .from('partner_accounts') as any)
      .delete()
      .eq('ref_type', 'sale')
      .eq('ref_id', id)

    if (arDeleteError) {
      return NextResponse.json(
        { ok: false, error: `Failed to delete AR: ${arDeleteError.message}` },
        { status: 500 }
      )
    }

    // 4. Delete sale items
    await (supabaseServer.from('sale_items') as any).delete().eq('sale_id', id)

    // 5. Delete sale
    const { error: deleteError } = await (supabaseServer
      .from('sales') as any)
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
