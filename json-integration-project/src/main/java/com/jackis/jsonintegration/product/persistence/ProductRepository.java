package com.jackis.jsonintegration.product.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<ProductEntity, Long> {

  @Query(value = "SELECT * FROM product WHERE attributes @> CAST(:jsonObject AS JSONB)", nativeQuery = true)
  Optional<List<ProductEntity>> findByProductAttribute(@Param("jsonObject") String jsonObject);
}
