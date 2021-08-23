# app-poc-diff

Project demonstrating a concept for delta sync between different applications

## Configuring

Keys are intentionally omitted from the configuration directories. Read the [mu-tunnel](http://github.com/redpencilio/mu-tunnel) documentation for instructions on creating the necessary keys.

## Starting the application

First, start the consumer using
```
docker-compose -f docker-compose.yml -f docker-compose.consumer.yml -p consumer up -d
```

Then, start the producer using
```
docker-compose -f docker-compose.yml -f docker-compose.producer.yml -p producer up -d
```

The producer is accessible at localhost:81 and the consumer at localhost:82.

The `container_name` key is used in the Compose files, so it is not possible to start multiple producers or consumers currently. However, if the appropriate container names were changed and configured, multiple consumers should work.

