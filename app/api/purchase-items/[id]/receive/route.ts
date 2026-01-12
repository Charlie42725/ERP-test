import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { generateCode } from '@/lib/utils'

type RouteContext = {
  params: Promise<{ id: string }>
}

// POST /api/purchase-items/:id/receive - 收货指定品项
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { quantity } = body

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: '收货数量必须大于 0' },
        { status: 400 }
      )
    }

    // 1. 获取 purchase_item 信息
    const { data: purchaseItem, error: itemError } = await (supabaseServer
      .from('purchase_items') as any)
      .select('*, purchase_id, product_id, quantity, received_quantity')
      .eq('id', id)
      .single()

    if (itemError || !purchaseItem) {
      return NextResponse.json(
        { ok: false, error: '找不到进货明细' },
        { status: 404 }
      )
    }

    // 2. 检查收货数量是否超过进货数量
    const remainingQuantity = purchaseItem.quantity - purchaseItem.received_quantity
    if (quantity > remainingQuantity) {
      return NextResponse.json(
        {
          ok: false,
          error: `收货数量不能超过剩余数量。剩余: ${remainingQuantity}, 尝试收货: ${quantity}`
        },
        { status: 400 }
      )
    }

    // 3. 获取进货单信息
    const { data: purchase } = await (supabaseServer
      .from('purchases') as any)
      .select('purchase_no')
      .eq('id', purchaseItem.purchase_id)
      .single()

    // 4. 查找或创建本次的收货单
    // 查找今天是否已有该进货单的收货记录
    const today = new Date().toISOString().split('T')[0]
    let { data: existingReceiving } = await (supabaseServer
      .from('purchase_receivings') as any)
      .select('id, receiving_no')
      .eq('purchase_id', purchaseItem.purchase_id)
      .gte('receiving_date', `${today}T00:00:00`)
      .lte('receiving_date', `${today}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let receivingId: string
    let receivingNo: string

    if (!existingReceiving) {
      // 创建新的收货单
      // 生成收货单号
      const { data: allReceivings } = await (supabaseServer
        .from('purchase_receivings') as any)
        .select('receiving_no')

      let receivingCount = 0
      if (allReceivings && allReceivings.length > 0) {
        const maxNumber = allReceivings.reduce((max: number, receiving: any) => {
          const match = receiving.receiving_no.match(/\d+/)
          if (match) {
            const num = parseInt(match[0], 10)
            return num > max ? num : max
          }
          return max
        }, 0)
        receivingCount = maxNumber
      }

      receivingNo = generateCode('R', receivingCount)

      // 插入收货单
      const { data: newReceiving, error: receivingError } = await (supabaseServer
        .from('purchase_receivings') as any)
        .insert({
          receiving_no: receivingNo,
          purchase_id: purchaseItem.purchase_id,
          receiving_date: new Date().toISOString(),
          note: `收货：${purchase?.purchase_no}`,
        })
        .select()
        .single()

      if (receivingError) {
        return NextResponse.json(
          { ok: false, error: receivingError.message },
          { status: 500 }
        )
      }

      receivingId = newReceiving.id
    } else {
      receivingId = existingReceiving.id
      receivingNo = existingReceiving.receiving_no
    }

    // 5. 创建收货明细
    const { data: receivingItem, error: receivingItemError } = await (supabaseServer
      .from('purchase_receiving_items') as any)
      .insert({
        receiving_id: receivingId,
        purchase_item_id: id,
        product_id: purchaseItem.product_id,
        quantity: quantity,
      })
      .select()
      .single()

    if (receivingItemError) {
      return NextResponse.json(
        { ok: false, error: receivingItemError.message },
        { status: 500 }
      )
    }

    // 6. 更新 purchase_item 的 received_quantity
    const newReceivedQuantity = purchaseItem.received_quantity + quantity
    const isFullyReceived = newReceivedQuantity >= purchaseItem.quantity

    const { error: updateItemError } = await (supabaseServer
      .from('purchase_items') as any)
      .update({
        received_quantity: newReceivedQuantity,
        is_received: isFullyReceived,
      })
      .eq('id', id)

    if (updateItemError) {
      console.error('Failed to update purchase_item:', updateItemError)
    }

    // 7. 更新商品库存和平均成本
    const { data: product } = await (supabaseServer
      .from('products') as any)
      .select('stock, avg_cost')
      .eq('id', purchaseItem.product_id)
      .single()

    if (product) {
      const oldStock = product.stock
      const oldAvgCost = product.avg_cost
      const newStock = oldStock + quantity

      // 使用加权平均计算新的平均成本
      let newAvgCost = oldAvgCost
      if (newStock > 0) {
        newAvgCost = ((oldStock * oldAvgCost) + (quantity * purchaseItem.cost)) / newStock
      }

      // 更新商品库存和平均成本
      const { error: updateStockError } = await (supabaseServer
        .from('products') as any)
        .update({
          stock: newStock,
          avg_cost: newAvgCost,
        })
        .eq('id', purchaseItem.product_id)

      if (updateStockError) {
        console.error('Failed to update product stock:', updateStockError)
      } else {
        console.log(`[Receive] Updated inventory for product ${purchaseItem.product_id}: ${oldStock} -> ${newStock}, avg_cost: ${oldAvgCost.toFixed(2)} -> ${newAvgCost.toFixed(2)}`)
      }
    }

    // 8. 创建库存日志
    const { error: logError } = await (supabaseServer
      .from('inventory_logs') as any)
      .insert({
        product_id: purchaseItem.product_id,
        ref_type: 'purchase_receiving',
        ref_id: receivingId,
        qty_change: quantity,
        memo: `收货 - ${receivingNo} (进货单: ${purchase?.purchase_no})`,
      })

    if (logError) {
      console.error('Failed to create inventory log:', logError)
    }

    // 9. 更新进货单的 receiving_status
    // 检查该进货单的所有 purchase_items 是否都已收货
    const { data: allPurchaseItems } = await (supabaseServer
      .from('purchase_items') as any)
      .select('id, quantity, received_quantity, is_received')
      .eq('purchase_id', purchaseItem.purchase_id)

    if (allPurchaseItems) {
      const allReceived = allPurchaseItems.every((item: any) => item.is_received)
      const anyReceived = allPurchaseItems.some((item: any) => item.received_quantity > 0)

      let newReceivingStatus = 'none'
      if (allReceived) {
        newReceivingStatus = 'completed'
      } else if (anyReceived) {
        newReceivingStatus = 'partial'
      }

      await (supabaseServer
        .from('purchases') as any)
        .update({ receiving_status: newReceivingStatus })
        .eq('id', purchaseItem.purchase_id)
    }

    return NextResponse.json(
      {
        ok: true,
        data: receivingItem,
        message: `收货成功！收货单号：${receivingNo}`
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Receive purchase item error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
