package com.jackis.jsonintegration.json;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.ApplicationScope;

@Component
@ApplicationScope
public class JSONUtils {

  @Autowired
  private ObjectMapper mapper;

  public boolean isJSONValid(String jsonInString ) {
    try {
       mapper.readTree(jsonInString);
       return true;
    } catch (IOException e) {
       return false;
    }
  }
}