-- Prevent duplicate concurrent payment attempts for the same order.
CREATE UNIQUE INDEX "payments_order_id_attempt_number_key" ON "payments"("order_id", "attempt_number");
