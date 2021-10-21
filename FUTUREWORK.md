# Future work

## Overview

This is how it used to work: updates to the data (delta messages / deltas) are now collected in the producer service and, in a certain time interval, are pushed to a local file in a share. A virtual and physical file are then stored to the triplestore. When a consumer wants updates on the database, it sends out periodic requests to retreive those files based on a timestamp.

Problems (some of these are already corrected):

*   A timestamp is not a good way of keeping state consistent. Use vector clocks, Lamport clocks, ... instead.
*   Storing files is slow and quickly becomes a mess.
*   Periodically requesting data is bad practice (in my opinion). Rely instead on socket connections
*   ... more?

## Storing of triples (implemented)

Instead of storing triples in files, we should consider storing them in a more structured manner. Suppose we also want to make sure we can retreive changes orderly without missing a single triple. Can we transform every delta in a series of triples that represent that single delta with metadata? For example, the triple:

    sh:book1 sch:title "Testbook" .

can be represented by:

	  de:change1 rdf:type     de:History .
    de:change1 de:aboutURI  sh:book1 .
    de:change1 de:aboutProp sch:title .
    de:change1 de:oldValue  "" .
    de:change1 de:newValue  "Testbook" .
    de:change1 de:sequence  354 .
    de:change1 de:timeStamp 2021-09-27UTZ23:45:23 .

The one triple is split up in separate parts, and some more metadata is added. We could supply both old and new value to keep historic values in the database if necessary. The timestamp is not necessary, but a nice addon for human retreival. The sequence number is what puts the triples in correct order. (Yes order is important. You don't want two semantic stacks to diverge because some changes were made in different order on both of them.)

This way, you could eliminate the need to store files about the deltas, keep historic data, and put every triple in the correct order for reconstruction.

## Retrieving updates from producer (TODO if appropriate)

Updates are retreived with periodic HTTP requests. This seems like a good idea, but has some drawbacks. On every request, we need to search through files on the share or through virtual files in the database to check if something new exists.

Instead, we could use WebSockets to keep a connection alive between the producer and consumer. The producer can then notify the consumer of deltas and immediately push them (or in batch after an interval). We could keep an internal cache of triples yet to send.

## Store graph information in the history (TODO)

Triples are spread accross graphs based on user groups that are determined at the time the user makes a request to store or delete some data. This can not simply be recreated on the consumer side. We should therefore also store the destination graph in the history and make sure that the consumer knows how to spread the data correctly accross the graphs.

Could this be done with `mu-auth-sudo`? Should we consider directly addressing the triplestore instead of the database (mu-authorization)?

## Framework for RDF in JavaScript?

This service does a lot of filtering, transforming, accessing, ... on the data it received from the database. As of now, this is all done through manual processes that act on the raw JSON format, and this is quite intensive and prone to breaking if the data representation changes. We should propose to make an abstraction for this type of datastructure. A Database object, for example, could receive data from the database in JSON format and transform it into native objects/dictionaries/... . This way you could filter, access and transform much easier. A few examples below:

Data in the form of 

  ```
  [ { subject:   { value: "uri", type: "uri" },
      predicate: { value: "uri", type: "uri" },
      object:    { value: "uri", type: "uri" } },
    ... ]
  ```

could be given to a Database object

  ```
  let database = new Database();
  database.ingest(jsondata);
  ```

From this point on, you could do things like this:

  ```
  let book1    = database.getIndividual("http://mu.semte.ch/book-service/books/book1");
  let uuid     = book1.getObject("http://mu.semte.ch/vocabularies/core/uuid");
  let headLine = book1.getObject("http://schema.org/headLine");
  ```

to get individuals from the Database that contain their properties, and access information from these individuals. This individual is much like a regular JavaScript object `new Book("uuid", "title")` where you can access properties like `book.title`, but collected out of a random JSON collection of data.

You could also register a prefix at any point in time to make accessing a lot nicer:

  ```
  database.registerPrefix("bks", "http://mu.semte.ch/book-service/books/");
  database.registerPrefix("sch", "http://schema.org/");
  database.registerPrefix("mu",  "http://mu.semte.ch/vocabularies/core/");

  let book1    = database.getIndividual("bks:book1");
  let uuid     = book1.getObject("mu:uuid");
  let headLine = book1.getObject("sch:headLine");
  ```

But you should still be able to use the database without prefixes. 

You can do transformations to RDF like:

  ```
  book1.toRDF();
  ```

to get

  ```
  <http://mu.semte.ch/book-service/books/book1> <http://mu.semte.ch/vocabularies/core/uuid> "abc123" ;
                                                <http://schema.org/>                        "Nice book" ;
                                                ...
  ```

(or maybe using prefix notation).

