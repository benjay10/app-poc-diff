# app-poc-diff

Project demonstrating a concept for delta sync between different applications

## Starting the PoC

First, start the producer using

```
docker-compose -f docker-compose.yml -f docker-compose.producer.yml -p producer up -d
```

Then, start the consumer using

```
docker-compose -f docker-compose.yml -f docker-compose.consumer.yml -p consumer up -d
```

The producer is accessible at localhost:81 and the consumer at localhost:82.

The project names must be exactly these names because the `external-link` key is used in the Docker Compose configuration.

