# app-poc-diff

Project demonstrating a concept for delta sync between different applications

## Warning

This project is still a mess:

*   This project assumes you built some docker images before trying to run it.
*   Consumer side is still manual, because this is easier for testing: no updates are pulled in automatically.
*   The test framework is basic and can fail even if the results are correct.
*   The project is plagued with too large requests when you don't pay attention to it. Most real world request should be handled fine. The problems mostly lie with mu-autorization (being extremely slow on large requests, to the point that socket connections hang up) and Virtuoso (which outright fails when the query is too large).
*   This project needs a specilised delta-notifier to work. See [this repo for my adaptation of the delta-notifier](https://github.com/benjay10/delta-notifier).
*   The frontend web interface is probably mostly functional, but is not tested.
*   For some reason, data is always added twice: both times in different graphs. This happens in the mu-authorization. Problem with the config?
*   It seems that mu-cl-resource can really slow down the testing of this system when logs are showing in a terminal. Stop the resources service or exclude it from the logs showing up.
*   There is still a bug whith the `/test` on the producer-test-service. Not all data seems to come through correctly.

Good luck!

## Purpose

The purpose of this project is to demonstrate a new mechanism for keeping two stacks consistent. Previous attempts used local files to store intermediate updates to the database, and exchanged data based on timestamps. This poses several problems: time is not monotonically increasing accross systems with slightly different time settings, and managing hundreds/thousands of small files quickly becomes problematic. This project aims to address these issues by storing intermediate data in the database itself, by adding metadata in the form of historical information. Historical data also has another number of advantages, e.g. proving some data was removed from the database, and it serves as a first layer of backup.

This project also has the added ability to synchronises files.

## Prepare the application

Run the `./build-all.sh` script or run the `build.sh` files in the folders of this project manually.

Make sure you have built the delta-notifier from above.

## Starting the application

Thing are much easiers with some aliases. Use `source ./aliases.sh` in bash in the root of this directory to load the aliases.

You can now use:

*   `dc-p` to control the Docker Compose for the producer side of the project. E.g. `dc-p up -d` to create the container and start them, `dc-p stop` to stop all the containers.
*   `dc-c` to control the consumer side in the same manner.
*   `dc-pl` to control the logs of the producer. Without arguments, it spits out some previous logs and follows the service logs. Supply a container name to get old logs and follow just that one service. E.g. `dc-p database` to inspect the logs of the database on the producer.
*   `dc-cl` to control the logs on the consumer side in the same manner.

If you want to do things more manually, `dc-p up -d` is equivalent to

```
docker-compose -f docker-compose.yml -f docker-compose.producer.yml -p producer up -d
```

And for `dc-c up -d` you get

```
docker-compose -f docker-compose.yml -f docker-compose.consumer.yml -p consumer up -d
```

Start the producer and then the consumer with your preferred method.

## Configuring

Configuration is done in the .yml files for Docker Compose.

Keys for the tunnels are intentionally omitted from the configuration directories. Read the [mu-tunnel](http://github.com/redpencilio/mu-tunnel) documentation for instructions on creating the necessary keys.

## Future Work

Look at the `FUTUREWORK.md` file for more on this.

## Bugs

Look at the `Bugs.md` file for more bugs/problems encountered in this and the surrouding services.

## How it works

During normal operation of a stack, services create triples that are stored in the database. Triples can also be removed from the database, of course. Mu-authorization creates JSON objects of these updates (inserts and deletes) that are pushed to the delta-notifier. The delta-notifier inspects the triples and matches them according to rules and sends them to the services that need those triples. The producer service from this project shoud receive **ALL** triples created by common services, and should not receive updates originating from the producer service.

The producer service first stores the updates into a queue, in the order they arrive. This is also the order in which the mu-authorization processed the triples from services. (Is there really certainty of that? Will need to figure that out.) The producer service will quickly start processing these objects with updates, one by one, because ordering is important. It transforms the data into history triples that look something like this:

  ```
	de:change1 rdf:type     de:History .
  de:change1 de:aboutURI  sh:book1 .
  de:change1 de:aboutProp sch:title .
  de:change1 de:oldValue  de:nil .
  de:change1 de:newValue  "Testbook" .
  de:change1 de:sequence  354 .
  de:change1 de:timeStamp 2021-09-27UTZ23:45:23 .
  ```

These 7 (history)-triples actually describe one regular triple and adds some metadata. Every history individual gets a sequence number and an optional timestamp so that triples are inserted/deleted in the correct order when they are transformed back into regular triples. This sequence number is not related to an absolute time. To get the next sequence number, the database is queried to get the highest sequence number in use and this is incremented to produce new history items. Sequence number (should!) therefore monotonically increment.

There is an old value and a new value on every history individual. This is to indicate an insertion (from nil to something else), a deletion (from something to nil), or an update (from something to something else). This allows for the grouping of some inserts and deletes on the same subject and predicate and is functional throughout the project, but untested, because the delta-notifier separates inserts and deletes too much.

The consumer service (on the stack that needs to be kept consistent) periodically checks the last used sequence number and requests to the producer all history individuals since that sequence number. The data from the database can be sent as a response. The consumer service then translates these history triples back into regular triples that are then sent to the database for storing or deleting. The history triples are also stored in the database directly.

The sequence numbers in the history allows for correct ordering of the inserts, updates and deletes. Every history individual could be processed one by one, but this would result in an extreme amount of database queries. Instead, to reduce the amount of queries, changes are split in consecutive groups of inserts, updates, and deletes. (All consecutive inserts can be processed together, until an update or delete is the next sequence in the history.) Updates are both an insert and a delete, and are therefore always processed one by one.

Before storing these regular triples (or removing some) to the database, they are filtered for triples about files (nfo:FileDataObject). These physical files are downloaded from the original stack and put in the correct location on the replicated stack. The original triples about these files can be posted to the database, because everything about the file remains the same. Files are also removed if their triples are removed from the database.

## Other services

* [mu-tunnel](https://github.com/redpencilio/mu-tunnel)
* [delta-notifier](https://github.com/benjay10/delta-notifier)
* [poc-diff-timer-service](https://github.com/redpencilio/poc-diff-timer-service) (not used for now)

