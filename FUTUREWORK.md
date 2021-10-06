# Future work

## Overview

Updates to the data (delta messages / deltas) are now collected in the producer service and, in a certain time interval, are pushed to a local file in a share. A virtual and physical file are then stored to the triplestore. When a consumer wants updates on the database, it sends out periodic requests to retreive those files based on a timestamp.

Problems:

*   A timestamp is not a good way of keeping state consistent. Use vector clocks, Lamport clocks, ... instead.
*   Storing files is slow and quickly becomes a mess.
*   Periodically requesting data is bad practice (in my opinion). Rely instead on socket connections
*   ... more?

## Storing of triples

Instead of storing triples in files, we should consider storing them in a more structured manner. Suppose we also want to make sure we can retreive changes orderly without missing a single triple. Can we transform every delta in a series of triples that represent that single delta with metadata? For example, the triple:

    sh:book1 sch:title "Testbook" .

can be represented by:

	de:change1 rdf:type     de:History .
    de:change1 de:aboutURI  sh:book1 .
    de:change1 de:aboutProp sch:title .
    de:change1 de:oldValue  "" .
    de:change1 de:newValue  "Testbook" .
    de:change1 de:sequence  354 .
    de:change1 de:timeStamp 2021-09-27UTZ23:45:23

The one triple is split up in separate parts, and some more metadata is added. We could supply both old and new value to keep historic values in the database if necessary. The timestamp is not necessary, but a nice addon for human retreival. The sequence number is what puts the triples in correct order. (Yes order is important. You don't want two semantic stacks to diverge because some changes were made in different order on both of them.)

This way, you could eliminate the need to store files about the deltas, keep historic data, and put every triple in the correct order for reconstruction.

## Retrieving updates from producer

Updates are retreived with periodic HTTP requests. This seems like a good idea, but has some drawbacks. On every request, we need to search through files on the share or through virtual files in the database to check if something new exists.

Instead, we could use WebSockets to keep a connection alive between the producer and consumer. The producer can then notify the consumer of deltas and immediately push them (or in batch after an interval). We could keep an internal cache of triples yet to send.

