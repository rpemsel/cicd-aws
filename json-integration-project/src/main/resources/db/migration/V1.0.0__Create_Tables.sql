CREATE TABLE product (
  id BIGSERIAL NOT NULL PRIMARY KEY ,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(255) NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(5) NOT NULL,
  attributes JSONB
 );

CREATE INDEX product_attributes_idx ON product USING GIN (attributes jsonb_ops);
CREATE INDEX product_weight_idx ON product USING BTREE(CAST((attributes #> '{weight}' ->> 'value') AS INTEGER))