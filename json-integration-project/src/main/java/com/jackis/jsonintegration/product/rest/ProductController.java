package com.jackis.jsonintegration.product.rest;

import com.jackis.jsonintegration.json.JSONUtils;
import com.jackis.jsonintegration.product.persistence.PriceEntity;
import com.jackis.jsonintegration.product.persistence.ProductEntity;
import com.jackis.jsonintegration.product.persistence.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping(value = "/products", consumes = "application/json", produces = "application/json")
public class ProductController {

  private static final Logger LOGGER = LoggerFactory.getLogger(ProductController.class);

  @Autowired
  private ProductRepository productRepository;

  @Autowired
  private JSONUtils jsonUtils;

  @GetMapping()
  public final ResponseEntity<List<Product>> getProductByAttribute(
      @RequestParam String attributeSearchParameter) {

    LOGGER.info("Search Parameter: {}", attributeSearchParameter);

    if (StringUtils.isEmpty(attributeSearchParameter) || !jsonUtils
        .isJSONValid(attributeSearchParameter)) {
      return ResponseEntity.badRequest().build();
    }

    final List<ProductEntity> productEntities =
        productRepository.findByProductAttribute(attributeSearchParameter)
            .orElse(Collections.emptyList());

    LOGGER.info("Number of found products: {}", productEntities.size());

    if (productEntities.size() == 0) {
      return ResponseEntity.noContent().build();
    } else {
      return ResponseEntity.ok().body(productEntities.stream()
          .map(product -> new Product(product.getName(), product.getSku(),
              new Price(product.getPriceEntity().getValue(),
                  product.getPriceEntity().getCurrency()), product.getAttributes()))
          .collect(Collectors.toList()));
    }
  }

  @PostMapping
  public final ResponseEntity createProduct(@RequestBody final Product product) {

    final PriceEntity priceEntity = new PriceEntity();
    priceEntity.setCurrency(product.getPrice().getCurrency());
    priceEntity.setValue(product.getPrice().getValue());

    final ProductEntity productEntity = new ProductEntity();
    productEntity.setName(product.getName());
    productEntity.setSku(product.getSku());
    productEntity.setPriceEntity(priceEntity);
    productEntity.setAttributes(product.getAttributes());

    productRepository.save(productEntity);

    return ResponseEntity.status(HttpStatus.CREATED).build();

  }
}
