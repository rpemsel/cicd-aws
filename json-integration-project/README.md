# Introduction 

This is an example Application that shows how schema free data can be handled  within the Postgres database 
management system. It also integrates this into Hibernate to allow using this ORM Tool to read and
write JSON into the Postgres DBMS.

It consists of a simplistic Spring Boot application. When the application is started, 
it creates the required database tables using Flyway. 
The DDL statements can be found in `src/resources/db/migration/V1.0.0__Create_Tables.sql`

To enable contacting a Postgres Database the following properties must be set dynamically at application
runtim either as system property or as environment properties: 

* `spring.datasource.username` - username of the database user 
* `spring.datasource.password` - password for the database user
* `spring.datasource.url` - JDBC access url for the database

Product data can be added using the following REST interface: 

* `POST /products`

and retrieved using 

* `GET /products?attributeSearchParameter={"colors": ["green"]}`

The exact definitions can be found in `com.jackis.jsonintegration.product.rest.ProductController.java`

# Running integration test

To test the functionalities being implemented here the `JsonIntegrationApplicationTests` is executed.
It is an integration test starting the Spring application and also a Postgres database inside a
Docker Container. Therefore it is necessary to have Docker installed on your system if you want to
run this test. No further configurations have to be made to run this test apart from this requirement.

The database connection properties are automatically set to the application once the Docker Container
with the Postgres Database starts.   

# References

https://thoughts-on-java.org/persist-postgresqls-jsonb-data-type-hibernate/ - Implementation of JSONB datatype for Hibernate

