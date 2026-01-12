-- 修复账户余额触发器 - 解决 total 从 0 更新为实际金额时余额不更新的问题
-- Migration: 004_fix_account_balance_trigger
-- Date: 2026-01-12

-- 删除旧触发器
DROP TRIGGER IF EXISTS sales_account_transaction ON sales;

-- 重新创建修复后的触发器函数
CREATE OR REPLACE FUNCTION record_sale_account_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_before NUMERIC(10, 2);
  v_balance_after NUMERIC(10, 2);
  v_should_record BOOLEAN := false;
BEGIN
  -- 只有当销售已付款且有指定帐戶時才記錄
  IF NEW.is_paid = true AND NEW.account_id IS NOT NULL AND NEW.total > 0 THEN

    -- 判断是否需要记录
    IF TG_OP = 'INSERT' THEN
      v_should_record := true;
    ELSIF TG_OP = 'UPDATE' THEN
      -- UPDATE 时，检查以下情况需要重新记录：
      -- 1. 之前未付款，现在付款了
      -- 2. 帐户变更了
      -- 3. total 从 0 或其他值变化了（关键修复点）
      IF OLD.is_paid = false OR
         OLD.account_id IS NULL OR
         OLD.account_id != NEW.account_id OR
         OLD.total != NEW.total THEN

        -- 如果之前有记录，先删除旧记录（避免重复）
        DELETE FROM account_transactions
        WHERE ref_type = 'sale' AND ref_id = OLD.id::text;

        v_should_record := true;
      END IF;
    END IF;

    -- 如果需要记录，执行账户余额更新
    IF v_should_record THEN
      -- 获取当前帐户餘額
      SELECT balance INTO v_balance_before
      FROM accounts
      WHERE id = NEW.account_id
      FOR UPDATE;

      -- 計算新餘額（收入為正）
      v_balance_after := v_balance_before + NEW.total;

      -- 更新帳戶餘額
      UPDATE accounts
      SET balance = v_balance_after
      WHERE id = NEW.account_id;

      -- 創建交易記錄
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
        NEW.account_id,
        'sale',
        NEW.total, -- 收入為正數
        v_balance_before,
        v_balance_after,
        'sale',
        NEW.id::text,
        NEW.sale_no,
        NEW.note
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 重新创建触发器
CREATE TRIGGER sales_account_transaction
AFTER INSERT OR UPDATE ON sales
FOR EACH ROW
EXECUTE FUNCTION record_sale_account_transaction();

COMMENT ON FUNCTION record_sale_account_transaction IS '销售账户交易记录触发器 - 已修复 total 变化时余额不更新的问题';
