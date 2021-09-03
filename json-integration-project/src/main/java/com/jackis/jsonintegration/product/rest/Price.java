package com.jackis.jsonintegration.product.rest;

import java.math.BigDecimal;

public class Price {

  private BigDecimal value;
  private String currency;

  public Price() {
  }

  public Price(BigDecimal value, String currency) {
    this.value = value;
    this.currency = currency;
  }

  public BigDecimal getValue() {
    return value;
  }

  public void setValue(BigDecimal value) {
    this.value = value;
  }

  public String getCurrency() {
    return currency;
  }

  public void setCurrency(String currency) {
    this.currency = currency;
  }
}
