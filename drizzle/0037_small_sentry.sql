CREATE INDEX "item_reservations_item_idx" ON "item_reservations" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "process_documents_process_idx" ON "process_documents" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_events_process_date_idx" ON "process_events" USING btree ("process_id","event_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "process_invoices_process_idx" ON "process_invoices" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_items_process_idx" ON "process_items" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_items_purchase_order_idx" ON "process_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "process_lpcos_process_idx" ON "process_lpcos" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_payables_process_idx" ON "process_payables" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "product_lpcos_product_idx" ON "product_lpcos" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_price_tiers_product_idx" ON "product_price_tiers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_default_supplier_idx" ON "products" USING btree ("default_supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_order_documents_po_idx" ON "purchase_order_documents" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_po_idx" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_process_idx" ON "purchase_orders" USING btree ("process_id");