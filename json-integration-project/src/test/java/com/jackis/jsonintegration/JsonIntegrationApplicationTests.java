package com.jackis.jsonintegration;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.jackis.jsonintegration.product.rest.Price;
import com.jackis.jsonintegration.product.rest.Product;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.Types;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.util.TestPropertyValues;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.web.server.LocalServerPort;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.web.client.ResponseExtractor;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.shaded.org.apache.commons.io.IOUtils;
import org.testcontainers.shaded.org.apache.commons.lang.RandomStringUtils;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ContextConfiguration(initializers = JsonIntegrationApplicationTests.DatabaseInitializer.class)
class JsonIntegrationApplicationTests {

  private static final Logger LOGGER = LoggerFactory
      .getLogger(JsonIntegrationApplicationTests.class);

  private static final PostgreSQLContainer POSTGRE_SQL_CONTAINER;

  static {
    POSTGRE_SQL_CONTAINER = new PostgreSQLContainer("postgres:10.11");
    POSTGRE_SQL_CONTAINER.start();
  }

  /**
   * Initializes the Spring Boot application under test with the required runtime information from
   * the started Postgres Container.
   */
  static class DatabaseInitializer implements
      ApplicationContextInitializer<ConfigurableApplicationContext> {

    public DatabaseInitializer() {
    }

    @Override
    public void initialize(ConfigurableApplicationContext configurableApplicationContext) {
      TestPropertyValues.of(
          "spring.datasource.username=" + POSTGRE_SQL_CONTAINER.getUsername(),
          "spring.datasource.password=" + POSTGRE_SQL_CONTAINER.getPassword(),
          "spring.datasource.url=" + POSTGRE_SQL_CONTAINER.getJdbcUrl())
          .applyTo(configurableApplicationContext);
    }
  }

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private TestRestTemplate restTemplate;

  @Autowired
  private ObjectMapper jacksonObjectMapper;

  @LocalServerPort
  private int port;

  @BeforeEach
  void addTestData() {

    final ObjectNode firstProduct = jacksonObjectMapper.createObjectNode();
    firstProduct.set("colors", jacksonObjectMapper.createArrayNode().add("green").add("black"));
    firstProduct.set("weight",
        jacksonObjectMapper.createObjectNode().put("unit", "g").put("value", 43));
    firstProduct.set("measures",
        jacksonObjectMapper.createObjectNode().put("unit", "mm").put("height", 250)
            .put("width", 300).put("depth", 150));

    insertProduct(new Product("Brown Toast 4000", UUID.randomUUID().toString(),
        new Price(new BigDecimal(10), "EUR"),
        firstProduct));

    final ObjectNode secondProduct = jacksonObjectMapper.createObjectNode();
    secondProduct.set("colors", jacksonObjectMapper.createArrayNode().add("blue").add("black"));
    secondProduct.set("weight",
        jacksonObjectMapper.createObjectNode().put("unit", "g").put("value", 42));
    secondProduct.set("measures",
        jacksonObjectMapper.createObjectNode().put("unit", "mm").put("height", 300)
            .put("width", 400).put("depth", 250));

    insertProduct(
        new Product("Black Toast 2000", UUID.randomUUID().toString(),
            new Price(new BigDecimal(0.99f), "EUR"),
            secondProduct));
  }

  @AfterEach
  void purgeTable() {
    jdbcTemplate.update("TRUNCATE TABLE product");
  }

  @Test
  void searchProductWeightUnitGram() throws URISyntaxException {

    final URI uri = new URI("http://localhost:" + port
        + "/products?attributeSearchParameter=" + URLEncoder
        .encode("{\"weight\": { \"value\": 42 } }",
            StandardCharsets.UTF_8));

    final List<Product> products = searchProduct(uri, response -> {
      final String responseBody = IOUtils
          .toString(response.getBody(), StandardCharsets.UTF_8.name());
      return jacksonObjectMapper.readValue(responseBody, new TypeReference<>() {
      });
    });

    assertThat(products).hasSize(1);
    assertThat(products.get(0)).matches(product ->
        product.getAttributes().get("weight").get("value").asInt() == 42
    );

  }

  @Test
  void searchProductColors() throws URISyntaxException {

    final URI uri = new URI("http://localhost:" + port
        + "/products?attributeSearchParameter=" + URLEncoder.encode("{\"colors\":[\"green\"]}",
        StandardCharsets.UTF_8));

    final List<Product> products = searchProduct(uri, response -> {
      final String responseBody = IOUtils
          .toString(response.getBody(), StandardCharsets.UTF_8.name());
      return jacksonObjectMapper.readValue(responseBody, new TypeReference<>() {
      });
    });

    assertThat(products).hasSize(1);
    assertThat(products.get(0)).matches(product -> {
          for (JsonNode color : product.getAttributes().get("colors")) {
            if ("green".equals(color.asText())) {
              return true;
            }
          }

          return false;
        }
    );

  }

  @Test
  void verifyUsageOfIndexes() {

    /* to see the GIN index being used there must be a few entries in the database. Also using
     *  plain JDBC here for entering the rows into the database because this is much faster than
     *  using the REST interface. */
    insertHighNumberOfProducts();

    /* Force updating statistics so query planner knows that there are a lot of rows in the
       product table the index is really used. */
    jdbcTemplate.update("ANALYZE product;");

    final List<String> resultSearch = jdbcTemplate.queryForList(
        "EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE, FORMAT JSON) SELECT * FROM product "
            + "WHERE attributes @> CAST('{ \"colors\": [\"green\"] }' AS JSONB)",
        String.class);

    final String concatenatedSearchResult = String.join(" ", resultSearch);
    LOGGER.info(concatenatedSearchResult);
    assertThat(concatenatedSearchResult).containsIgnoringCase("product_attributes_idx");

    final List<String> resultRangeNoIndex = jdbcTemplate.queryForList(
        "EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE, FORMAT JSON) SELECT * FROM product "
            + "WHERE CAST (attributes #> '{measures}' ->> 'height' AS INTEGER) < 250",
        String.class);

    final String concatenatedRangeNoIndex = String.join(" ", resultRangeNoIndex);
    LOGGER.info(concatenatedRangeNoIndex);
    assertThat(concatenatedRangeNoIndex).doesNotContain("index");

    final List<String> resultRangeWithIndex = jdbcTemplate.queryForList(
        "EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE, FORMAT JSON) SELECT * FROM product "
            + "WHERE CAST (attributes #> '{weight}' ->> 'value' AS INTEGER) < 43",
        String.class);

    final String concatenatedRangeWithIndex = String.join(" ", resultRangeWithIndex);
    LOGGER.info(concatenatedRangeWithIndex);
    assertThat(concatenatedRangeWithIndex).contains("product_weight_idx");
  }

  private HttpStatus insertProduct(final Product product) {
    try {
      return this.restTemplate.execute(new URI("http://localhost:" + port
              + "/products"), HttpMethod.POST, request -> {
            request.getHeaders().add("Content-Type", "application/json");
            request.getBody().write(jacksonObjectMapper.writeValueAsBytes(product));
          }, ClientHttpResponse::getStatusCode
      );
    } catch (URISyntaxException exp) {
      throw new RuntimeException(exp);
    }
  }

  private <T> T searchProduct(final URI uri, final ResponseExtractor<T> responseExtractor) {
    return this.restTemplate
        .execute(uri, HttpMethod.GET,
            request -> request.getHeaders().add("Content-Type", "application/json"),
            responseExtractor);
  }

  private void insertHighNumberOfProducts() {
    final Random random = new Random();

    List<Object[]> parameters = IntStream.range(0, 50_000)
        .boxed()
        .map(idx -> {
              final ObjectNode jsonNode = jacksonObjectMapper.createObjectNode()
                  .set("weight", jacksonObjectMapper.createObjectNode().put("unit", "g")
                      .put("value", random.nextInt(1000)));
              jsonNode.set("measures",
                  jacksonObjectMapper.createObjectNode().put("unit", "mm")
                      .put("height", random.nextInt(1000))
                      .put("width", random.nextInt(1000)).put("depth", random.nextInt(1000)));
              jsonNode.set("colors",
                  jacksonObjectMapper.createArrayNode().add(RandomStringUtils.random(10, true, true))
                      .add(RandomStringUtils.random(10, true, true)));

              try {
                return new Object[]{RandomStringUtils.random(10, true, true),
                    UUID.randomUUID().toString(),
                    new BigDecimal(random.nextFloat()),
                    jacksonObjectMapper.writeValueAsString(jsonNode)};
              } catch (JsonProcessingException exp) {
                throw new RuntimeException(exp);
              }


            }
        ).collect(Collectors.toList());

    jdbcTemplate.batchUpdate("INSERT INTO product (name, sku, price, currency, attributes) "
            + "VALUES (?, ?, ?, 'EUR', CAST(? AS JSONB))", parameters,
        new int[]{Types.VARCHAR, Types.VARCHAR, Types.NUMERIC, Types.CLOB});
  }


}
