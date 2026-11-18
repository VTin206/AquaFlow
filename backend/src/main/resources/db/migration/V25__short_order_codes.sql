-- Keep existing codes. Allocate new codes atomically across all backend instances.
CREATE SEQUENCE order_code_sequence AS BIGINT MINVALUE 1 NO CYCLE;
SELECT setval('order_code_sequence', GREATEST(
    COALESCE((SELECT MAX(id) FROM orders), 0),
    COALESCE((SELECT MAX(substring(order_code FROM 4)::BIGINT)
              FROM orders WHERE order_code ~ '^AF-[0-9]{1,18}$'), 0)
) + 1, false);
