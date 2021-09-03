package com.jackis.jsonintegration.product.persistence;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Objects;
import javax.persistence.Column;
import javax.persistence.Embeddable;

@Embeddable
public class PriceEntity implements Serializable {

  @Column(nullable = false)
  private String currency;

  @Column(nullable = false, name = "price")
  private BigDecimal value;

  public String getCurrency() {
    return currency;
  }

  public void setCurrency(String currency) {
    this.currency = currency;
  }

  public BigDecimal getValue() {
    return value;
  }

  public void setValue(BigDecimal value) {
    this.value = value;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    PriceEntity that = (PriceEntity) o;
    return Objects.equals(currency, that.currency) &&
        Objects.equals(value, that.value);
  }

  @Override
  public int hashCode() {
    return Objects.hash(currency, value);
  }
}
