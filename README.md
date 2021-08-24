# app-poc-diff

Project demonstrating a concept for delta sync between different applications

## TODO

This service relies on indexed delta messages, and thus on [this PR](https://github.com/mu-semtech/mu-authorization/pull/6). As a temporary solution, we reference this repository and branch directly and build from it instead of using an image.

## Configuring

Keys are intentionally omitted from the configuration directories. Read the [mu-tunnel](http://github.com/redpencilio/mu-tunnel) documentation for instructions on creating the necessary keys.

## Starting the application

First, start the producer using
```
docker-compose -f docker-compose.yml -f docker-compose.producer.yml -p producer up -d
```
Alternatively, the producer may be started including a stress-testing "timer" service. This can be done by including the `docker-compose.timer.yml` file:
```
docker-compose -f docker-compose.yml -f docker-compose.producer.yml -f docker-compose.timer.yml -p producer up -d
```

Then, start the consumer using
```
docker-compose -f docker-compose.yml -f docker-compose.consumer.yml -p consumer up -d
```

The producer is accessible at localhost:81 and the consumer at localhost:82.

The `container_name` key is used in the Compose files, so it is not possible to start multiple producers or consumers currently. However, if the appropriate container names were changed and configured, multiple consumers should work.

## Services

* [mu-tunnel](http://github.com/redpencilio/mu-tunnel)
* [poc-diff-producer-service](http://github.com/redpencilio/poc-diff-producer-service)
* [poc-diff-consumer-service](http://github.com/redpencilio/poc-diff-consumer-service)
* [poc-diff-timer-service](http://github.com/redpencilio/poc-diff-timer-service)
