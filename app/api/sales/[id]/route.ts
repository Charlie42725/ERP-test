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

    // Get account_id based on payment_method
    const { data: account } = await (supabaseServer
      .from('accounts') as any)
      .select('id')
      .eq('payment_method_code', payment_method)
      .eq('is_active', true)
      .single()

    const accountId = account?.id || null

    // 取得台灣時間 (UTC+8)
    const now = new Date()
    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)

    // Update sale payment method and account_id
    const { data: sale, error } = await (supabaseServer
      .from('sales') as any)
      .update({
        payment_method,
        account_id: accountId,
        updated_at: taiwanTime.toISOString(),
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

    // 1. Check if sale exists and get its info
    const { data: sale, error: fetchError } = await (supabaseServer
      .from('sales') as any)
      .select('status, customer_code, sale_no')
      .eq('id', id)
      .single()

    if (fetchError || !sale) {
      return NextResponse.json(
        { ok: false, error: 'Sale not found' },
        { status: 404 }
      )
    }

    // 1.5. Restore customer store_credit if used (check balance logs)
    if (sale.customer_code) {
      // 查找该销售单使用的购物金记录
      const { data: balanceLog } = await (supabaseServer
        .from('customer_balance_logs') as any)
        .select('amount, balance_before, balance_after')
        .eq('ref_type', 'sale')
        .eq('ref_id', id)
        .eq('customer_code', sale.customer_code)
        .single()

      // 如果有使用购物金（amount 为负数），需要退回
      if (balanceLog && balanceLog.amount < 0) {
        const refundAmount = Math.abs(balanceLog.amount)

        // 获取客户当前购物金余额
        const { data: customer } = await (supabaseServer
          .from('customers') as any)
          .select('store_credit')
          .eq('customer_code', sale.customer_code)
          .single()

        if (customer) {
          const newBalance = customer.store_credit + refundAmount

          // 更新客户购物金余额
          await (supabaseServer
            .from('customers') as any)
            .update({ store_credit: newBalance })
            .eq('customer_code', sale.customer_code)

          // 记录购物金退回日志
          await (supabaseServer
            .from('customer_balance_logs') as any)
            .insert({
              customer_code: sale.customer_code,
              amount: refundAmount,
              balance_before: customer.store_credit,
              balance_after: newBalance,
              type: 'refund',
              ref_type: 'sale',
              ref_id: id,
              ref_no: sale.sale_no,
              note: `删除销售单 ${sale.sale_no}，退回购物金`,
              created_by: null,
            })
        }
      }
    }

    // 2. Get all deliveries for this sale
    const { data: deliveries } = await (supabaseServer
      .from('deliveries') as any)
      .select('id, status, delivery_no')
      .eq('sale_id', id)

    // 3. For each delivery, restore inventory by inserting reverse logs
    for (const delivery of deliveries || []) {
      // 只有 confirmed 的 delivery 才有扣庫存，才需要回補
      if (delivery.status === 'confirmed') {
        // 獲取該出貨單的所有庫存扣除記錄
        const { data: inventoryLogs } = await (supabaseServer
          .from('inventory_logs') as any)
          .select('product_id, qty_change')
          .eq('ref_type', 'delivery')
          .eq('ref_id', delivery.id)

        // 反向插入庫存日誌來回補庫存（trigger 會自動處理）
        for (const log of inventoryLogs || []) {
          await (supabaseServer
            .from('inventory_logs') as any)
            .insert({
              product_id: log.product_id,
              ref_type: 'sale_delete',
              ref_id: id,
              qty_change: -log.qty_change, // 反向數量（原本是負數，現在變正數）
              memo: `刪除銷售單 ${sale.sale_no}，回補庫存（原出貨單：${delivery.delivery_no}）`,
            })
        }

        // 刪除原有的庫存日誌
        await (supabaseServer
          .from('inventory_logs') as any)
          .delete()
          .eq('ref_type', 'delivery')
          .eq('ref_id', delivery.id)
      }

      // 刪除出貨明細
      await (supabaseServer
        .from('delivery_items') as any)
        .delete()
        .eq('delivery_id', delivery.id)

      // 刪除出貨單
      await (supabaseServer
        .from('deliveries') as any)
        .delete()
        .eq('id', delivery.id)
    }

    // 4. If confirmed, need to restore ONLY ichiban kuji remaining
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

      // Restore ONLY ichiban kuji remaining
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
    }

    // 3. Delete account transaction and restore account balance
    const { data: accountTransaction } = await (supabaseServer
      .from('account_transactions') as any)
      .select('account_id, amount')
      .eq('ref_type', 'sale')
      .eq('ref_id', id)
      .single()

    if (accountTransaction) {
      // 获取当前账户余额
      const { data: account } = await (supabaseServer
        .from('accounts') as any)
        .select('balance')
        .eq('id', accountTransaction.account_id)
        .single()

      if (account) {
        // 减去这笔销售的金额（因为是收入，所以要减去）
        const newBalance = account.balance - accountTransaction.amount

        // 更新账户余额
        await (supabaseServer
          .from('accounts') as any)
          .update({ balance: newBalance })
          .eq('id', accountTransaction.account_id)
      }

      // 删除账户交易记录
      await (supabaseServer
        .from('account_transactions') as any)
        .delete()
        .eq('ref_type', 'sale')
        .eq('ref_id', id)
    }

    // 4. Delete related partner accounts (AR)
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

    // 5. Delete sale items
    await (supabaseServer.from('sale_items') as any).delete().eq('sale_id', id)

    // 6. Delete sale
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
