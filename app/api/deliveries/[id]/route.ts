import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/deliveries/:id - 獲取出貨單詳情
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    const { data: delivery, error } = await (supabaseServer
      .from('deliveries') as any)
      .select(`
        *,
        sales:sale_id (
          sale_no,
          customer_code,
          total,
          is_paid,
          customers:customer_code (
            customer_name
          )
        ),
        delivery_items (
          id,
          product_id,
          quantity,
          products (
            name,
            item_code,
            unit,
            stock
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json(
        { ok: false, error: 'Delivery not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true, data: delivery })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/deliveries/:id/confirm - 確認出貨（draft → confirmed）
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // 獲取出貨單資訊
    const { data: delivery, error: fetchError } = await (supabaseServer
      .from('deliveries') as any)
      .select(`
        *,
        delivery_items (
          product_id,
          quantity
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !delivery) {
      return NextResponse.json(
        { ok: false, error: '出貨單不存在' },
        { status: 404 }
      )
    }

    if (delivery.status === 'confirmed') {
      return NextResponse.json(
        { ok: false, error: '此出貨單已確認，無需重複操作' },
        { status: 400 }
      )
    }

    if (delivery.status === 'cancelled') {
      return NextResponse.json(
        { ok: false, error: '已取消的出貨單無法確認' },
        { status: 400 }
      )
    }

    // 🔒 冪等保護：檢查是否已經扣過庫存
    const { data: existingLogs } = await (supabaseServer
      .from('inventory_logs') as any)
      .select('id')
      .eq('ref_type', 'delivery')
      .eq('ref_id', id)
      .limit(1)

    if (existingLogs && existingLogs.length > 0) {
      return NextResponse.json(
        { ok: false, error: '此出貨單已扣過庫存，無法重複扣減' },
        { status: 400 }
      )
    }

    // 檢查庫存是否足夠
    for (const item of delivery.delivery_items) {
      const { data: product } = await (supabaseServer
        .from('products') as any)
        .select('stock, allow_negative, name')
        .eq('id', item.product_id)
        .single()

      if (!product) {
        return NextResponse.json(
          { ok: false, error: `商品不存在：${item.product_id}` },
          { status: 404 }
        )
      }

      if (!product.allow_negative && product.stock < item.quantity) {
        return NextResponse.json(
          {
            ok: false,
            error: `${product.name} 庫存不足。剩餘: ${product.stock}, 需要: ${item.quantity}`,
          },
          { status: 400 }
        )
      }
    }

    // 扣庫存並寫入 inventory_logs
    for (const item of delivery.delivery_items) {
      // 更新庫存
      const { data: product } = await (supabaseServer
        .from('products') as any)
        .select('stock')
        .eq('id', item.product_id)
        .single()

      if (product) {
        await (supabaseServer
          .from('products') as any)
          .update({ stock: product.stock - item.quantity })
          .eq('id', item.product_id)
      }

      // 寫入庫存日誌（ref_type='delivery'）
      await (supabaseServer
        .from('inventory_logs') as any)
        .insert({
          product_id: item.product_id,
          ref_type: 'delivery',
          ref_id: id,
          qty_change: -item.quantity,
          memo: `出貨扣庫存 - ${delivery.delivery_no}`,
        })
    }

    // 更新出貨單狀態
    const { data: confirmedDelivery, error: updateError } = await (supabaseServer
      .from('deliveries') as any)
      .update({
        status: 'confirmed',
        delivery_date: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      )
    }

    // 更新 sales 的履約狀態
    await (supabaseServer
      .from('sales') as any)
      .update({ fulfillment_status: 'completed' })
      .eq('id', delivery.sale_id)

    return NextResponse.json({
      ok: true,
      data: confirmedDelivery,
      message: '出貨確認成功，庫存已扣減',
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/deliveries/:id - 刪除出貨單
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // 獲取出貨單資訊
    const { data: delivery, error: fetchError } = await (supabaseServer
      .from('deliveries') as any)
      .select('status, sale_id, delivery_items(product_id, quantity)')
      .eq('id', id)
      .single()

    if (fetchError || !delivery) {
      return NextResponse.json(
        { ok: false, error: '出貨單不存在' },
        { status: 404 }
      )
    }

    // 如果已確認，需要回補庫存
    if (delivery.status === 'confirmed') {
      // 檢查是否有庫存記錄
      const { data: logs } = await (supabaseServer
        .from('inventory_logs') as any)
        .select('product_id, qty_change')
        .eq('ref_type', 'delivery')
        .eq('ref_id', id)

      if (logs && logs.length > 0) {
        // 回補庫存
        for (const log of logs) {
          const { data: product } = await (supabaseServer
            .from('products') as any)
            .select('stock')
            .eq('id', log.product_id)
            .single()

          if (product) {
            await (supabaseServer
              .from('products') as any)
              .update({ stock: product.stock - log.qty_change }) // qty_change 是負數，所以用減法
              .eq('id', log.product_id)
          }
        }

        // 刪除庫存記錄
        await (supabaseServer
          .from('inventory_logs') as any)
          .delete()
          .eq('ref_type', 'delivery')
          .eq('ref_id', id)
      }

      // 更新 sales 的履約狀態
      await (supabaseServer
        .from('sales') as any)
        .update({ fulfillment_status: 'none' })
        .eq('id', delivery.sale_id)
    }

    // 刪除出貨明細（cascade）
    await (supabaseServer
      .from('delivery_items') as any)
      .delete()
      .eq('delivery_id', id)

    // 刪除出貨單
    const { error: deleteError } = await (supabaseServer
      .from('deliveries') as any)
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json(
        { ok: false, error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: delivery.status === 'confirmed' ? '出貨單已刪除，庫存已回補' : '出貨單已刪除',
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
