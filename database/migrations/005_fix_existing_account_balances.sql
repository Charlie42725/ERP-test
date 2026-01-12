-- 修复现有销售记录的账户余额
-- Migration: 005_fix_existing_account_balances
-- Date: 2026-01-12
-- 用途：修复之前创建但余额没有更新的销售记录

-- 先清空所有账户余额和交易记录，重新计算
DO $$
DECLARE
  sale_record RECORD;
  expense_record RECORD;
BEGIN
  -- 1. 清空所有账户交易记录
  DELETE FROM account_transactions;

  -- 2. 重置所有账户余额为 0
  UPDATE accounts SET balance = 0;

  -- 3. 重新处理所有已付款的销售记录
  FOR sale_record IN
    SELECT id, sale_no, account_id, total, note, is_paid
    FROM sales
    WHERE is_paid = true
      AND account_id IS NOT NULL
      AND total > 0
      AND status = 'confirmed'
    ORDER BY created_at ASC
  LOOP
    DECLARE
      v_balance_before NUMERIC(10, 2);
      v_balance_after NUMERIC(10, 2);
    BEGIN
      -- 获取当前账户余额
      SELECT balance INTO v_balance_before
      FROM accounts
      WHERE id = sale_record.account_id;

      -- 计算新余额
      v_balance_after := v_balance_before + sale_record.total;

      -- 更新账户余额
      UPDATE accounts
      SET balance = v_balance_after
      WHERE id = sale_record.account_id;

      -- 创建交易记录
      INSERT INTO account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        ref_type,
        ref_id,
        ref_no,
        note
      ) VALUES (
        sale_record.account_id,
        'sale',
        sale_record.total,
        v_balance_before,
        v_balance_after,
        'sale',
        sale_record.id::text,
        sale_record.sale_no,
        sale_record.note
      );
    END;
  END LOOP;

  -- 4. 重新处理所有费用记录
  FOR expense_record IN
    SELECT id, account_id, amount, note, category
    FROM expenses
    WHERE account_id IS NOT NULL
    ORDER BY created_at ASC
  LOOP
    DECLARE
      v_balance_before NUMERIC(10, 2);
      v_balance_after NUMERIC(10, 2);
    BEGIN
      -- 获取当前账户余额
      SELECT balance INTO v_balance_before
      FROM accounts
      WHERE id = expense_record.account_id;

      -- 计算新余额（支出为负）
      v_balance_after := v_balance_before - expense_record.amount;

      -- 更新账户余额
      UPDATE accounts
      SET balance = v_balance_after
      WHERE id = expense_record.account_id;

      -- 创建交易记录
      INSERT INTO account_transactions (
        account_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        ref_type,
        ref_id,
        note
      ) VALUES (
        expense_record.account_id,
        'expense',
        -expense_record.amount,
        v_balance_before,
        v_balance_after,
        'expense',
        expense_record.id::text,
        COALESCE(expense_record.note, expense_record.category)
      );
    END;
  END LOOP;

  RAISE NOTICE '账户余额修复完成！';
END $$;

-- 显示修复后的账户余额
SELECT
  account_name,
  account_type,
  balance,
  is_active
FROM accounts
ORDER BY account_type, account_name;
