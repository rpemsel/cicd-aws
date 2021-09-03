package com.jackis.jsonintegration.hibernate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hibernate.HibernateException;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.usertype.UserType;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

public class JsonNodeType implements UserType {

  @Override
  public int[] sqlTypes() {
    return new int[]{Types.JAVA_OBJECT};
  }

  @Override
  public Class<JsonNode> returnedClass() {
    return JsonNode.class;
  }

  @Override
  public Object nullSafeGet(ResultSet rs, String[] names,
      SharedSessionContractImplementor sharedSessionContractImplementor, Object value)
      throws HibernateException, SQLException {
    final String cellContent = rs.getString(names[0]);
    if (cellContent == null) {
      return null;
    }
    try {
      final ObjectMapper mapper = new ObjectMapper();
      return mapper.readTree(cellContent.getBytes(StandardCharsets.UTF_8));
    } catch (final Exception ex) {
      throw new RuntimeException("Failed to convert String to JsonNode: " + ex.getMessage(), ex);
    }
  }

  @Override
  public void nullSafeSet(PreparedStatement preparedStatement, Object value, int idx,
      SharedSessionContractImplementor sharedSessionContractImplementor)
      throws HibernateException, SQLException {
    if (value == null) {
      preparedStatement.setNull(idx, Types.OTHER);
      return;
    }
    try {
      final ObjectMapper mapper = new ObjectMapper();
      preparedStatement.setObject(idx, mapper.writeValueAsString(value), Types.OTHER);
    } catch (final Exception ex) {
      throw new RuntimeException("Failed to convert JsonNode to String: " + ex.getMessage(), ex);
    }
  }

  @Override
  public Object deepCopy(final Object value) throws HibernateException {
    try {
      // use serialization to create a deep copy
      ByteArrayOutputStream bos = new ByteArrayOutputStream();
      ObjectOutputStream oos = new ObjectOutputStream(bos);
      oos.writeObject(value);
      oos.flush();
      oos.close();
      bos.close();

      ByteArrayInputStream bais = new ByteArrayInputStream(bos.toByteArray());
      return new ObjectInputStream(bais).readObject();
    } catch (ClassNotFoundException | IOException ex) {
      throw new HibernateException(ex);
    }
  }

  @Override
  public boolean isMutable() {
    return true;
  }

  @Override
  public Serializable disassemble(final Object value) throws HibernateException {
    return (Serializable) this.deepCopy(value);
  }

  @Override
  public Object assemble(final Serializable cached, final Object owner) throws HibernateException {
    return this.deepCopy(cached);
  }

  @Override
  public Object replace(final Object original, final Object target, final Object owner)
      throws HibernateException {
    return this.deepCopy(original);
  }

  @Override
  public boolean equals(final Object obj1, final Object obj2) throws HibernateException {
    if (obj1 == null) {
      return obj2 == null;
    }
    return obj1.equals(obj2);
  }

  @Override
  public int hashCode(final Object obj) throws HibernateException {
    return obj.hashCode();
  }

}