package com.jackis.jsonintegration.product.rest;

import com.fasterxml.jackson.databind.JsonNode;

public class Product {

  private String name;
  private String sku;
  private Price price;
  private JsonNode attributes;

  public Product(String name, String sku, Price price, JsonNode attributes) {
    this.name = name;
    this.sku = sku;
    this.price = price;
    this.attributes = attributes;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getSku() {
    return sku;
  }

  public void setSku(String sku) {
    this.sku = sku;
  }

  public Price getPrice() {
    return price;
  }

  public void setPrice(Price price) {
    this.price = price;
  }

  public JsonNode getAttributes() {
    return attributes;
  }

  public void setAttributes(JsonNode attributes) {
    this.attributes = attributes;
  }
}
